import type { Dog, Temperament } from './dog.ts';
import { subj, topic, obj } from './josa.ts';

/**
 * 궁합 점수 = 태그 궁합(0~100) × 물리 조건 계수
 *
 * 안전 판정이 아니다. 게이트를 통과한 상대들끼리 "누구부터 볼까"를 정하는 순위값이다.
 * 점수가 높다고 안내를 완화하지 않는다 — 첫 만남 목줄 인사는 100점에도 그대로 적용된다.
 *
 * 설계 의도:
 * - 태그가 점수의 본체다. 만점에서 깎는 방식은 태그를 벌점표로 만들고 가점을 천장에 먹힌다
 * - 태그 쌍의 '평균'을 쓴다 → 태그를 많이 붙여도 유리해지지 않는다(인플레이션 차단)
 * - 태그 쌍이 없으면 점수를 매기지 않는다(null) → 빈 프로필이 상위권에 오지 못한다
 * - 체급·나이는 곱셈 계수다. 태그 궁합을 지우지 않고 비례해서 낮춘다
 */

/** 성향 태그 + 프로필 항목 '예민해요'를 같은 축에서 다룬다. */
type Trait = Temperament | '예민함';

type Cell = {
  delta: number;
  /** 영향이 큰 조합에만 문장을 붙인다. row = 매트릭스 첫 키 태그를 가진 개. */
  note?: (row: Dog, col: Dog) => string;
};

const NEUTRAL = 50;
/** 태그 쌍 평균(-25~+25)을 0~100 폭으로 펼치는 배율. */
const SPREAD = 2;
/**
 * 태그 궁합의 하한. 0이면 물리 계수를 곱해도 전부 0이 되어 최하위 구간의 순위가 뭉개진다
 * (100점 천장 문제의 거울상). 0점은 게이트 차단의 의미로 남겨둔다.
 */
const MIN_TAG_FIT = 5;
const STALE_TAG_MONTHS = 6;
const STALE_TAG_WEIGHT = 0.5;
const AGE_GAP_MONTHS = 60;
const WIDE_AGE_GAP_MONTHS = 96;

/**
 * 태그 궁합 매트릭스. 대칭이므로 한쪽 방향만 정의한다.
 * 정의하지 않은 쌍은 궁합과 무관한 것으로 보고 평균 계산에서 제외한다
 * (`사람좋아`가 그렇다 — 사람을 좋아하는 것은 개끼리의 궁합과 관계가 없다).
 */
const MATRIX: Partial<Record<Trait, Partial<Record<Trait, Cell>>>> = {
  활발함: {
    활발함: { delta: 15, note: () => '둘 다 활발해서 에너지가 잘 맞습니다.' },
    개좋아함: { delta: 10 },
    차분함: { delta: -10 },
    짖음많음: { delta: -5 },
    겁많음: {
      delta: -25,
      note: (lively, timid) => `${lively.name}의 에너지가 ${timid.name}에게 부담일 수 있습니다.`,
    },
    예민함: {
      delta: -25,
      note: (lively, sensitive) =>
        `${topic(sensitive.name)} 낯선 개에게 예민한데 ${subj(lively.name)} 활발한 편입니다.`,
    },
  },
  차분함: {
    차분함: { delta: 10 },
    개좋아함: { delta: 10 },
    짖음많음: { delta: 0 },
    겁많음: {
      delta: 20,
      note: (calm, timid) => `${subj(calm.name)} 차분해서 ${subj(timid.name)} 편하게 지낼 수 있습니다.`,
    },
    예민함: {
      delta: 15,
      note: (calm, sensitive) =>
        `${subj(calm.name)} 차분해서 ${sensitive.name}에게 자극이 적은 상대입니다.`,
    },
  },
  개좋아함: {
    개좋아함: { delta: 15, note: () => '둘 다 개를 좋아합니다.' },
    짖음많음: { delta: 0 },
    // "우리 개는 개 좋아해요"가 실제 사고에서 가장 흔한 대사다.
    // 사교적인 개의 과한 접근이 소심한 개를 자극한다 — 가점이 아니라 감점이다.
    겁많음: {
      delta: -15,
      note: (social, timid) =>
        `${topic(social.name)} 개를 좋아하지만, 반가운 마음의 접근도 ${timid.name}에게는 위협으로 느껴질 수 있습니다.`,
    },
    예민함: {
      delta: -20,
      note: (social, sensitive) =>
        `${subj(social.name)} 먼저 다가가는 편이라 ${sensitive.name}에게 부담이 될 수 있습니다.`,
    },
  },
  겁많음: {
    // 겁많음은 낙인이 약해 정직하게 체크하는 태그다.
    // 감점만 주면 정직한 견주가 매칭을 가장 적게 받고 앱을 떠난다. 명시적으로 밀어준다.
    겁많음: { delta: 20, note: () => '둘 다 조심스러운 편입니다. 서로의 속도를 이해하는 조합입니다.' },
    예민함: { delta: 5 },
    짖음많음: {
      delta: -15,
      note: (timid, barky) => `${barky.name}의 짖음이 ${obj(timid.name)} 긴장시킬 수 있습니다.`,
    },
  },
  짖음많음: {
    짖음많음: { delta: -5 },
    예민함: {
      delta: -20,
      note: (barky, sensitive) => `${barky.name}의 짖음이 ${sensitive.name}에게 자극이 될 수 있습니다.`,
    },
  },
  예민함: {
    // 예민한 개 견주들은 서로를 이해한다. 여기가 이 항목을 정직하게 체크할 유인이다.
    예민함: {
      delta: 25,
      note: () => '둘 다 낯선 개에게 예민한 편입니다. 서로의 사정을 아는 견주끼리 만나는 조합입니다.',
    },
  },
};

