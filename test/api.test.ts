import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * 서버 API 테스트.
 *
 * 지금까지 API 검증을 임시 스크립트로만 했다. 그러면 고친 게 나중에 다시 깨져도 못 잡는다.
 * 길이 제한, 태그 필터, 동네 검증, 차단 방어는 전부 손으로 확인한 것들이라 회귀 위험이 컸다.
 *
 * 실제 서버를 임시 DB 로 띄워서 확인한다 — 라우팅과 검증까지 같이 덮는다.
 */

const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
let server: ChildProcess;
let dbDir: string;

const post = async (path: string, body: unknown) => {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
};

const get = async (path: string) => {
  const res = await fetch(BASE + path);
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
};

const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

/** 프로필을 하나 만들고 id 를 돌려준다. */
const register = async (over: Record<string, unknown> = {}) => {
  const res = await post('/api/dogs', {
    name: '테스트',
    breed: '믹스',
    ageMonths: 36,
    weightKg: 10,
    sex: 'male',
    neutered: true,
    district: '성산동',
    walkTimes: ['저녁'],
    temperaments: [],
    ...over,
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.dog.id as string;
};

before(async () => {
  dbDir = mkdtempSync(join(tmpdir(), 'mung-'));
  server = spawn(
    process.execPath,
    ['--experimental-strip-types', '--experimental-sqlite', 'server/index.ts'],
    {
      env: { ...process.env, PORT: String(PORT), MUNG_DB: join(dbDir, 'test.db') },
      stdio: 'ignore',
    },
  );

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      await fetch(`${BASE}/api/districts`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error('테스트 서버가 뜨지 않았습니다.');
});

after(async () => {
  server?.kill();
  // 프로세스가 DB 파일을 놓을 시간을 준다. 임시 디렉터리라 못 지워도 문제는 없다
  await new Promise((r) => setTimeout(r, 500));
  try {
    rmSync(dbDir, { recursive: true, force: true });
  } catch {
    /* 임시 파일이 남는 것보다 테스트가 실패하는 게 더 나쁘다 */
  }
});

test('동네 목록을 내려준다', async () => {
  const { status, body } = await get('/api/districts');
  assert.equal(status, 200);
  assert.ok(body.districts.includes('성산동'));
});

test('빈 DB 는 샘플로 채워져 첫 사용자에게 후보가 있다', async () => {
  const id = await register({ name: '첫사용자' });
  const { body } = await get(`/api/matches?dogId=${id}`);
  assert.ok(body.groups.length > 0);
});

test('프로필 필수값을 검증한다', async () => {
  const cases: [string, Record<string, unknown>, RegExp][] = [
    ['이름 없음', { ageMonths: 36, weightKg: 10, sex: 'male' }, /이름/],
    ['몸무게 0', { name: '개', ageMonths: 36, weightKg: 0, sex: 'male' }, /몸무게/],
    ['성별 없음', { name: '개', ageMonths: 36, weightKg: 10 }, /성별/],
    ['음수 나이', { name: '개', ageMonths: -1, weightKg: 10, sex: 'male' }, /나이/],
    ['나이 누락', { name: '개', weightKg: 10, sex: 'male' }, /나이/],
  ];
  for (const [label, body, pattern] of cases) {
    const res = await post('/api/dogs', body);
    assert.equal(res.status, 400, label);
    assert.match(res.body.error, pattern, label);
  }
});

test('모르는 동네는 거부한다', async () => {
  // 그냥 받아두면 조용히 "먼 동네"가 되어 견주는 왜 아무도 안 뜨는지 알 수 없다
  const res = await post('/api/dogs', {
    name: '개',
    weightKg: 10,
    sex: 'male',
    ageMonths: 36,
    district: '강남동',
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /지원하지 않는 동네/);
});

test('모르는 태그와 시간대는 걸러내고 태그는 3개로 자른다', async () => {
  const res = await post('/api/dogs', {
    name: '개',
    weightKg: 10,
    sex: 'male',
    ageMonths: 36,
    district: '성산동',
    walkTimes: ['아침', '새벽', '저녁', '아침'],
    temperaments: ['활발함', '개좋아함', '무서움', '짖음많음', '차분함'],
  });
  assert.deepEqual(res.body.dog.walkTimes, ['아침', '저녁']);
  assert.equal(res.body.dog.temperaments.length, 3);
  assert.ok(!res.body.dog.temperaments.includes('무서움'));
});

test('문자열 길이를 서버에서 제한한다', async () => {
  // 화면에서 막아도 API 를 직접 부르면 무제한으로 들어온다
  const long = await post('/api/dogs', {
    name: 'ㄱ'.repeat(21),
    weightKg: 10,
    sex: 'male',
    ageMonths: 36,
  });
  assert.equal(long.status, 400);
  assert.match(long.body.error, /20자/);

  const host = await register();
  const place = await post('/api/walks', {
    hostId: host,
    date: tomorrow(),
    time: '저녁',
    place: 'ㄱ'.repeat(61),
    minutes: 30,
  });
  assert.equal(place.status, 400);
  assert.match(place.body.error, /60자/);
});

test('점수와 산식은 응답에 나가지 않는다', async () => {
  const id = await register({ temperaments: ['겁많음'] });
  const { body } = await get(`/api/matches?dogId=${id}`);
  const raw = JSON.stringify(body);
  assert.ok(!/"score":/.test(raw), '점수가 노출됨');
  assert.ok(!/"tagFit":/.test(raw), 'tagFit 이 노출됨');
  assert.ok(!/"delta":|"multiplier":/.test(raw), '산식이 노출됨');
});

test('차단된 상대에게는 요청을 남기지 않는다', async () => {
  const small = await register({ name: '작은개', weightKg: 4 });
  const big = await register({ name: '큰개', weightKg: 30 });
  const res = await post('/api/requests', { fromId: small, toId: big });
  assert.equal(res.status, 409);
});

test('산책 약속을 검증하고 정원을 보정한다', async () => {
  const host = await register({ name: '호스트', weightKg: 12 });
  const base = { hostId: host, date: tomorrow(), time: '저녁', place: '공원', minutes: 30 };

  assert.equal((await post('/api/walks', { ...base, date: '2020-01-01' })).status, 400);
  assert.equal((await post('/api/walks', { ...base, date: '내일' })).status, 400);
  assert.equal((await post('/api/walks', { ...base, time: '새벽' })).status, 400);
  assert.equal((await post('/api/walks', { ...base, place: '  ' })).status, 400);
  assert.equal((await post('/api/walks', { ...base, minutes: 5 })).status, 400);
  assert.equal((await post('/api/walks', { ...base, hostId: 'nope' })).status, 404);

  // 정원은 2~3명으로 보정된다
  assert.equal((await post('/api/walks', { ...base, capacity: 99 })).status, 200);
  const { body } = await get(`/api/walks?dogId=${host}`);
  assert.ok(body.walks.every((w: any) => /\/[23]\)$/.test(w.participants)), JSON.stringify(body.walks));
});

test('참여 신청은 참여자 전원과 검사하고 서버가 다시 막는다', async () => {
  const small = await register({ name: '꼬맹이', weightKg: 4 });
  const big = await register({ name: '덩치', weightKg: 30 });

  await post('/api/walks', {
    hostId: small,
    date: tomorrow(),
    time: '저녁',
    place: '공원',
    minutes: 30,
  });
  const mine = (await get(`/api/walks?dogId=${small}`)).body.walks.find((w: any) =>
    w.participants.startsWith('꼬맹이'),
  );

  // 화면에서 버튼을 감추는 것과 별개로 API 도 막아야 한다
  const blocked = await post('/api/walks/join', { walkId: mine.id, dogId: big });
  assert.equal(blocked.status, 409);

  assert.equal((await post('/api/walks/join', { walkId: 'nope', dogId: big })).status, 404);
  assert.equal((await post('/api/walks/join', { walkId: mine.id, dogId: 'nope' })).status, 404);

  // 큰 개 화면에서는 참여 버튼이 잠기고 이유가 보인다
  const seen = (await get(`/api/walks?dogId=${big}`)).body.walks.find((w: any) => w.id === mine.id);
  assert.equal(seen.joinable, false);
  assert.ok(seen.notes.length > 0);
});

test('산책로를 검증하고 모르는 태그는 걸러낸다', async () => {
  const id = await register({ name: '등록자' });

  assert.equal((await post('/api/trails', { dogId: id, name: ' ', minutes: 30 })).status, 400);
  assert.equal((await post('/api/trails', { dogId: id, name: '길', minutes: 0 })).status, 400);
  assert.equal((await post('/api/trails', { dogId: id, name: '길', minutes: 9999 })).status, 400);
  assert.equal((await post('/api/trails', { dogId: 'nope', name: '길', minutes: 30 })).status, 404);

  await post('/api/trails', {
    dogId: id,
    name: '태그검사길',
    minutes: 30,
    tags: ['차없음', '목줄풀어도됨', '차없음'],
  });
  const found = (await get(`/api/trails?dogId=${id}`)).body.trails.find(
    (t: any) => t.name === '태그검사길',
  );
  assert.deepEqual(found.tags, ['차없음'], '모르는 태그와 중복이 남았다');
});

test('걸어갈 수 없는 동네의 산책로와 약속은 목록에 넣지 않는다', async () => {
  // 합정동은 망원동과만 인접하다 — 성산동 견주에게 합정동 항목이 보이면 안 된다
  const farAway = await register({ name: '합정개', district: '합정동', walkTimes: ['아침'] });
  await post('/api/trails', { dogId: farAway, name: '합정전용길', minutes: 20 });

  const seongsan = await register({ name: '성산개' });
  const trails = (await get(`/api/trails?dogId=${seongsan}`)).body.trails;
  assert.ok(!trails.some((t: any) => t.name === '합정전용길'));
});

test('없는 경로와 깨진 본문을 처리한다', async () => {
  assert.equal((await get('/api/nope')).status, 404);
  assert.equal((await get('/api/walks/join')).status, 404);

  const broken = await fetch(`${BASE}/api/dogs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{{{',
  });
  assert.equal(broken.status, 400);
});
