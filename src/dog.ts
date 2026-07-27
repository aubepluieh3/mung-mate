export type Sex = 'male' | 'female';

/** 성향 태그 — 견주 진술이라 점수(순위)에만 쓴다. 차단 판정에는 쓰지 않는다. */
export type Temperament =
  | '활발함'
  | '차분함'
  | '개좋아함'
  | '사람좋아'
  | '겁많음'
  | '짖음많음';

/** 견주가 원하는 만남 조건. 필터로 쓰되 안전 신호로는 해석하지 않는다. */
export type MeetPreference = '1:1만' | '비슷한체급만' | '조용한친구만' | '목줄인사부터';

/** 주로 산책하는 시간대. 실제로 만날 수 있는지를 가르는 값이다. */
export type WalkTime = '아침' | '점심' | '저녁' | '밤';

export type Dog = {
  id: string;
  name: string;
  breed: string;
  ageMonths: number;
  weightKg: number;
  sex: Sex;
  neutered: boolean;
  /** 미중성화 암컷만 의미가 있다. 켜두면 수컷과의 만남을 막는다. */
  inHeat?: boolean;
  /** 활동하는 동 이름. 정확한 주소는 받지 않는다 — 동 단위까지만. */
  district?: string;
  /** 주로 산책하는 시간대. 비어 있으면 만날 수 있는지 판단할 수 없다. */
  walkTimes?: WalkTime[];
  temperaments: Temperament[];
  preferences: MeetPreference[];
  /**
   * "우리 개는 낯선 개에게 예민해요."
   * 체크하면 같은 처지의 견주와 우선 매칭된다 — 정직하게 적을 이유를 만들어주기 위한 항목이다.
   * 낙인 태그로 쓰지 않는다.
   */
  sensitiveToDogs?: boolean;
  /** 성향 태그를 마지막으로 확인한 시각(ISO). 오래되면 점수에서 신뢰를 낮춘다. */
  temperamentsUpdatedAt?: string;
};
