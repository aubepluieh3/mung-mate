import { formatAge, type Dog } from './dog.ts';
import { conj, topic } from './josa.ts';

/**
 * 이 앱이 답하는 질문은 하나다 — "이 개랑 우리 개가 만나도 되나?"
 *
 * 판정은 **바꾸기 어려운 사실**만 본다. 체급, 나이, 성별, 중성화 여부.
 * 견주 진술(성향, 발정 여부)은 쓰지 않는다. 회피가 쉬워서, 룰을 세게 걸수록 데이터가 오염된다.
 * 정직하게 적은 소수만 손해를 보고 위험한 케이스는 그대로 통과한다.
 *
 * 판정이 완벽할 수 없으니 **첫 만남 안내는 결과와 무관하게 항상 붙인다.**
 * 룰이 놓친 건 절차가 잡는다.
 */

export type Verdict = 'ok' | 'caution' | 'blocked';

export type Match = {
  dog: Dog;
  verdict: Verdict;
  /** 판정 이유. 차단이든 경고든 반드시 보여준다 — 이유를 모르면 견주는 앱을 신뢰하지 않는다. */
  reasons: string[];
  /** "같은 동 · 저녁에 함께 걸어요" */
  when: string;
  /** 같은 동네에 산책 시간대가 겹치는가. 못 만나는 상대는 목록 아래로 내린다. */
  reachable: boolean;
};

const VACCINATION_MIN_MONTHS = 4; // 16주. 접종 전에는 개-개 접촉을 권하지 않는다
const BLOCK_WEIGHT_RATIO = 3;
const CAUTION_WEIGHT_RATIO = 2;
const SENIOR_MONTHS = 9 * 12;
const PUPPY_MONTHS = 12;

type Finding = { level: 'blocked' | 'caution'; message: string };
type Rule = (a: Dog, b: Dog) => Finding | null;

const RULES: Rule[] = [
  /** 접종이 끝나지 않은 어린 강아지 — 전염병 위험. 궁합과 무관하게 막는다. */
  (a, b) => {
    const young = [a, b].filter((d) => d.ageMonths < VACCINATION_MIN_MONTHS);
    if (!young.length) return null;
    return {
      level: 'blocked',
      message: `${topic(young.map((d) => d.name).join(', '))} 4개월 미만이라 예방접종이 끝나지 않았습니다. 접종을 마친 뒤 만나는 걸 권합니다.`,
    };
  },

  /** 체급은 절대 차이가 아니라 비율로 본다. 3kg 대 10kg 이 30kg 대 40kg 보다 위험하다. */
  (a, b) => {
    const [light, heavy] = a.weightKg <= b.weightKg ? [a, b] : [b, a];
    const ratio = heavy.weightKg / light.weightKg;
    if (ratio >= BLOCK_WEIGHT_RATIO) {
      return {
        level: 'blocked',
        message: `${conj(light.name)} ${topic(heavy.name)} 체급이 ${ratio.toFixed(1)}배 차이납니다(${light.weightKg}kg / ${heavy.weightKg}kg). 큰 개가 놀다가 건드려도 작은 개는 크게 다칠 수 있습니다.`,
      };
    }
    if (ratio >= CAUTION_WEIGHT_RATIO) {
      return {
        level: 'caution',
        message: `체급이 ${ratio.toFixed(1)}배 차이납니다. 놀이가 격해지면 힘 차이가 크게 벌어집니다.`,
      };
    }
    return null;
  },

  /**
   * 둘 다 중성화하지 않은 암수.
   * 발정기가 겹치는 시점을 알 수 없고, 이 조합의 위험은 되돌릴 수 없다 —
   * 원치 않는 임신은 사고를 넘어 강아지 생명 문제가 된다. 확신이 없으면 막는 쪽으로 기울인다.
   */
  (a, b) => {
    const intact = (sex: Dog['sex']) => [a, b].find((d) => d.sex === sex && !d.neutered);
    const female = intact('female');
    const male = intact('male');
    if (!female || !male) return null;
    return {
      level: 'blocked',
      message: `${conj(female.name)} ${topic(male.name)} 둘 다 중성화하지 않았습니다. 발정기가 겹치면 원치 않는 임신이나 다툼으로 이어질 수 있어 권하지 않습니다.`,
    };
  },

  /** 미중성화 성견 수컷끼리는 신경전이 붙기 쉽다. 흔한 조합이라 차단하지 않고 경고만. */
  (a, b) =>
    [a, b].every((d) => d.sex === 'male' && !d.neutered && d.ageMonths >= PUPPY_MONTHS)
      ? {
          level: 'caution',
          message:
            '둘 다 중성화하지 않은 성견 수컷입니다. 서로 기싸움이 생기기 쉬우니 목줄을 짧게 잡아주세요.',
        }
      : null,

  /** 노견 × 퍼피 — 퍼피의 에너지가 노견의 관절과 인내심에 부담이 된다. */
  (a, b) => {
    const senior = [a, b].find((d) => d.ageMonths >= SENIOR_MONTHS);
    const puppy = [a, b].find((d) => d.ageMonths < PUPPY_MONTHS);
    if (!senior || !puppy || senior === puppy) return null;
    return {
      level: 'caution',
      message: `${topic(senior.name)} 노견이고 ${topic(puppy.name)} 아직 어립니다. 어린 개의 에너지가 노견에게 부담이 될 수 있습니다.`,
    };
  },
];

