import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReach, type DistrictGraph } from '../src/reach.ts';
import type { Dog } from '../src/dog.ts';

const GRAPH: DistrictGraph = {
  성산동: ['망원동', '연남동'],
  망원동: ['성산동'],
  연남동: ['성산동'],
};

const dog = (over: Partial<Dog> = {}): Dog => ({
  id: 'd',
  name: '멍이',
  breed: '믹스',
  ageMonths: 36,
  weightKg: 12,
  sex: 'male',
  neutered: true,
  district: '성산동',
  walkTimes: ['저녁'],
  temperaments: [],
  preferences: [],
  ...over,
});

test('같은 동에 시간대가 겹치면 만날 수 있다', () => {
  const r = evaluateReach(dog(), dog({ id: 'b' }), GRAPH);
  assert.equal(r.distance, 'same');
  assert.deepEqual(r.sharedTimes, ['저녁']);
  assert.equal(r.reachable, true);
});

test('인접한 동도 만날 수 있다', () => {
  const r = evaluateReach(dog(), dog({ id: 'b', district: '망원동' }), GRAPH);
  assert.equal(r.distance, 'near');
  assert.equal(r.reachable, true);
});

test('인접 관계는 한쪽만 적어둬도 인정한다', () => {
  // 연남동 → 성산동 은 그래프에 있지만 반대 방향만 있는 경우도 같게 본다
  const oneWay: DistrictGraph = { 성산동: ['연남동'] };
  assert.equal(evaluateReach(dog({ district: '연남동' }), dog({ id: 'b' }), oneWay).distance, 'near');
});

test('인접하지 않은 동은 만날 수 없다', () => {
  const r = evaluateReach(dog(), dog({ id: 'b', district: '망원동' }), {});
  assert.equal(r.distance, 'far');
  assert.equal(r.reachable, false);
});

test('시간대가 안 겹치면 같은 동이어도 만날 수 없다', () => {
  const r = evaluateReach(dog({ walkTimes: ['아침'] }), dog({ id: 'b', walkTimes: ['밤'] }), GRAPH);
  assert.equal(r.distance, 'same');
  assert.deepEqual(r.sharedTimes, []);
  assert.equal(r.timesUnknown, false);
  assert.equal(r.reachable, false);
});

test('겹치는 시간대는 모두 모은다', () => {
  const r = evaluateReach(
    dog({ walkTimes: ['아침', '저녁', '밤'] }),
    dog({ id: 'b', walkTimes: ['저녁', '밤', '점심'] }),
    GRAPH,
  );
  assert.deepEqual(r.sharedTimes, ['저녁', '밤']);
});

test('겹치는 시간대는 프로필에 적힌 순서와 무관하게 하루 순서로 나온다', () => {
  const a = dog({ walkTimes: ['밤', '아침'] });
  const b = dog({ id: 'b', walkTimes: ['아침', '밤'] });
  assert.deepEqual(evaluateReach(a, b, GRAPH).sharedTimes, ['아침', '밤']);
  assert.deepEqual(evaluateReach(b, a, GRAPH).sharedTimes, ['아침', '밤']);
});

test('동을 안 적으면 판정할 수 없다 — 안 겹치는 것과 구분한다', () => {
  const r = evaluateReach(dog(), dog({ id: 'b', district: undefined }), GRAPH);
  assert.equal(r.distance, 'unknown');
  assert.equal(r.reachable, false);
});

test('시간대를 안 적으면 판정할 수 없다', () => {
  const r = evaluateReach(dog(), dog({ id: 'b', walkTimes: [] }), GRAPH);
  assert.equal(r.timesUnknown, true);
  assert.deepEqual(r.sharedTimes, []);
  assert.equal(r.reachable, false);
});

test('순서를 바꿔도 판정이 같다', () => {
  const pairs: [Dog, Dog][] = [
    [dog(), dog({ id: 'b', district: '망원동' })],
    [dog({ walkTimes: ['아침'] }), dog({ id: 'b', walkTimes: ['아침', '밤'] })],
    [dog({ district: undefined }), dog({ id: 'b' })],
    [dog(), dog({ id: 'b', district: '수유동' })],
  ];
  for (const [a, b] of pairs) {
    assert.deepEqual(evaluateReach(a, b, GRAPH), evaluateReach(b, a, GRAPH));
  }
});
