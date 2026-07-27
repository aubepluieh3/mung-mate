import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMatches } from '../src/match.ts';
import { me, neighborhood, districts } from '../sample/neighborhood.ts';
import type { Dog } from '../src/dog.ts';

const NOW = new Date('2026-07-27T00:00:00Z');
const OPTS = { now: NOW, districts };
const matches = findMatches(me, neighborhood, OPTS);
const byName = (name: string) => matches.find((m) => m.dog.name === name)!;
const rankOf = (name: string) => matches.findIndex((m) => m.dog.name === name);

test('자기 자신은 후보에 들어가지 않는다', () => {
  const withSelf = findMatches(me, [...neighborhood, me], OPTS);
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
  assert.equal(byeol.group, 'reachable');
  assert.equal(byeol.gate.level, 'caution');
  assert.ok(byeol.requestable);
});

test('만날 수 있는지가 궁합보다 먼저다', () => {
  // 뭉치(연남동·밤)는 궁합이 좋지만 토리(성산동·저녁,밤)와 시간대만 겹치고 동은 인접
  // 할부지(합정동·아침)는 동도 멀고 시간대도 안 겹친다
  const grandpa = byName('할부지');
  assert.equal(grandpa.group, 'far');
  assert.ok(grandpa.score! > 0);

  // 점수가 더 낮아도 만날 수 있는 상대가 위로 온다
  const kkami = byName('까미'); // 성산동·밤 → 겹침
  assert.equal(kkami.group, 'reachable');
  assert.ok(kkami.score! < grandpa.score!);
  assert.ok(rankOf('까미') < rankOf('할부지'));
});

test('경고 여부가 아니라 점수로 순위를 매긴다', () => {
  // 이전 설계는 레벨을 1순위로 정렬해서 55점 ok 가 70점 caution 보다 위에 있었다
  const caution = byName('별이'); // 주의, 31점
  const ok = byName('방울'); // 통과, 8점
  assert.ok(caution.score! > ok.score!);
  assert.ok(rankOf('별이') < rankOf('방울'));
});

test('겁많은 소형견에게는 만날 수 있는 겁많은 소형견이 1순위로 온다', () => {
  assert.equal(matches[0].dog.name, '보리');
  assert.equal(matches[0].group, 'reachable');
  assert.equal(matches[0].score, 90);
});

test('태그 없는 프로필은 점수 경쟁에서 빠져 그룹 안에서 아래로 간다', () => {
  const kong = byName('콩이'); // 성산동 · 저녁 → 만날 수는 있다
  assert.equal(kong.group, 'reachable');
  assert.equal(kong.score, null);
  assert.ok(kong.requestable); // 위험한 게 아니라 정보가 없을 뿐이다

  // 같은 그룹에서 점수가 있는 상대들보다 아래
  const scoredInGroup = matches.filter((m) => m.group === 'reachable' && m.score !== null);
  assert.ok(scoredInGroup.every((m) => rankOf(m.dog.name) < rankOf('콩이')));
});

test('만날 수 있으면 성향 미기재라도 먼 동네보다 위로 온다', () => {
  // 성향 미기재를 별도 그룹으로 빼면 이 순서가 뒤집힌다
  assert.ok(rankOf('콩이') < rankOf('할부지'));
});

test('그룹 순서는 만날 수 있음 → 못 만남 → 차단', () => {
  const order = matches.map((m) => m.group);
  const rank = { reachable: 0, far: 1, blocked: 2 };
  for (let i = 1; i < order.length; i++) {
    assert.ok(rank[order[i - 1]] <= rank[order[i]], `${order[i - 1]} 뒤에 ${order[i]}`);
  }
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
  const result = findMatches(me, [twin('t2', '하늘'), twin('t1', '가을')], OPTS);
  assert.deepEqual(
    result.map((m) => m.dog.name),
    ['가을', '하늘'],
  );
});
