export type Sex = 'male' | 'female';

/** 주로 산책하는 시간대. 실제로 만날 수 있는지를 가르는 값이다. */
export type WalkTime = '아침' | '점심' | '저녁' | '밤';

export const WALK_TIMES: WalkTime[] = ['아침', '점심', '저녁', '밤'];

/**
 * 판정에 쓰는 값만 받는다.
 *
 * 성향(활발함·겁많음 같은 것)은 받지 않는다. 견주 진술이라 판정에 쓸 수 없고,
 * 판정에 안 쓰는 정보를 물어보면 견주는 "이걸 왜 적나" 싶다.
 * 발정 여부도 받지 않는다 — 켜고 끄는 걸 기억해야 하는 상태는 프로필에 둘 수 없다.
 */
export type Dog = {
  id: string;
  name: string;
  breed: string;
  ageMonths: number;
  weightKg: number;
  sex: Sex;
  neutered: boolean;
  /** 활동하는 동 이름. 정확한 주소는 받지 않는다 — 동 단위까지만. */
  district?: string;
  walkTimes?: WalkTime[];
};

/**
 * 나이를 견주가 말하는 방식으로 적는다.
 * 살로만 쓰면 6개월 강아지가 "0살"이 된다. 퍼피는 개월이 판정을 가르는 값이다
 * (4개월 미만은 접종 전이라 차단).
 */
export const formatAge = (ageMonths: number): string => {
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  if (years === 0) return `${months}개월`;
  if (years < 2 && months > 0) return `${years}살 ${months}개월`;
  return `${years}살`;
};
