import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGate } from '../src/gate.ts';
import type { Dog } from '../src/dog.ts';

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
  ...over,
});

const codes = (a: Dog, b: Dog) => evaluateGate(a, b).findings.map((f) => f.code);

test('조건이 비슷하면 통과한다', () => {
  const result = evaluateGate(dog({ weightKg: 12 }), dog({ id: 'e', name: '콩이', weightKg: 14 }));
  assert.equal(result.level, 'ok');
  assert.deepEqual(result.findings, []);
});

test('접종 전 강아지는 차단한다', () => {
  const result = evaluateGate(dog(), dog({ id: 'p', name: '아기', ageMonths: 3, weightKg: 4 }));
  assert.equal(result.level, 'block');
  assert.ok(codes(dog(), dog({ ageMonths: 3, weightKg: 4 })).includes('VACCINATION_INCOMPLETE'));
});

test('체급이 3배 이상 차이나면 차단한다', () => {
  const small = dog({ id: 's', name: '토리', weightKg: 4 });
  const big = dog({ id: 'b', name: '바둑', weightKg: 13 });
  const result = evaluateGate(small, big);
  assert.equal(result.level, 'block');
  assert.deepEqual(codes(small, big), ['SIZE_GAP_BLOCK']);
});

test('체급이 2배 이상 3배 미만이면 경고까지만', () => {
  const result = evaluateGate(dog({ weightKg: 12 }), dog({ id: 'b', weightKg: 34 })); // 2.8배
  assert.equal(result.level, 'caution');
  assert.deepEqual(
    result.findings.map((f) => f.code),
    ['SIZE_GAP'],
  );
});

test('체급 판정은 절대 차이가 아니라 비율로 한다', () => {
  // 3kg 대 10kg(7kg 차이)이 30kg 대 40kg(10kg 차이)보다 위험하다
  assert.equal(evaluateGate(dog({ weightKg: 3 }), dog({ id: 'b', weightKg: 10 })).level, 'block');
  assert.equal(evaluateGate(dog({ weightKg: 30 }), dog({ id: 'b', weightKg: 40 })).level, 'ok');
});

test('발정 중 암컷 × 미중성화 수컷은 차단, 중성화 수컷은 경고', () => {
  const inHeat = dog({ id: 'f', name: '보리', sex: 'female', neutered: false, inHeat: true });
  const intact = dog({ id: 'm', name: '초코', neutered: false });
  const fixed = dog({ id: 'm2', name: '두부', neutered: true });

  assert.equal(evaluateGate(inHeat, intact).level, 'block');
  assert.deepEqual(codes(inHeat, intact), ['IN_HEAT_INTACT_MALE']);
  assert.equal(evaluateGate(inHeat, fixed).level, 'caution');
  assert.deepEqual(codes(inHeat, fixed), ['IN_HEAT']);
});

test('발정 중이면 상대가 암컷이어도 경고한다', () => {
  // 암컷끼리 페로몬 위험은 없지만, 산책로에서 수컷을 만나는 건 막을 수 없다
  const inHeat = dog({ id: 'f', name: '나비', sex: 'female', neutered: false, inHeat: true });
  const otherFemale = dog({ id: 'f2', name: '토리', sex: 'female', neutered: true, weightKg: 13 });

  const result = evaluateGate(inHeat, otherFemale);
  assert.equal(result.level, 'caution');
  assert.deepEqual(codes(inHeat, otherFemale), ['IN_HEAT']);
  assert.match(result.findings[0].message, /조용한 시간대/);
});

test('중성화한 암컷은 발정 룰에 걸리지 않는다', () => {
  const spayed = dog({ id: 'f', sex: 'female', neutered: true, inHeat: true });
  assert.deepEqual(codes(spayed, dog({ neutered: false })), []);
});

test('미중성화 성견 수컷끼리는 경고', () => {
  const a = dog({ id: 'a', neutered: false });
  const b = dog({ id: 'b', name: '흰둥', neutered: false, weightKg: 13 });
  assert.deepEqual(codes(a, b), ['INTACT_MALES']);
});

test('노견 × 퍼피는 경고', () => {
  const senior = dog({ id: 'o', name: '할부지', ageMonths: 132 });
  const puppy = dog({ id: 'y', name: '새싹', ageMonths: 8, weightKg: 11 });
  assert.deepEqual(codes(senior, puppy), ['SENIOR_PUPPY']);
});

test('경고가 여러 개면 모두 모인다', () => {
  const senior = dog({ id: 'o', name: '할부지', ageMonths: 132, weightKg: 30 });
  const puppy = dog({ id: 'y', name: '새싹', ageMonths: 10, weightKg: 14 });
  const result = evaluateGate(senior, puppy);
  assert.equal(result.level, 'caution');
  assert.deepEqual(result.findings.map((f) => f.code).sort(), ['SENIOR_PUPPY', 'SIZE_GAP']);
});

test('퍼피는 미중성화 수컷 기싸움 룰에 걸리지 않는다', () => {
  // 성견 기준(12개월)을 넘지 않으므로 SENIOR_PUPPY 와 INTACT_MALES 는 동시에 나올 수 없다
  const senior = dog({ id: 'o', ageMonths: 132, weightKg: 14, neutered: false });
  const puppy = dog({ id: 'y', ageMonths: 10, weightKg: 13, neutered: false });
  assert.deepEqual(codes(senior, puppy), ['SENIOR_PUPPY']);
});

test('미중성화 성견 수컷 + 체급차는 경고가 겹친다', () => {
  const a = dog({ id: 'a', weightKg: 12, neutered: false });
  const b = dog({ id: 'b', name: '곰이', weightKg: 30, neutered: false });
  assert.deepEqual(codes(a, b).sort(), ['INTACT_MALES', 'SIZE_GAP']);
});

test('순서를 바꿔도 판정이 같다', () => {
  const pairs: [Dog, Dog][] = [
    [dog({ weightKg: 3 }), dog({ id: 'b', weightKg: 30 })],
    [dog({ ageMonths: 2 }), dog({ id: 'b', ageMonths: 60 })],
    [
      dog({ id: 'f', sex: 'female', neutered: false, inHeat: true }),
      dog({ id: 'm', neutered: false }),
    ],
    [dog({ ageMonths: 130 }), dog({ id: 'y', ageMonths: 6, weightKg: 11 })],
  ];
  for (const [a, b] of pairs) {
    assert.deepEqual(evaluateGate(a, b), evaluateGate(b, a));
  }
});

test('성향 태그는 게이트 판정에 영향을 주지 않는다', () => {
  const base = dog({ temperaments: [] });
  const tagged = dog({ temperaments: ['겁많음', '짖음많음'] });
  const other = dog({ id: 'x', name: '까미', weightKg: 13, temperaments: ['활발함'] });
  assert.deepEqual(evaluateGate(base, other), evaluateGate(tagged, other));
});
