import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMatches } from '../src/match.ts';
import { me, neighborhood } from '../sample/neighborhood.ts';
import type { Dog } from '../src/dog.ts';

const NOW = new Date('2026-07-27T00:00:00Z');
const matches = findMatches(me, neighborhood, NOW);
const byName = (name: string) => matches.find((m) => m.dog.name === name)!;
const rankOf = (name: string) => matches.findIndex((m) => m.dog.name === name);

test('자기 자신은 후보에 들어가지 않는다', () => {
  const withSelf = findMatches(me, [...neighborhood, me], NOW);
  assert.equal(withSelf.filter((m) => m.dog.id === me.id).length, 0);
});

test('차단된 상대도 목록에서 사라지지 않는다 — 맨 아래로 내려가고 요청만 잠긴다', () => {
  const blocked = matches.filter((m) => m.group === 'blocked');
  assert.ok(blocked.length > 0);
  assert.ok(blocked.every((m) => !m.requestable));
  assert.ok(blocked.every((m) => m.gate.findings.length > 0)); // 이유는 반드시 보여준다

  const lastGroups = matches.slice(-blocked.length).map((m) => m.group);
  assert.deepEqual(new Set(lastGroups), new Set(['blocked']));
});

test('차단된 상대에게는 점수를 보여주지 않는다', () => {
  for (const m of matches.filter((x) => x.group === 'blocked')) {
    assert.equal(m.score, null);
    assert.deepEqual(m.pairs, []);
    assert.deepEqual(m.factors, []);
  }
});

test('차단이면 차단 사유만 남기고 부가 경고는 감춘다', () => {
  const saessak = byName('새싹'); // 접종 미완료(차단) + 체급 2배(경고)
  assert.equal(saessak.group, 'blocked');
  assert.ok(saessak.gate.findings.every((f) => f.level === 'block'));
  assert.ok(saessak.gate.findings.some((f) => f.code === 'VACCINATION_INCOMPLETE'));
});

test('경고가 붙은 상대는 목록에서 빠지지 않고 요청도 가능하다', () => {
  const byeol = byName('별이');
  assert.equal(byeol.group, 'match');
  assert.equal(byeol.gate.level, 'caution');
  assert.ok(byeol.requestable);
});

test('경고 여부가 아니라 점수로 순위를 매긴다', () => {
  // 이전 설계는 레벨을 1순위로 정렬해서 55점 ok 가 70점 caution 보다 위에 있었다
  const caution = byName('별이'); // 주의, 31점
  const ok = byName('방울'); // 통과, 8점
  assert.ok(caution.score! > ok.score!);
  assert.ok(rankOf('별이') < rankOf('방울'));
});

test('겁많은 소형견에게는 겁많은 소형견이 1순위로 온다', () => {
  assert.equal(matches[0].dog.name, '보리');
  assert.equal(matches[0].score, 90);
});

test('태그 없는 프로필은 점수 경쟁에서 빠져 추천 아래로 간다', () => {
  const kong = byName('콩이');
  assert.equal(kong.group, 'unknown');
  assert.equal(kong.score, null);
  assert.ok(kong.requestable); // 위험한 게 아니라 정보가 없을 뿐이다

  const worstScored = Math.min(
    ...matches.filter((m) => m.group === 'match').map((m) => rankOf(m.dog.name)),
  );
  assert.ok(rankOf('콩이') > worstScored);
});

test('그룹 순서는 추천 → 정보 부족 → 차단', () => {
  const order = matches.map((m) => m.group);
  const firstUnknown = order.indexOf('unknown');
  const firstBlocked = order.indexOf('blocked');
  assert.ok(firstUnknown < firstBlocked);
  assert.ok(order.slice(0, firstUnknown).every((g) => g === 'match'));
});

test('오래 방치된 프로필은 순위가 중립 쪽으로 밀린다', () => {
  const mungchi = byName('뭉치'); // 겁많음 + 예민해요, 2년 전 프로필
  const bori = byName('보리'); // 겁많음, 최근 프로필
  assert.equal(mungchi.tagTrust, 0.5);
  assert.ok(mungchi.score! < bori.score!);
});

test('후보가 늘어도 정렬은 안정적이다 (동점은 이름순)', () => {
  const twin = (id: string, name: string): Dog => ({
    ...me,
    id,
    name,
    temperaments: ['겁많음'],
  });
  const result = findMatches(me, [twin('t2', '하늘'), twin('t1', '가을')], NOW);
  assert.deepEqual(
    result.map((m) => m.dog.name),
    ['가을', '하늘'],
  );
});
