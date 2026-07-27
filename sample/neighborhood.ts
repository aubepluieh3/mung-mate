import type { Dog, WalkTime } from '../src/dog.ts';
import type { DistrictGraph } from '../src/reach.ts';
import type { Trail } from '../src/trail.ts';

/** 룰이 실제 목록에서 어떻게 보이는지 눈으로 확인하기 위한 동네 샘플. */

const RECENT = '2026-06-01T00:00:00Z';
const LONG_AGO = '2024-02-01T00:00:00Z';

/** 걸어서 갈 수 있는 동끼리 이어둔다. 실제 서비스라면 행정구역 데이터에서 온다. */
export const districts: DistrictGraph = {
  성산동: ['망원동', '연남동'],
  망원동: ['성산동', '합정동'],
  연남동: ['성산동'],
  합정동: ['망원동'],
};

/**
 * 동과 산책 시간대. 개체마다 흩어놓지 않고 표로 모아둔다 — 누가 누구와 만날 수 있는지 한눈에 보인다.
 * 흰둥은 시간대를 안 적은 견주다.
 */
const WALK_INFO: Record<string, { district: string; walkTimes: WalkTime[] }> = {
  me: { district: '성산동', walkTimes: ['저녁', '밤'] },
  kong: { district: '성산동', walkTimes: ['저녁'] },
  bori: { district: '성산동', walkTimes: ['아침', '저녁'] },
  dubu: { district: '망원동', walkTimes: ['저녁'] },
  bangul: { district: '성산동', walkTimes: ['점심', '저녁'] },
  kkami: { district: '성산동', walkTimes: ['밤'] },
  mungchi: { district: '연남동', walkTimes: ['밤'] },
  byeol: { district: '성산동', walkTimes: ['아침', '저녁'] },
  grandpa: { district: '합정동', walkTimes: ['아침'] },
  nabi: { district: '망원동', walkTimes: ['밤'] },
  choco: { district: '성산동', walkTimes: ['아침', '저녁'] },
  heundung: { district: '연남동', walkTimes: [] },
  saessak: { district: '성산동', walkTimes: ['점심'] },
};

const withWalkInfo = (d: Dog): Dog => ({ ...d, ...WALK_INFO[d.id] });

/** 기준견 — 겁많음을 정직하게 적은 소형견 견주. 우리가 가장 신경 써야 하는 사용자. */
const tori: Dog = {
  id: 'me',
  name: '토리',
  breed: '시츄',
  ageMonths: 40,
  weightKg: 8,
  sex: 'female',
  neutered: true,
  temperaments: ['겁많음'],
  preferences: ['목줄인사부터'],
  temperamentsUpdatedAt: RECENT,
};

export const me: Dog = withWalkInfo(tori);

/** 시점을 바꿔가며 확인하려면 이걸 쓴다. findMatches 가 자기 자신은 걸러낸다. */
export const allDogs = (): Dog[] => [me, ...neighborhood];

