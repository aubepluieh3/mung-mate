import type { Dog } from './dog.ts';
import { evaluateGate, type GateResult } from './gate.ts';
import { computeScore, type Factor, type TagPair } from './score.ts';

/**
 * 게이트와 점수를 붙여 후보 목록을 만든다.
 *
 * 차단된 상대도 목록에서 지우지 않는다 — 맨 아래로 내리고, 요청만 잠그고, 이유를 붙인다.
 * 왜 안 보이는지 모르면 견주는 앱의 판단을 신뢰하지 않는다.
 * 단, 차단된 상대에게는 점수를 보여주지 않는다. "차단 45점"은 혼란만 준다.
 */

export type MatchGroup =
  /** 게이트 통과 + 점수 있음 */
  | 'match'
  /** 게이트는 통과했지만 태그 정보가 없어 순위를 매길 수 없음 */
  | 'unknown'
  /** 게이트 차단 */
  | 'blocked';

export type MatchCandidate = {
  dog: Dog;
  group: MatchGroup;
  gate: GateResult;
  /** 차단된 상대와 정보가 없는 상대는 null. */
  score: number | null;
  pairs: TagPair[];
  factors: Factor[];
  tagTrust: number;
  requestable: boolean;
};

const GROUP_ORDER = { match: 0, unknown: 1, blocked: 2 } as const;

export function findMatches(me: Dog, others: Dog[], now: Date = new Date()): MatchCandidate[] {
  return others
    .filter((other) => other.id !== me.id)
    .map((other): MatchCandidate => {
      const gate = evaluateGate(me, other);
      const blocked = gate.level === 'block';
      const { score, pairs, factors, tagTrust } = computeScore(me, other, now);

      const group: MatchGroup = blocked ? 'blocked' : score === null ? 'unknown' : 'match';
      return {
        dog: other,
        group,
        // 차단이면 차단 사유만 남긴다. 부가 경고까지 나열하면 정작 중요한 이유가 묻힌다
        gate: blocked
          ? { ...gate, findings: gate.findings.filter((f) => f.level === 'block') }
          : gate,
        // 차단이면 점수를 계산했더라도 노출하지 않는다
        score: blocked ? null : score,
        pairs: blocked ? [] : pairs,
        factors: blocked ? [] : factors,
        tagTrust,
        requestable: !blocked,
      };
    })
    .sort(
      (a, b) =>
        GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
        (b.score ?? 0) - (a.score ?? 0) ||
        a.dog.name.localeCompare(b.dog.name, 'ko'),
    );
}
