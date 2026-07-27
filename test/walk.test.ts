import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkJoin, MAX_PARTICIPANTS, type Walk } from '../src/walk.ts';
import type { Dog } from '../src/dog.ts';

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

const walk = (over: Partial<Walk> = {}): Walk => ({
  id: 'w1',
  hostId: 'host',
  district: '성산동',
  date: '2026-08-01',
  time: '저녁',
  place: '망원한강공원 입구',
  minutes: 30,
  capacity: MAX_PARTICIPANTS,
  participantIds: ['host'],
  ...over,
});

const host = dog({ id: 'host', name: '토리', weightKg: 8 });

test('조건이 맞으면 참여할 수 있다', () => {
  const joiner = dog({ id: 'j', name: '보리', weightKg: 7 });
  const result = checkJoin(walk(), joiner, [host]);
  assert.equal(result.ok, true);
  assert.ok(result.ok && result.cautions.length === 0);
});

test('참여자 중 한 마리라도 차단 조합이면 못 들어간다', () => {
  const big = dog({ id: 'b', name: '초코', weightKg: 30 }); // 토리 8kg 과 3.8배
  const result = checkJoin(walk(), big, [host]);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason.includes('토리'));
  assert.ok(!result.ok && result.blockers.some((f) => f.code === 'SIZE_GAP_BLOCK'));
});

test('참여자 전원과 쌍으로 검사한다 — 호스트와만 보지 않는다', () => {
  // 신청자는 호스트(12kg)와는 맞지만 이미 참여한 소형견(4kg)과는 3배 이상 차이난다
  const mediumHost = dog({ id: 'host', name: '두부', weightKg: 12 });
  const small = dog({ id: 's', name: '까미', weightKg: 4 });
  const joiner = dog({ id: 'j', name: '바둑', weightKg: 13 });

  const w = walk({ participantIds: ['host', 's'] });
  const result = checkJoin(w, joiner, [mediumHost, small]);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason.includes('까미'));
});

test('그룹 안에서 미중성화 암수가 섞이는 것도 막는다', () => {
  // 1:1 판정만 있는 엔진으로 그룹 안전이 잡히는지 — 기획자 검토에서 걸린 지점이다
  const intactFemale = dog({ id: 'f', name: '나비', sex: 'female', neutered: false, weightKg: 12 });
  const intactMale = dog({ id: 'm', name: '흰둥', sex: 'male', neutered: false, weightKg: 13 });

  const w = walk({ hostId: 'f', participantIds: ['f'] });
  const result = checkJoin(w, intactMale, [intactFemale]);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.blockers.some((f) => f.code === 'INTACT_PAIR'));
});

test('경고는 참여를 막지 않고 모아서 알려준다', () => {
  const senior = dog({ id: 'host', name: '할부지', ageMonths: 132, weightKg: 11 });
  const puppy = dog({ id: 'j', name: '새싹', ageMonths: 10, weightKg: 10 });

  const result = checkJoin(walk({ hostId: 'host' }), puppy, [senior]);
  assert.equal(result.ok, true);
  assert.ok(result.ok && result.cautions.some((f) => f.code === 'SENIOR_PUPPY'));
});

test('정원이 차면 못 들어간다', () => {
  const w = walk({ capacity: 2, participantIds: ['host', 'x'] });
  const result = checkJoin(w, dog({ id: 'j', weightKg: 8 }), [host, dog({ id: 'x', weightKg: 9 })]);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason.includes('정원'));
});

test('이미 참여한 산책에는 다시 신청할 수 없다', () => {
  const joiner = dog({ id: 'j', weightKg: 8 });
  const w = walk({ participantIds: ['host', 'j'] });
  const result = checkJoin(w, joiner, [host, joiner]);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason.includes('이미 참여'));
});

test('소그룹 상한은 3명이다', () => {
  // 4명이면 6쌍이 모두 통과해야 하는데 그런 조합은 거의 없다
  assert.equal(MAX_PARTICIPANTS, 3);
});
