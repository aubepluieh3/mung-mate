import type { Dog } from './dog.ts';
import { subj, topic, conj } from './josa.ts';

/**
 * 안전 게이트.
 *
 * 여기 들어오는 입력은 전부 "바꾸기 어려운 사실"이다 — 체급, 나이, 성별, 중성화 여부.
 * 견주가 거짓으로 적어서 얻을 이득이 없는 값들만 쓴다.
 * 성향 태그는 견주 진술이라 회피가 쉬우므로 게이트에 넣지 않는다(점수 쪽에서 쓴다).
 */

export type GateLevel = 'block' | 'caution' | 'ok';

export type GateFinding = {
  code: string;
  level: 'block' | 'caution';
  /** 견주에게 그대로 보여줄 문장. 차단 이유는 반드시 공개한다. */
  message: string;
};

export type GateResult = {
  level: GateLevel;
  findings: GateFinding[];
};

const VACCINATION_MIN_MONTHS = 4; // 16주. 접종 완료 전에는 개-개 접촉을 권하지 않는다
const SMALL_DOG_KG = 10;
const SENIOR_MONTHS = 9 * 12;
const PUPPY_MONTHS = 12;
const ADULT_MONTHS = 12;

type Rule = (a: Dog, b: Dog) => GateFinding | null;

/** 접종이 끝나지 않은 어린 강아지 — 전염병 위험. 궁합과 무관하게 막는다. */
const vaccination: Rule = (a, b) => {
  const young = [a, b].filter((d) => d.ageMonths < VACCINATION_MIN_MONTHS);
  if (young.length === 0) return null;
  return {
    code: 'VACCINATION_INCOMPLETE',
    level: 'block',
    message: `${topic(young.map((d) => d.name).join(', '))} 4개월 미만이라 예방접종이 끝나지 않았습니다. 접종을 마친 뒤 만나는 걸 권합니다.`,
  };
};

/** 체급은 절대 차이가 아니라 비율로 본다. 단, 작은 쪽이 소형견이면 더 엄격하게. */
const sizeGap: Rule = (a, b) => {
  const [light, heavy] = a.weightKg <= b.weightKg ? [a, b] : [b, a];
  const ratio = heavy.weightKg / light.weightKg;

  if (light.weightKg < SMALL_DOG_KG && ratio >= 3) {
    return {
      code: 'SIZE_GAP_SMALL_DOG',
      level: 'block',
      message: `${conj(light.name)} ${topic(heavy.name)} 체급이 ${ratio.toFixed(1)}배 차이납니다(${light.weightKg}kg / ${heavy.weightKg}kg). 큰 개가 놀다가 건드려도 소형견은 크게 다칠 수 있습니다.`,
    };
  }
  if (ratio >= 4) {
    return {
      code: 'SIZE_GAP_EXTREME',
      level: 'block',
      message: `체급이 ${ratio.toFixed(1)}배 차이납니다. 함께 뛰노는 산책은 권하지 않습니다.`,
    };
  }
  if (ratio >= 2) {
    return {
      code: 'SIZE_GAP',
      level: 'caution',
      message: `체급이 ${ratio.toFixed(1)}배 차이납니다. 놀이가 격해지면 힘 차이가 크게 벌어집니다.`,
    };
  }
  return null;
};

const isInHeat = (d: Dog) => d.sex === 'female' && !d.neutered && d.inHeat === true;

/** 발정 중 암컷 × 수컷. 견주 본인이 곤란해지는 일이라 정직하게 적을 이유가 있는 항목. */
const heatCycle: Rule = (a, b) => {
  const pairs: [Dog, Dog][] = [
    [a, b],
    [b, a],
  ];
  for (const [female, other] of pairs) {
    if (!isInHeat(female) || other.sex !== 'male') continue;
    return {
      code: 'IN_HEAT',
      level: other.neutered ? 'caution' : 'block',
      message: other.neutered
        ? `${subj(female.name)} 발정 중입니다. 중성화한 수컷도 반응할 수 있으니 거리를 두세요.`
        : `${subj(female.name)} 발정 중이고 ${topic(other.name)} 중성화하지 않은 수컷입니다. 이 시기에는 만나지 않는 게 좋습니다.`,
    };
  }
  return null;
};

/** 미중성화 성견 수컷끼리는 서로 신경전이 붙기 쉽다. 흔한 조합이라 차단하지 않고 경고만. */
const intactMales: Rule = (a, b) => {
  const both = [a, b].every(
    (d) => d.sex === 'male' && !d.neutered && d.ageMonths >= ADULT_MONTHS,
  );
  if (!both) return null;
  return {
    code: 'INTACT_MALES',
    level: 'caution',
    message: '둘 다 중성화하지 않은 성견 수컷입니다. 서로 기싸움이 생기기 쉬우니 목줄을 짧게 잡아주세요.',
  };
};

/** 노견 × 퍼피 — 퍼피의 에너지가 노견의 관절과 인내심에 부담이 된다. */
const seniorAndPuppy: Rule = (a, b) => {
  const senior = [a, b].find((d) => d.ageMonths >= SENIOR_MONTHS);
  const puppy = [a, b].find((d) => d.ageMonths < PUPPY_MONTHS);
  if (!senior || !puppy || senior === puppy) return null;
  return {
    code: 'SENIOR_PUPPY',
    level: 'caution',
    message: `${topic(senior.name)} 노견이고 ${topic(puppy.name)} 아직 어립니다. 어린 개의 에너지가 노견에게 부담이 될 수 있습니다.`,
  };
};

const RULES: Rule[] = [vaccination, sizeGap, heatCycle, intactMales, seniorAndPuppy];

/**
 * 두 마리의 만남을 판정한다. 순서를 바꿔도 결과는 같다.
 *
 * block 이어도 목록에서 숨기지 않는다 — findings 를 그대로 보여주고 요청만 잠근다.
 * 이유를 모르면 견주는 앱의 판단을 신뢰하지 않는다.
 */
export function evaluateGate(a: Dog, b: Dog): GateResult {
  const findings = RULES.map((rule) => rule(a, b)).filter((f): f is GateFinding => f !== null);
  const level: GateLevel = findings.some((f) => f.level === 'block')
    ? 'block'
    : findings.length > 0
      ? 'caution'
      : 'ok';
  return { level, findings };
}
