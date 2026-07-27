import type { Dog, WalkTime } from './dog.ts';

/**
 * 실제로 만날 수 있는지 판정한다.
 *
 * 궁합보다 이게 먼저다 — 못 만나는 90점은 쓸모가 없다.
 * 정확한 위치는 쓰지 않는다. 동 이름과 산책 시간대만으로 판단한다.
 */

/** 동 사이의 인접 관계. 실제 서비스라면 행정구역 데이터에서 오고, 지금은 동네 샘플이 넘겨준다. */
export type DistrictGraph = Record<string, string[]>;

export type Distance =
  /** 같은 동 */
  | 'same'
  /** 인접한 동 */
  | 'near'
  /** 걸어가기 어려운 거리 */
  | 'far'
  /** 한쪽이라도 동을 안 적었다 */
  | 'unknown';

export type Reach = {
  distance: Distance;
  sharedTimes: WalkTime[];
  /** 시간대를 한쪽이라도 안 적었으면 true. 겹치지 않는 것과 구분한다. */
  timesUnknown: boolean;
  /** 같은/인접 동이고 시간대가 겹치는가. */
  reachable: boolean;
};

const distanceOf = (a: Dog, b: Dog, graph: DistrictGraph): Distance => {
  if (!a.district || !b.district) return 'unknown';
  if (a.district === b.district) return 'same';
  const adjacent = graph[a.district]?.includes(b.district) || graph[b.district]?.includes(a.district);
  return adjacent ? 'near' : 'far';
};

/** 겹치는 시간대를 하루 순서로 고정한다. 프로필에 적힌 순서에 결과가 좌우되면 안 된다. */
const TIME_ORDER: WalkTime[] = ['아침', '점심', '저녁', '밤'];

export function evaluateReach(a: Dog, b: Dog, graph: DistrictGraph = {}): Reach {
  const distance = distanceOf(a, b, graph);
  const timesUnknown = !a.walkTimes?.length || !b.walkTimes?.length;
  const sharedTimes = timesUnknown
    ? []
    : TIME_ORDER.filter((t) => a.walkTimes!.includes(t) && b.walkTimes!.includes(t));

  return {
    distance,
    sharedTimes,
    timesUnknown,
    reachable: (distance === 'same' || distance === 'near') && sharedTimes.length > 0,
  };
}
