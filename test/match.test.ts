import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyMessage, findMatches, type Verdict } from '../src/match.ts';
import { formatAge, type Dog } from '../src/dog.ts';

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
  ...over,
});

/** 우리 개와 상대 하나를 견주어 판정만 꺼낸다. */
const judge = (me: Dog, other: Dog) => findMatches(me, [{ ...other, id: 'other' }])[0];
const verdict = (me: Dog, other: Dog): Verdict => judge(me, other).verdict;

test('조건이 비슷하면 만나도 좋다', () => {
  const m = judge(dog(), dog({ weightKg: 14 }));
  assert.equal(m.verdict, 'ok');
  assert.deepEqual(m.reasons, []);
  assert.equal(m.reachable, true);
});

test('접종 전 강아지는 차단한다', () => {
  const m = judge(dog(), dog({ name: '아기', ageMonths: 3, weightKg: 11 }));
  assert.equal(m.verdict, 'blocked');
  assert.match(m.reasons[0], /예방접종/);
});

test('체급은 절대 차이가 아니라 비율로 본다', () => {
  // 3kg 대 10kg(7kg 차이)이 30kg 대 40kg(10kg 차이)보다 위험하다
  assert.equal(verdict(dog({ weightKg: 3 }), dog({ weightKg: 10 })), 'blocked');
  assert.equal(verdict(dog({ weightKg: 30 }), dog({ weightKg: 40 })), 'ok');
});

test('체급 2배는 경고, 3배는 차단', () => {
  assert.equal(verdict(dog({ weightKg: 12 }), dog({ weightKg: 25 })), 'caution');
  assert.equal(verdict(dog({ weightKg: 12 }), dog({ weightKg: 36 })), 'blocked');
});

test('중성화하지 않은 암수는 차단한다', () => {
  // 발정기가 겹치는 시점을 알 수 없고, 원치 않는 임신은 되돌릴 수 없다
  const m = judge(
    dog({ name: '나비', sex: 'female', neutered: false }),
    dog({ name: '초코', sex: 'male', neutered: false, weightKg: 13 }),
  );
  assert.equal(m.verdict, 'blocked');
  assert.match(m.reasons[0], /원치 않는 임신/);
});

test('한쪽이라도 중성화했으면 차단하지 않는다', () => {
  const me = dog({ sex: 'female', neutered: false });
  assert.equal(verdict(me, dog({ sex: 'male', neutered: true, weightKg: 13 })), 'ok');
});

test('미중성화 성견 수컷끼리는 경고', () => {
  const m = judge(dog({ neutered: false }), dog({ neutered: false, weightKg: 13 }));
  assert.equal(m.verdict, 'caution');
  assert.match(m.reasons[0], /기싸움/);
});

test('노견 × 퍼피는 경고', () => {
  const m = judge(
    dog({ name: '할부지', ageMonths: 144 }),
    dog({ name: '새싹', ageMonths: 8, weightKg: 11 }),
  );
  assert.equal(m.verdict, 'caution');
  assert.match(m.reasons[0], /노견/);
});

test('차단이면 차단 사유만 남긴다 — 부가 경고에 묻히면 안 된다', () => {
  // 접종 미완료(차단) + 체급 2.75배(경고)가 같이 걸리는 조합
  const m = judge(dog({ weightKg: 11 }), dog({ name: '새싹', ageMonths: 3, weightKg: 4 }));
  assert.equal(m.verdict, 'blocked');
  assert.equal(m.reasons.length, 1);
  assert.match(m.reasons[0], /예방접종/);
});

test('경고는 여러 개면 모두 보여준다', () => {
  const m = judge(
    dog({ name: '할부지', ageMonths: 144, weightKg: 11 }),
    dog({ name: '새싹', ageMonths: 10, weightKg: 25 }),
  );
  assert.equal(m.verdict, 'caution');
  assert.equal(m.reasons.length, 2);
});

test('판정은 순서를 바꿔도 같다', () => {
  const pairs: [Dog, Dog][] = [
    [dog({ weightKg: 3 }), dog({ weightKg: 30 })],
    [dog({ ageMonths: 2 }), dog({ ageMonths: 60 })],
    [dog({ sex: 'female', neutered: false }), dog({ neutered: false })],
    [dog({ ageMonths: 130 }), dog({ ageMonths: 6, weightKg: 11 })],
  ];
  for (const [a, b] of pairs) {
    assert.equal(judge(a, b).verdict, judge(b, a).verdict);
  }
});