const others: Dog[] = [
  {
    id: 'kong',
    name: '콩이',
    breed: '믹스',
    ageMonths: 48,
    weightKg: 9,
    sex: 'male',
    neutered: true,
    temperaments: [], // 프로필을 안 채운 견주
    preferences: [],
    temperamentsUpdatedAt: RECENT,
  },
  {
    id: 'bori',
    name: '보리',
    breed: '말티즈',
    ageMonths: 36,
    weightKg: 7,
    sex: 'female',
    neutered: true,
    temperaments: ['겁많음'],
    preferences: ['1:1만', '목줄인사부터'],
    temperamentsUpdatedAt: RECENT,
  },
  {
    id: 'dubu',
    name: '두부',
    breed: '코카스파니엘',
    ageMonths: 72,
    weightKg: 12,
    sex: 'female',
    neutered: true,
    temperaments: ['차분함'],
    preferences: [],
    temperamentsUpdatedAt: RECENT,
  },
  {
    id: 'bangul',
    name: '방울',
    breed: '포메라니안',
    ageMonths: 24,
    weightKg: 10,
    sex: 'male',
    neutered: true,
    temperaments: ['활발함', '개좋아함'],
    preferences: [],
    temperamentsUpdatedAt: RECENT,
  },
  {
    id: 'kkami',
    name: '까미',
    breed: '닥스훈트',
    ageMonths: 96,
    weightKg: 6,
    sex: 'male',
    neutered: true,
    temperaments: ['짖음많음'],
    preferences: ['1:1만'],
    sensitiveToDogs: true,
    temperamentsUpdatedAt: RECENT,
  },
  {
    id: 'mungchi',
    name: '뭉치',
    breed: '비숑',
    ageMonths: 42,
    weightKg: 8,
    sex: 'male',
    neutered: false,
    temperaments: ['겁많음'],
    preferences: ['1:1만'],
    sensitiveToDogs: true,
    temperamentsUpdatedAt: LONG_AGO, // 2년 넘게 방치된 프로필
  },
  {
    id: 'byeol',
    name: '별이',
    breed: '보더콜리',
    ageMonths: 40,
    weightKg: 20,
    sex: 'female',
    neutered: true,
    temperaments: ['차분함', '개좋아함'],
    preferences: [],
    temperamentsUpdatedAt: RECENT,
  },
  {
    id: 'grandpa',
    name: '할부지',
    breed: '시바',
    ageMonths: 144,
    weightKg: 11,
    sex: 'male',
    neutered: true,
    temperaments: ['차분함'],
    preferences: [],
    temperamentsUpdatedAt: RECENT,
  },
  {
    id: 'nabi',
    name: '나비',
    breed: '진돗개',
    ageMonths: 48,
    weightKg: 15,
    sex: 'female',
    neutered: false,
    temperaments: ['겁많음'],
    preferences: [],
    temperamentsUpdatedAt: RECENT,
  },
  {
    id: 'choco',
    name: '초코',
    breed: '리트리버',
    ageMonths: 60,
    weightKg: 30,
    sex: 'male',
    neutered: false,
    temperaments: ['개좋아함', '활발함'],
    preferences: [],
    temperamentsUpdatedAt: RECENT,
  },
  {
    id: 'heundung',
    name: '흰둥',
    breed: '진돗개',
    ageMonths: 18,
    weightKg: 25,
    sex: 'male',
    neutered: false,
    temperaments: ['활발함'],
    preferences: [],
    temperamentsUpdatedAt: RECENT,
  },
  {
    id: 'saessak',
    name: '새싹',
    breed: '푸들',
    ageMonths: 3,
    weightKg: 4,
    sex: 'female',
    neutered: false,
    temperaments: ['활발함', '개좋아함'],
    preferences: [],
    temperamentsUpdatedAt: RECENT,
  },
];

export const neighborhood: Dog[] = others.map(withWalkInfo);

/** 산책로 샘플. 비어 있으면 첫 사용자가 볼 게 없다. */
export const sampleTrails: Omit<Trail, 'id'>[] = [
  {
    district: '성산동',
    name: '망원한강공원 산책길',
    note: '넓고 평평해서 소형견도 편해요. 주말 오후는 사람이 많습니다.',
    minutes: 40,
    tags: ['배변봉투함있음', '물있음', '차없음', '야간조명있음'],
    createdBy: 'me',
  },
  {
    district: '성산동',
    name: '성미산 둘레길',
    note: '그늘이 많아 여름에 좋아요. 경사가 조금 있어 노견에게는 짧게.',
    minutes: 30,
    tags: ['그늘많음', '차없음'],
    createdBy: 'bori',
  },
  {
    district: '망원동',
    name: '망원시장 뒷길',
    note: '가까워서 밤 산책에 자주 갑니다. 조명이 어두운 구간이 있어요.',
    minutes: 15,
    tags: ['배변봉투함있음'],
    createdBy: 'dubu',
  },
  {
    district: '연남동',
    name: '경의선숲길 반려견 놀이터',
    note: '울타리가 있어 마음이 놓입니다. 체급별로 시간을 나눠 쓰면 좋아요.',
    minutes: 25,
    tags: ['울타리있음', '물있음', '배변봉투함있음', '야간조명있음'],
    createdBy: 'mungchi',
  },
];
