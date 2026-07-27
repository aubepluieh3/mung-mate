/**
 * 산책로.
 *
 * 이 앱의 다른 기능은 전부 상대가 있어야 쓸 수 있다. 동네에 사람이 적으면 할 게 없다.
 * 산책로는 혼자서도 쓸모가 있는 유일한 기능이라, 사용자가 적은 시기를 버티게 해준다.
 *
 * 지도는 붙이지 않았으므로 경로는 그리지 않는다. 동네와 이름, 한줄평, 태그만 받는다.
 */

/**
 * 기획서에 있던 `목줄풀어도됨` 은 넣지 않는다.
 * 동물보호법은 산책 시 목줄을 의무로 두고, 지정된 놀이터 밖에서 풀면 위법이다.
 * 안전을 우선하는 앱이 위법을 권하는 태그를 가질 수는 없다 — `울타리있음` 으로 대신한다.
 */
export type TrailTag =
  | '배변봉투함있음'
  | '물있음'
  | '그늘많음'
  | '차없음'
  | '울타리있음'
  | '야간조명있음';

export const TRAIL_TAGS: TrailTag[] = [
  '배변봉투함있음',
  '물있음',
  '그늘많음',
  '차없음',
  '울타리있음',
  '야간조명있음',
];

export type Trail = {
  id: string;
  district: string;
  name: string;
  /** 한줄평. */
  note: string;
  minutes: number;
  tags: TrailTag[];
  createdBy: string;
};

export type TrailView = {
  id: string;
  name: string;
  /** "성산동 · 30분 코스" */
  subtitle: string;
  note: string;
  tags: TrailTag[];
  /** 내 동네인가. 인접 동은 걸어갈 수 있지만 내 동네가 먼저다. */
  nearby: boolean;
  /** 밤에 걷는 견주에게 조명 정보는 안전 문제다. */
  nightWarning: string;
  /** 카카오맵에서 이 장소를 검색해 여는 주소. */
  mapUrl: string;
};

/**
 * 카카오맵 검색 링크.
 * 지도를 화면에 띄우려면 앱키가 필요하지만, 링크는 키 없이 된다 —
 * "이 산책로가 어디인지"는 이것만으로 해결된다.
 */
export const kakaoMapUrl = (district: string, name: string) =>
  `https://map.kakao.com/link/search/${encodeURIComponent(`${district} ${name}`)}`;

export function toTrailView(trail: Trail, myDistrict: string | undefined, walksAtNight: boolean): TrailView {
  return {
    id: trail.id,
    name: trail.name,
    subtitle: `${trail.district} · ${trail.minutes}분 코스`,
    note: trail.note,
    tags: trail.tags,
    nearby: trail.district === myDistrict,
    nightWarning:
      walksAtNight && !trail.tags.includes('야간조명있음')
        ? '밤에는 어두울 수 있어요. 조명이 있는 길을 먼저 확인해보세요.'
        : '',
    mapUrl: kakaoMapUrl(trail.district, trail.name),
  };
}
