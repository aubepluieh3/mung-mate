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
  /**
   * 발정 여부는 받지 않는다.
   *
   * 발정은 6개월에 한 번 2~3주 오는 '상태'인데 프로필 체크박스는 '속성'이다.
   * 끄는 걸 잊으면 11개월 동안 부당하게 차단되고, 켜는 걸 잊으면 위험이 그대로 노출된다.
   * 게다가 체크하면 매칭이 줄어드니, 발정기에는 앱을 안 켜는 게 견주의 합리적 선택이 된다
   * — 정직하게 적은 소수에게만 불이익이 가는 구조다.
   *
   * 그래서 중성화 여부(바꿔 적을 이유가 없는 사실)만 보고 판정한다.
   */

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