/** 언제 만날 수 있는지. 정확한 위치는 쓰지 않는다 — 동 이름과 산책 시간대만 본다. */
const whenOf = (a: Dog, b: Dog) => {
  if (!a.district || !b.district) return { text: '동네를 아직 안 적은 친구예요', reachable: false };
  if (a.district !== b.district) return { text: `${b.district}에 살아요`, reachable: false };

  const shared = (a.walkTimes ?? []).filter((t) => (b.walkTimes ?? []).includes(t));
  if (!a.walkTimes?.length || !b.walkTimes?.length) {
    return { text: '같은 동 · 산책 시간대를 아직 안 적었어요', reachable: false };
  }
  if (!shared.length) return { text: '같은 동 · 산책 시간대가 겹치지 않아요', reachable: false };
  return { text: `같은 동 · ${shared.join(', ')}에 함께 걸어요`, reachable: true };
};

const VERDICT_ORDER: Record<Verdict, number> = { ok: 0, caution: 1, blocked: 2 };

/** 우리 개와 동네 강아지들을 하나씩 견주어 본다. 순서를 바꿔도 판정은 같다. */
export function findMatches(me: Dog, others: Dog[]): Match[] {
  return others
    .filter((other) => other.id !== me.id)
    .map((dog): Match => {
      const findings = RULES.map((rule) => rule(me, dog)).filter((f): f is Finding => f !== null);
      const blocked = findings.some((f) => f.level === 'blocked');
      const { text, reachable } = whenOf(me, dog);

      return {
        dog,
        // 차단이면 차단 사유만 남긴다. 부가 경고까지 나열하면 정작 중요한 이유가 묻힌다
        reasons: findings.filter((f) => !blocked || f.level === 'blocked').map((f) => f.message),
        verdict: blocked ? 'blocked' : findings.length ? 'caution' : 'ok',
        when: text,
        reachable,
      };
    })
    .sort(
      (a, b) =>
        // 차단은 만날 수 있든 없든 맨 아래다. 같은 동이라고 위로 올리면
        // 절대 만나면 안 되는 상대가 목록 앞에 온다
        Number(a.verdict === 'blocked') - Number(b.verdict === 'blocked') ||
        // 그다음은 실제로 만날 수 있는지. 못 만나는 상대를 위에 두면 목록이 거짓말을 한다
        Number(b.reachable) - Number(a.reachable) ||
        VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] ||
        a.dog.name.localeCompare(b.dog.name, 'ko'),
    );
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  ok: '만나도 좋아요',
  caution: '주의할 점이 있어요',
  blocked: '이 조합은 권하지 않아요',
};

/**
 * 첫 만남 안내. 판정 결과와 무관하게 항상 같은 문장을 붙인다.
 * "만나도 좋아요"일 때 안내를 완화하면 그 방심이 사고를 만든다.
 */
export const FIRST_MEETING_NOTICE =
  '처음 만나는 친구와는 사람이 많은 공개된 장소에서 만나주세요. 목줄을 하고 15분 정도 인사만 해보는 걸 권합니다.';

export const describe = (dog: Dog) =>
  `${dog.breed} · ${dog.weightKg}kg · ${formatAge(dog.ageMonths)} · ${dog.sex === 'male' ? '수컷' : '암컷'}${dog.neutered ? '' : '(미중성화)'}`;

/** 만날 수 있는 친구가 없을 때 왜인지 알려준다. 빈 화면은 고장으로 보인다. */
export function emptyMessage(me: Dog, matches: Match[]): string {
  if (!me.district) return '동네를 고르면 근처 친구를 찾아드릴 수 있어요.';
  if (!me.walkTimes?.length) return '주로 산책하는 시간대를 고르면 그 시간에 나오는 친구를 찾아드려요.';
  if (me.ageMonths < VACCINATION_MIN_MONTHS) {
    return '아직 예방접종을 마치기 전이라 다른 친구를 권하지 않아요. 접종을 마친 뒤에 다시 찾아보세요.';
  }
  if (matches.length && matches.every((m) => m.verdict === 'blocked')) {
    return '지금은 함께 걷기를 권할 친구가 없어요. 아래에서 이유를 확인해보세요.';
  }
  return `${me.district}에 같은 시간대로 산책하는 친구가 아직 없어요. 산책 시간대를 더 고르면 만날 친구가 늘어납니다.`;
}
