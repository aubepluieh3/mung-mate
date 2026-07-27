import type { Dog } from './dog.ts';
import type { MatchCandidate, MatchGroup } from './match.ts';
import { conj, topic } from './josa.ts';

/**
 * 후보를 견주에게 보여줄 형태로 바꾼다.
 *
 * 점수와 계산식은 여기서 잘라낸다. 이유가 둘 있다.
 * 1. 견주는 자기 개가 "38점"으로 보인다는 걸 알게 된다. 사람 기분을 상하게 하고, 개를 서열화한다
 * 2. 산식이 노출되면 태그를 역설계한다 — 유리한 태그만 골라 적게 된다
 * 점수는 정렬에만 쓰고, 밖으로는 등급과 문장만 내보낸다.
 */

/**
 * 등급 단계. 화면이 등급 '문구'를 문자열로 비교하지 않게 따로 내보낸다.
 * `low` 는 목록에서 한 줄로 접어도 되는 단계다.
 */
export type MatchTier = 'good' | 'fine' | 'careful' | 'low' | 'unknown' | 'blocked';

export type MatchView = {
  /** 요청 상태 같은 걸 붙일 때 이름 대신 이걸 쓴다. 동명이 있을 수 있다. */
  id: string;
  name: string;
  /** "말티즈 · 7kg · 3살" */
  subtitle: string;
  tier: MatchTier;
  /** "같은 동 · 저녁에 함께 걸어요" — 만날 수 있는지가 궁합보다 먼저 보여야 한다. */
  reach: string;
  verdict: string;
  /** 이 친구가 좋은 이유 한 줄. 없을 수도 있다. */
  highlight?: string;
  /** 미리 알아둘 점. 최대 두 줄까지만 — 더 나열하면 아무것도 안 읽는다. */
  watchOuts: string[];
  /** 점수와 무관하게 항상 붙는 첫 만남 안내. 룰이 놓친 건 절차가 잡는다. */
  guidance: string;
  requestable: boolean;
  /** 이미 산책 요청을 보낸 상대인가. */
  requested: boolean;
};

const VERDICTS: { min: number; label: string; tier: MatchTier }[] = [
  { min: 75, label: '잘 맞을 것 같아요', tier: 'good' },
  { min: 50, label: '괜찮은 편이에요', tier: 'fine' },
  { min: 30, label: '천천히 만나보세요', tier: 'careful' },
  { min: 0, label: '', tier: 'low' }, // 최하 등급은 원인에 따라 문구가 갈린다
];

const MAX_WATCH_OUTS = 2;
/** 태그 궁합의 중립값. 여기서 얼마나 내려왔는지가 성향으로 인한 손실이다. */
const NEUTRAL_TAG_FIT = 50;

/** 차단 사유별로 다음에 뭘 하면 되는지 알려준다. 막기만 하면 견주는 앱을 떠난다. */
const ALTERNATIVE: Record<string, string> = {
  VACCINATION_INCOMPLETE: '접종을 마친 뒤에 다시 만나보세요.',
  SIZE_GAP_BLOCK: '체급이 비슷한 친구부터 찾아보시는 걸 권해요.',
  IN_HEAT_INTACT_MALE: '발정이 끝난 뒤에 다시 확인해보세요.',
};