test('같은 동에 시간대가 겹쳐야 만날 수 있다', () => {
  const me = dog({ district: '성산동', walkTimes: ['저녁', '밤'] });

  assert.equal(judge(me, dog({ district: '성산동', walkTimes: ['저녁'] })).reachable, true);
  assert.equal(judge(me, dog({ district: '망원동', walkTimes: ['저녁'] })).reachable, false);
  assert.equal(judge(me, dog({ district: '성산동', walkTimes: ['아침'] })).reachable, false);
  assert.equal(judge(me, dog({ district: '성산동', walkTimes: [] })).reachable, false);
  assert.equal(judge(me, dog({ district: undefined })).reachable, false);
});

test('못 만나는 이유가 거리인지 시간대인지 구분해서 말한다', () => {
  const me = dog({ district: '성산동', walkTimes: ['저녁'] });
  assert.match(judge(me, dog({ district: '망원동' })).when, /망원동에 살아요/);
  assert.match(judge(me, dog({ walkTimes: ['아침'] })).when, /시간대가 겹치지 않아요/);
  assert.match(judge(me, dog({ walkTimes: [] })).when, /시간대를 아직 안 적었어요/);
  assert.match(judge(me, dog({ walkTimes: ['저녁'] })).when, /저녁에 함께 걸어요/);
});

test('차단은 만날 수 있든 없든 맨 아래로 내린다', () => {
  // 같은 동이라고 차단을 위로 올리면 절대 만나면 안 되는 상대가 목록 앞에 온다
  const me = dog({ name: '토리', weightKg: 8, district: '성산동', walkTimes: ['저녁'] });
  const list = findMatches(me, [
    dog({ id: 'big', name: '큰개', weightKg: 30 }), // 같은 동·시간 겹침이지만 차단
    dog({ id: 'far', name: '먼개', weightKg: 9, district: '망원동' }), // 못 만나지만 조합은 괜찮다
    dog({ id: 'good', name: '맞는개', weightKg: 9 }), // 만날 수 있음
  ]);
  assert.deepEqual(
    list.map((m) => m.dog.name),
    ['맞는개', '먼개', '큰개'],
  );
});

test('만날 수 있는 상대를 못 만나는 상대보다 위에 둔다', () => {
  const me = dog({ name: '토리', weightKg: 8, district: '성산동', walkTimes: ['저녁'] });
  const list = findMatches(me, [
    dog({ id: 'far', name: '먼개', weightKg: 9, district: '망원동' }),
    dog({ id: 'near', name: '가까운개', weightKg: 15 }), // 체급 경고가 있어도 만날 수 있다
  ]);
  assert.deepEqual(
    list.map((m) => m.dog.name),
    ['가까운개', '먼개'],
  );
});

test('자기 자신은 목록에 없다', () => {
  const me = dog({ id: 'me' });
  assert.equal(findMatches(me, [me, dog({ id: 'x', weightKg: 13 })]).length, 1);
});

test('만날 친구가 없으면 왜 없는지 알려준다', () => {
  const base = dog({ id: 'me', name: '토리' });
  assert.match(emptyMessage({ ...base, district: undefined }, []), /동네를 고르면/);
  assert.match(emptyMessage({ ...base, walkTimes: [] }, []), /시간대를 고르면/);
  assert.match(emptyMessage({ ...base, ageMonths: 3 }, []), /예방접종/);

  const blocked = findMatches(base, [dog({ id: 'b', weightKg: 40 })]);
  assert.match(emptyMessage(base, blocked), /권할 친구가 없어요/);
  assert.match(emptyMessage(base, []), /성산동에 같은 시간대/);
});

test('나이는 견주가 말하는 방식으로 적는다', () => {
  // 살로만 쓰면 6개월 강아지가 "0살"이 된다. 퍼피는 개월이 판정을 가르는 값이다
  assert.equal(formatAge(3), '3개월');
  assert.equal(formatAge(12), '1살');
  assert.equal(formatAge(18), '1살 6개월');
  assert.equal(formatAge(30), '2살');
});
