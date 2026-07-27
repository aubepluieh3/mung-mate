import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore } from '../src/score.ts';
import type { Dog } from '../src/dog.ts';

const NOW = new Date('2026-07-27T00:00:00Z');
const FRESH = '2026-06-01T00:00:00Z';
const STALE = '2024-01-01T00:00:00Z';

const dog = (over: Partial<Dog> = {}): Dog => ({
  id: 'd',
  name: '멍이',
  breed: '믹스',
  ageMonths: 36,
  weightKg: 12,
  sex: 'male',
  neutered: true,
  temperaments: [],
  preferences: [],
  temperamentsUpdatedAt: FRESH,
  ...over,
});

const score = (a: Dog, b: Dog) => computeScore(a, b, NOW).score;

test('태그 정보가 없으면 점수를 매기지 않는다', () => {
  const result = computeScore(dog(), dog({ id: 'b', weightKg: 13 }), NOW);
  assert.equal(result.score, null);
  assert.equal(result.tagFit, null);
  assert.deepEqual(result.pairs, []);
});

test('한쪽만 태그가 있어도 궁합을 계산할 수 없다', () => {
  const tagged = dog({ temperaments: ['겁많음'] });
  const blank = dog({ id: 'b', weightKg: 12 });
  assert.equal(score(tagged, blank), null);
});

test('빈 프로필은 정직하게 적은 프로필보다 위로 올라갈 수 없다', () => {
  const me = dog({ id: 'me', temperaments: ['겁많음'] });
  const timid = dog({ id: 't', name: '보리', temperaments: ['겁많음'] });
  const blank = dog({ id: 'k', name: '콩이' });

  assert.ok(score(me, timid)! > 50);
  assert.equal(score(me, blank), null); // 점수 자체가 없으므로 순위 경쟁에 끼지 못한다
});

test('겁많음끼리는 높은 점수 — 정직하게 적은 견주가 갈 곳이 있어야 한다', () => {
  const a = dog({ id: 'a', temperaments: ['겁많음'] });
  const b = dog({ id: 'b', name: '보리', temperaments: ['겁많음'] });
  const lively = dog({ id: 'l', name: '방울', temperaments: ['활발함'] });

  assert.equal(score(a, b), 90); // 50 + 20*2
  assert.ok(score(a, b)! > score(a, lively)!);
});

test('개좋아함 × 겁많음은 가점이 아니라 감점이다', () => {
  const social = dog({ id: 's', name: '초코', temperaments: ['개좋아함'] });
  const timid = dog({ id: 't', name: '토리', temperaments: ['겁많음'] });
  const result = computeScore(social, timid, NOW);

  assert.equal(result.tagFit, 20); // 50 - 15*2
  assert.ok(result.pairs[0].note?.includes('위협'));
});

test('차분함은 겁많음/예민함에게 가점', () => {
  const calm = dog({ id: 'c', name: '두부', temperaments: ['차분함'] });
  const timid = dog({ id: 't', name: '토리', temperaments: ['겁많음'] });
  const sensitive = dog({ id: 's', name: '까미', sensitiveToDogs: true });

  assert.equal(computeScore(calm, timid, NOW).tagFit, 90);
  assert.equal(computeScore(calm, sensitive, NOW).tagFit, 80);
});

test('예민해요끼리는 최고 가점 — 체크할 유인이 되어야 한다', () => {
  const a = dog({ id: 'a', sensitiveToDogs: true });
  const b = dog({ id: 'b', name: '뭉치', sensitiveToDogs: true });
  assert.equal(computeScore(a, b, NOW).tagFit, 100); // 50 + 25*2
});

test('사람좋아는 개끼리 궁합과 무관해서 평균을 희석하지 않는다', () => {
  const a = dog({ id: 'a', temperaments: ['겁많음'] });
  const plain = dog({ id: 'b', name: '보리', temperaments: ['겁많음'] });
  const withPeopleTag = dog({ id: 'c', name: '보리', temperaments: ['겁많음', '사람좋아'] });

  assert.equal(score(a, plain), score(a, withPeopleTag));
});

test('태그를 많이 붙여도 점수가 올라가지 않는다 — 평균이라서', () => {
  const me = dog({ id: 'me', temperaments: ['활발함'] });
  const one = dog({ id: 'a', name: '방울', temperaments: ['활발함'] });
  const many = dog({ id: 'b', name: '방울', temperaments: ['활발함', '개좋아함', '짖음많음'] });

  assert.ok(score(me, many)! < score(me, one)!);
});