const verdictOf = (m: MatchCandidate): { tier: MatchTier; verdict: string } => {
  if (m.group === 'blocked') return { tier: 'blocked', verdict: '이 조합은 권하지 않아요' };
  if (m.score === null) return { tier: 'unknown', verdict: '아직 성향을 적지 않은 친구예요' };

  const base = VERDICTS.findIndex((v) => m.score! >= v.min);
  // 등급을 한 단계 내리는 경우:
  // - 안전 경고가 붙었다. 점수가 높다고 안내를 완화하면 그 방심이 사고를 만든다
  // - 만날 수 없다. "잘 맞을 것 같아요"는 만날 수 있다는 기대를 준다
  const demote = m.gate.findings.length > 0 || m.group === 'far';
  const index = Math.min(base + (demote ? 1 : 0), VERDICTS.length - 1);
  const { tier, label } = VERDICTS[index];

  if (tier === 'low') {
    // 성향은 맞는데 체급·나이 때문에 점수가 깎인 경우까지 "성향이 다르다"고 하면
    // 견주에게 틀린 이유를 알려주는 것이다. 어느 쪽이 더 깎았는지 비교한다.
    const byTemperament = Math.max(0, NEUTRAL_TAG_FIT - m.tagFit!);
    const byCondition = m.tagFit! - m.score!;
    return {
      tier,
      verdict: byTemperament >= byCondition ? '성향이 많이 달라요' : '조건 차이가 커요',
    };
  }
  return { tier, verdict: label };
};

const DISTANCE_LABEL = { same: '같은 동', near: '옆 동네', far: '먼 동네', unknown: '' } as const;

/**
 * 만날 수 있는지를 한 줄로 만든다.
 * 못 만나는 이유가 거리인지 시간대인지 구분해서 말한다 — 견주가 할 수 있는 일이 다르다.
 */
const reachOf = (m: MatchCandidate): string => {
  const { distance, sharedTimes, timesUnknown } = m.reach;

  if (distance === 'unknown') return '동네를 아직 안 적은 친구예요';
  if (distance === 'far') return `${DISTANCE_LABEL.far}에 살아요`;
  if (timesUnknown) return `${DISTANCE_LABEL[distance]} · 산책 시간대를 아직 안 적었어요`;
  if (sharedTimes.length === 0) return `${DISTANCE_LABEL[distance]} · 산책 시간대가 겹치지 않아요`;
  return `${DISTANCE_LABEL[distance]} · ${sharedTimes.join(', ')}에 함께 걸어요`;
};

const guidanceOf = (m: MatchCandidate): string => {
  if (m.group === 'blocked') {
    const reason = m.gate.findings.find((f) => ALTERNATIVE[f.code]);
    return reason ? ALTERNATIVE[reason.code] : '지금은 다른 친구를 찾아보시는 걸 권해요.';
  }
  if (m.score === null) {
    return '성향을 알 수 없으니, 목줄을 하고 짧게 인사만 해보세요.';
  }
  return '첫 만남은 목줄을 하고 15분 정도 인사만 해보세요.';
};

/**
 * 미리 알아둘 점을 모은다.
 * 게이트 경고가 가장 중요하고, 그다음이 성향 충돌, 마지막이 체급·나이 차이다.
 */
const watchOutsOf = (m: MatchCandidate): string[] => {
  // 차단된 조합에도 이유를 보여준다. 대안만 주고 이유를 숨기면 견주는 판단을 신뢰하지 않고,
  // 무엇이 위험한지 배우지도 못한다. 차단이면 match 단계에서 이미 차단 사유만 남아 있다.
  const fromGate = m.gate.findings.map((f) => f.message);
  const fromTags = [...m.pairs]
    .filter((p) => p.delta < 0 && p.note)
    .sort((a, b) => a.delta - b.delta)
    .map((p) => p.note!);
  const fromFactors = [...m.factors]
    .sort((a, b) => a.multiplier - b.multiplier)
    .map((f) => f.note);

  return [...new Set([...fromGate, ...fromTags, ...fromFactors])].slice(0, MAX_WATCH_OUTS);
};

const highlightOf = (m: MatchCandidate): string | undefined => {
  if (m.group === 'blocked' || m.score === null) return undefined;
  return [...m.pairs].filter((p) => p.delta > 0 && p.note).sort((a, b) => b.delta - a.delta)[0]
    ?.note;
};

