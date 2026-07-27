import type { Dog } from './dog.ts';
import { evaluateGate, type GateResult } from './gate.ts';
import { computeScore, type Factor, type TagPair } from './score.ts';
import { evaluateReach, type DistrictGraph, type Reach } from './reach.ts';

/**
 * 게이트, 만날 수 있는지, 궁합 점수를 합쳐 후보 목록을 만든다.
 *
 * 그룹 순서가 곧 화면 순서다.
 * 만날 수 있는지가 궁합보다 먼저다 — 못 만나는 90점은 쓸모가 없다.
 *
 * 차단된 상대도 목록에서 지우지 않는다. 맨 아래로 내리고, 요청만 잠그고, 이유를 붙인다.
 * 왜 안 보이는지 모르면 견주는 앱의 판단을 신뢰하지 않는다.
 * 단, 차단된 상대에게는 점수를 보여주지 않는다. "차단 45점"은 혼란만 준다.
 */

/**
 * 그룹은 "만날 수 있는가"로만 나눈다.
 *
 * 성향 미기재를 별도 그룹으로 빼면 "먼 동네인데 성향 적은 사람"이
 * "같은 동인데 성향 안 적은 사람"보다 위로 올라가서 원칙이 뒤집힌다.
 * 성향 미기재는 그룹 안에서 아래로 내리고, 카드 문구로 알린다.
 */
export type MatchGroup =
  /** 같은/인접 동에 산책 시간대가 겹친다 */
  | 'reachable'
  /** 동네나 시간대가 안 맞는다 */
  | 'far'
  /** 게이트 차단 */
  | 'blocked';

export type MatchCandidate = {
  dog: Dog;
  group: MatchGroup;
  gate: GateResult;
  reach: Reach;
  /** 차단된 상대와 정보가 없는 상대는 null. */
  score: number | null;
  /** 물리 계수를 곱하기 전의 태그 궁합. 점수가 낮은 원인이 성향인지 체급인지 구분하는 데 쓴다. */
  tagFit: number | null;
  pairs: TagPair[];
  factors: Factor[];
  tagTrust: number;
  requestable: boolean;
};

export type MatchOptions = {
  now?: Date;
  districts?: DistrictGraph;
};

const GROUP_ORDER = { reachable: 0, far: 1, blocked: 2 } as const;

export function findMatches(
  me: Dog,
  others: Dog[],
  { now = new Date(), districts = {} }: MatchOptions = {},
): MatchCandidate[] {
  return others
    .filter((other) => other.id !== me.id)
    .map((other): MatchCandidate => {
      const gate = evaluateGate(me, other);
      const blocked = gate.level === 'block';
      const reach = evaluateReach(me, other, districts);
      const { score, tagFit, pairs, factors, tagTrust } = computeScore(me, other, now);

      const group: MatchGroup = blocked ? 'blocked' : reach.reachable ? 'reachable' : 'far';

      return {
        dog: other,
        group,
        // 차단이면 차단 사유만 남긴다. 부가 경고까지 나열하면 정작 중요한 이유가 묻힌다
        gate: blocked
          ? { ...gate, findings: gate.findings.filter((f) => f.level === 'block') }
          : gate,
        reach,
        // 차단이면 점수를 계산했더라도 노출하지 않는다
        score: blocked ? null : score,
        tagFit: blocked ? null : tagFit,
        pairs: blocked ? [] : pairs,
        factors: blocked ? [] : factors,
        tagTrust,
        requestable: !blocked,
      };
    })
    .sort(
      (a, b) =>
        GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
        // 성향을 안 적은 상대는 순위를 매길 수 없으니 그룹 안에서 맨 아래로
        Number(a.score === null) - Number(b.score === null) ||
        (b.score ?? 0) - (a.score ?? 0) ||
        a.dog.name.localeCompare(b.dog.name, 'ko'),
    );
}
