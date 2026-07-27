import type { Dog, WalkTime } from './dog.ts';

/**
 * 실제로 만날 수 있는지 판정한다.
 *
 * 궁합보다 이게 먼저다 — 못 만나는 90점은 쓸모가 없다.
 * 정확한 위치는 쓰지 않는다. 동 이름과 산책 시간대만으로 판단한다.
 */

/**
 * 동 사이의 인접 관계.
 *
 * 인접을 사람이 손으로 적어야 하므로 서비스 지역을 넓힐 수 없다.
 * 그래서 지금은 한 지역(마포구 일부)만 운영하고, 그 사실을 화면에서 분명히 알린다 —
 * 목록에 자기 동네가 없는 견주가 이유를 모르고 떠나면 안 된다.
 *
 * 지역을 넓히려면 좌표로 거리를 계산해야 한다(인접 관계를 데이터로 안 갖고 계산으로 푼다).
 */
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

/**
 * 두 동네 사이의 거리. 인접 관계는 양방향으로 본다 —
 * 그래프에 한쪽만 적혀 있어도 걸어갈 수 있는 건 마찬가지다.
 *
 * 이 판정을 여러 곳에 복붙하면 안 된다. 한쪽은 양방향, 한쪽은 단방향으로 갈리면
 * 산책 친구 목록과 산책로 목록이 같은 데이터로 다른 답을 낸다.
 */
export const districtDistance = (
  a: string | undefined,
  b: string | undefined,
  graph: DistrictGraph,
): Distance => {
  if (!a || !b) return 'unknown';
  if (a === b) return 'same';
  return graph[a]?.includes(b) || graph[b]?.includes(a) ? 'near' : 'far';
};

/** 걸어갈 수 있는 거리인가. */
export const isWalkable = (a: string | undefined, b: string | undefined, graph: DistrictGraph) => {
  const d = districtDistance(a, b, graph);
  return d === 'same' || d === 'near';
};

const distanceOf = (a: Dog, b: Dog, graph: DistrictGraph): Distance =>
  districtDistance(a.district, b.district, graph);

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