export function toView(m: MatchCandidate, requested = false): MatchView {
  const { dog } = m;
  return {
    requested,
    id: dog.id,
    name: dog.name,
    subtitle: `${dog.breed} · ${dog.weightKg}kg · ${Math.floor(dog.ageMonths / 12)}살`,
    reach: reachOf(m),
    ...verdictOf(m),
    highlight: highlightOf(m),
    watchOuts: watchOutsOf(m),
    guidance: guidanceOf(m),
    requestable: m.requestable,
  };
}

/**
 * 그룹 머리말. "순위를 매길 수 없음" 같은 시스템 변명이 아니라
 * 견주가 무엇을 보고 있는지 알려주는 문장으로 쓴다.
 */
export const GROUP_HEADING = {
  reachable: '만날 수 있는 친구',
  far: '동네나 시간대가 안 맞는 친구',
  blocked: '이번에는 권하지 않는 조합',
} as const;

/** 요청을 보내기로 결정한 순간에 보여줄 안내. 목록 위에 띄워두면 읽지 않고 지나간다. */
export const firstMeetingNotice =
  '처음 만나는 친구와는 사람이 많은 공개된 장소에서 만나주세요. 서로의 집 앞은 텃세가 생기기 쉽습니다.';

/**
 * 만날 수 있는 친구가 하나도 없을 때, 왜 없고 무엇을 하면 되는지 알려준다.
 * 빈 화면만 보여주면 견주는 앱이 고장난 줄 알고 떠난다.
 */
export function emptyReachableMessage(me: Dog, candidates: MatchCandidate[]): string {
  if (!me.district) {
    return '동네를 아직 안 적으셨어요. 동네를 고르면 근처 친구를 찾아드릴 수 있어요.';
  }
  if (!me.walkTimes?.length) {
    return '주로 산책하는 시간대를 고르면, 그 시간에 나오는 친구를 찾아드릴 수 있어요.';
  }
  if (me.ageMonths > 0 && me.ageMonths < 4) {
    return '아직 예방접종을 마치기 전이라 다른 친구를 권하지 않아요. 접종을 마친 뒤에 다시 찾아보세요.';
  }
  if (candidates.length > 0 && candidates.every((c) => c.group === 'blocked')) {
    return '지금은 함께 걷기를 권할 친구가 없어요. 아래에서 이유를 확인해보세요.';
  }
  return `${me.district}에 같은 시간대로 산책하는 친구가 아직 없어요. 산책 시간대를 더 고르면 만날 친구가 늘어납니다.`;
}

/** 상대에게 내가 어떻게 보이는지 — 프로필을 안 채운 견주에게 보여줄 안내. */
export const emptyProfileNudge = (dogName: string) =>
  `${topic(dogName)} 성향을 적지 않아서 추천 목록 아래쪽에 표시돼요. 성향을 적으면 ${conj(dogName)} 잘 맞는 친구를 찾기 쉬워집니다.`;

export type MatchScreen = {
  groups: { group: MatchGroup; heading: string; items: MatchView[] }[];
  /** 만날 수 있는 친구가 없을 때만 채워진다. */
  emptyMessage: string;
};

const GROUP_ORDER: MatchGroup[] = ['reachable', 'far', 'blocked'];

/**
 * 화면에 그릴 것을 통째로 만든다.
 * 조립까지 여기서 끝내면 화면은 렌더만 하고, 점수·산식은 클라이언트로 넘어가지 않는다.
 */
export function buildMatchScreen(
  me: Dog,
  candidates: MatchCandidate[],
  requested: Set<string> = new Set(),
): MatchScreen {
  return {
    groups: GROUP_ORDER.map((group) => ({
      group,
      heading: GROUP_HEADING[group],
      items: candidates
        .filter((m) => m.group === group)
        .map((m) => toView(m, requested.has(m.dog.id))),
    })).filter((g) => g.items.length > 0),
    emptyMessage: candidates.some((m) => m.group === 'reachable')
      ? ''
      : emptyReachableMessage(me, candidates),
  };
}