test('체급과 나이는 감점이 아니라 곱셈 계수로 들어간다', () => {
  const me = dog({ id: 'me', weightKg: 8, ageMonths: 36, temperaments: ['겁많음'] });
  const same = dog({ id: 'a', name: '보리', weightKg: 8, ageMonths: 36, temperaments: ['겁많음'] });
  const bigger = dog({ id: 'b', name: '나비', weightKg: 15, ageMonths: 36, temperaments: ['겁많음'] });
  const older = dog({ id: 'c', name: '할부지', weightKg: 8, ageMonths: 144, temperaments: ['겁많음'] });

  assert.equal(computeScore(me, same, NOW).tagFit, 90);
  assert.equal(score(me, same), 90);
  assert.equal(score(me, bigger), Math.round(90 * 0.85)); // 1.9배
  assert.equal(score(me, older), Math.round(90 * 0.8)); // 9살 차이
  // 태그 궁합은 그대로 남아 있고 계수만 곱해진다
  assert.equal(computeScore(me, bigger, NOW).tagFit, 90);
});

test('적극적인 개가 더 무거우면 압도 계수가 붙는다', () => {
  const timid = dog({ id: 't', name: '토리', weightKg: 8, temperaments: ['겁많음'] });
  const bigLively = dog({ id: 'b', name: '방울', weightKg: 10, temperaments: ['활발함'] });
  const smallLively = dog({ id: 's', name: '방울', weightKg: 6, temperaments: ['활발함'] });

  const big = computeScore(timid, bigLively, NOW);
  const small = computeScore(timid, smallLively, NOW);

  assert.ok(big.factors.some((f) => f.code === 'OVERWHELM'));
  assert.ok(!small.factors.some((f) => f.code === 'OVERWHELM'));
  assert.ok(big.score! < small.score!);
});

test('오래된 프로필은 태그 궁합이 중립(50) 쪽으로 당겨진다', () => {
  const fresh = dog({ id: 'a', temperaments: ['겁많음'], temperamentsUpdatedAt: FRESH });
  const stale = dog({ id: 'a', temperaments: ['겁많음'], temperamentsUpdatedAt: STALE });
  const timid = dog({ id: 'b', name: '보리', temperaments: ['겁많음'] });

  assert.equal(computeScore(fresh, timid, NOW).tagFit, 90);
  assert.equal(computeScore(stale, timid, NOW).tagFit, 70); // 50 + 20*2*0.5
  assert.equal(computeScore(stale, timid, NOW).tagTrust, 0.5);
});

test('신뢰 하향은 감점 쪽에서도 중립으로 당긴다 (상한에 먹히지 않는다)', () => {
  const lively = dog({ id: 'a', name: '방울', temperaments: ['활발함'] });
  const timidFresh = dog({ id: 'b', name: '토리', temperaments: ['겁많음'] });
  const timidStale = dog({ id: 'b', name: '토리', temperaments: ['겁많음'], temperamentsUpdatedAt: STALE });

  assert.equal(computeScore(lively, timidFresh, NOW).tagFit, 5); // 50 - 25*2 → 하한 5
  assert.equal(computeScore(lively, timidStale, NOW).tagFit, 25); // 50 - 25*2*0.5
});

test('점수는 0~100을 벗어나지 않는다', () => {
  const worst = dog({ id: 'w', weightKg: 22, temperaments: ['활발함', '개좋아함', '짖음많음'] });
  const victim = dog({ id: 'v', name: '토리', weightKg: 11, temperaments: ['겁많음'], sensitiveToDogs: true });
  const best = dog({ id: 'x', sensitiveToDogs: true });

  const low = computeScore(worst, victim, NOW);
  const high = computeScore(best, dog({ id: 'y', sensitiveToDogs: true }), NOW);

  assert.ok(low.score! >= 0 && low.score! <= 100);
  assert.ok(low.score! < 10);
  assert.equal(high.score, 100);
});

test('순서를 바꿔도 점수가 같다', () => {
  const pairs: [Dog, Dog][] = [
    [dog({ temperaments: ['활발함'] }), dog({ id: 'b', weightKg: 20, temperaments: ['겁많음'] })],
    [dog({ temperaments: ['개좋아함'] }), dog({ id: 'b', temperaments: ['겁많음'] })],
    [dog({ sensitiveToDogs: true }), dog({ id: 'b', temperaments: ['차분함'] })],
    [dog({ temperaments: ['짖음많음'] }), dog({ id: 'b', sensitiveToDogs: true })],
    [
      dog({ ageMonths: 12, weightKg: 8, temperaments: ['활발함'] }),
      dog({ id: 'b', ageMonths: 132, weightKg: 18, temperaments: ['차분함'] }),
    ],
    [
      dog({ temperamentsUpdatedAt: STALE, temperaments: ['짖음많음'] }),
      dog({ id: 'b', temperaments: ['겁많음'] }),
    ],
  ];
  for (const [a, b] of pairs) {
    assert.equal(computeScore(a, b, NOW).score, computeScore(b, a, NOW).score);
  }
});

test('문장의 조사가 이름 받침에 맞는다', () => {
  const timid = dog({ id: 't', name: '토리', temperaments: ['겁많음'] });
  const barky = dog({ id: 'b', name: '흰둥', temperaments: ['짖음많음'] });
  const note = computeScore(timid, barky, NOW).pairs.find((p) => p.note)?.note ?? '';

  assert.ok(note.includes('흰둥의 짖음이'));
  assert.ok(note.includes('토리를 긴장'));
});
