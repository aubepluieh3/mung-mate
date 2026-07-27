import type { Dog, WalkTime } from './dog.ts';
import { evaluateGate, type GateFinding } from './gate.ts';
import { subj } from './josa.ts';

/**
 * 산책 약속.
 *
 * 개↔개 매칭만으로는 만날 상대가 부족했다(측정: 평균 가능률 28%, 3명은 0명).
 * 동네와 시간대가 안 맞으면 궁합이 좋아도 못 만나기 때문이다.
 * 일정이 사람을 모으면 그 제약이 풀린다 — 평소 시간대가 달라도 그날 그 시간엔 나올 수 있다.
 *
 * 궁합은 참여 신청 시점에 본다. 이미 참여한 개들과 신청자를 전부 쌍으로 검사하므로,
 * 1:1 판정만 있는 엔진으로도 그룹 안전을 판단할 수 있다.
 */

/** 소그룹까지만 받는다. 참여자가 늘면 검사할 쌍이 제곱으로 늘고 전원이 맞을 확률은 급격히 떨어진다. */
export const MAX_PARTICIPANTS = 3;

export type Walk = {
  id: string;
  /** 일정을 만든 강아지. 만든 사람도 참여자다. */
  hostId: string;
  district: string;
  /** 'YYYY-MM-DD' */
  date: string;
  time: WalkTime;
  /** "망원한강공원 입구" — 공개된 장소를 권한다. */
  place: string;
  minutes: number;
  capacity: number;
  participantIds: string[];
};

export type JoinCheck =
  | { ok: true; cautions: GateFinding[] }
  | { ok: false; reason: string; blockers: GateFinding[] };

/**
 * 이 강아지가 이 모임에 들어갈 수 있는지 본다.
 * 참여자 전원과 1:1 로 검사한다 — 한 쌍이라도 차단이면 들어갈 수 없다.
 */
export function checkJoin(walk: Walk, joiner: Dog, participants: Dog[]): JoinCheck {
  if (walk.participantIds.includes(joiner.id)) {
    return { ok: false, reason: '이미 참여한 산책이에요.', blockers: [] };
  }
  if (walk.participantIds.length >= walk.capacity) {
    return { ok: false, reason: '정원이 찼어요.', blockers: [] };
  }

  const results = participants.map((other) => ({ other, gate: evaluateGate(joiner, other) }));
  const blocked = results.filter((r) => r.gate.level === 'block');

  if (blocked.length > 0) {
    const names = blocked.map((r) => r.other.name).join(', ');
    return {
      ok: false,
      reason: `${subj(names)} 함께 걷기 어려운 조합이라 참여할 수 없어요.`,
      blockers: blocked.flatMap((r) => r.gate.findings.filter((f) => f.level === 'block')),
    };
  }

  return { ok: true, cautions: results.flatMap((r) => r.gate.findings) };
}