export type TagPair = {
  traits: [Trait, Trait];
  delta: number;
  note?: string;
};

export type Factor = {
  code: string;
  multiplier: number;
  note: string;
};

export type ScoreResult = {
  /** 태그 정보가 없으면 null. 점수를 만들어내지 않고 '정보 부족'으로 남긴다. */
  score: number | null;
  /** 물리 조건을 곱하기 전의 태그 궁합. */
  tagFit: number | null;
  pairs: TagPair[];
  factors: Factor[];
  tagTrust: number;
};

const traitsOf = (d: Dog): Trait[] =>
  d.sensitiveToDogs ? [...d.temperaments, '예민함'] : [...d.temperaments];

const lookup = (x: Trait, y: Trait): { cell: Cell; swapped: boolean } | null => {
  const direct = MATRIX[x]?.[y];
  if (direct) return { cell: direct, swapped: false };
  const reverse = MATRIX[y]?.[x];
  if (reverse) return { cell: reverse, swapped: true };
  return null;
};

const monthsSince = (iso: string | undefined, now: Date): number | null => {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
};

/**
 * 프로필이 오래되면 태그 궁합을 중립(50) 쪽으로 당긴다.
 * 강아지는 6개월이면 다른 개가 되는데, 특히 나빠진 변화가 갱신되지 않는다.
 * 감점 방식과 달리 상한에 먹히지 않고 실제로 순위에 반영된다.
 */
const tagTrustOf = (a: Dog, b: Dog, now: Date): number => {
  const ages = [a, b].map((d) => monthsSince(d.temperamentsUpdatedAt, now) ?? 0);
  return Math.max(...ages) >= STALE_TAG_MONTHS ? STALE_TAG_WEIGHT : 1;
};

const collectPairs = (a: Dog, b: Dog): TagPair[] => {
  const pairs: TagPair[] = [];
  for (const ta of traitsOf(a)) {
    for (const tb of traitsOf(b)) {
      const found = lookup(ta, tb);
      if (!found) continue;
      const [row, col] = found.swapped ? [b, a] : [a, b];
      pairs.push({
        traits: found.swapped ? [tb, ta] : [ta, tb],
        delta: found.cell.delta,
        note: found.cell.note?.(row, col),
      });
    }
  }
  return pairs;
};

/**
 * 사교적이거나 활발한 개가 소심한 개보다 무거우면 접촉이 일방적으로 흐른다.
 * 매트릭스로는 표현할 수 없는 비대칭이라 계수로 따로 둔다.
 */
const overwhelmFactor = (a: Dog, b: Dog): Factor | null => {
  const pushy: Trait[] = ['활발함', '개좋아함'];
  const fragile: Trait[] = ['겁많음', '예민함'];
  const isOverwhelming = (x: Dog, y: Dog) =>
    traitsOf(x).some((t) => pushy.includes(t)) &&
    traitsOf(y).some((t) => fragile.includes(t)) &&
    x.weightKg > y.weightKg;

  const found = [
    [a, b],
    [b, a],
  ].find(([x, y]) => isOverwhelming(x, y));
  if (!found) return null;
  const [big, small] = found;
  return {
    code: 'OVERWHELM',
    multiplier: 0.8,
    note: `${subj(big.name)} 더 적극적이고 체급도 큽니다. ${subj(small.name)} 눌릴 수 있습니다.`,
  };
};

const sizeFactor = (a: Dog, b: Dog): Factor | null => {
  const [light, heavy] = a.weightKg <= b.weightKg ? [a, b] : [b, a];
  const ratio = heavy.weightKg / light.weightKg;
  const tier = ratio >= 2 ? 0.7 : ratio >= 1.5 ? 0.85 : ratio >= 1.25 ? 0.95 : null;
  if (tier === null) return null;
  return {
    code: 'SIZE_GAP',
    multiplier: tier,
    note: `체급이 ${ratio.toFixed(1)}배 차이납니다.`,
  };
};

const ageFactor = (a: Dog, b: Dog): Factor | null => {
  const gap = Math.abs(a.ageMonths - b.ageMonths);
  if (gap < AGE_GAP_MONTHS) return null;
  return {
    code: 'AGE_GAP',
    multiplier: gap >= WIDE_AGE_GAP_MONTHS ? 0.8 : 0.9,
    note: `나이가 ${Math.floor(gap / 12)}살 차이납니다. 놀이 방식이 다를 수 있습니다.`,
  };
};

/** 게이트를 통과한 쌍의 순위를 매긴다. 순서를 바꿔도 결과는 같다. */
export function computeScore(a: Dog, b: Dog, now: Date = new Date()): ScoreResult {
  const tagTrust = tagTrustOf(a, b, now);
  const pairs = collectPairs(a, b);
  const factors = [sizeFactor(a, b), ageFactor(a, b), overwhelmFactor(a, b)].filter(
    (f): f is Factor => f !== null,
  );

  if (pairs.length === 0) {
    return { score: null, tagFit: null, pairs, factors, tagTrust };
  }

  const average = pairs.reduce((sum, p) => sum + p.delta, 0) / pairs.length;
  const tagFit = Math.max(MIN_TAG_FIT, Math.min(100, NEUTRAL + average * SPREAD * tagTrust));
  const scaled = factors.reduce((acc, f) => acc * f.multiplier, tagFit);

  return {
    score: Math.round(Math.max(0, Math.min(100, scaled))),
    tagFit: Math.round(tagFit),
    pairs,
    factors,
    tagTrust,
  };
}
