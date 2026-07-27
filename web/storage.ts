import type { Dog } from '../src/dog.ts';

/** 브라우저에만 저장한다. 서버는 없다. */

const KEY = 'mung-mate:my-dog';

/**
 * 아직 아무것도 등록하지 않은 프로필.
 * 샘플 강아지를 기본값으로 쓰면 처음 온 견주에게 남의 개가 내 개로 보인다.
 */
export const blankDog = (): Dog => ({
  id: 'me',
  name: '',
  breed: '',
  ageMonths: 0,
  weightKg: 0,
  sex: 'male',
  neutered: false,
  walkTimes: [],
});

/** 등록한 프로필이 없으면 null. 화면은 이때 등록부터 요구한다. */
export const load = (): Dog | null => {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<Dog>) : null;
    if (!saved?.name?.trim()) return null;
    // 없는 필드는 빈 값으로 메운다 — 필드를 추가해도 기존 저장값이 깨지지 않는다
    return { ...blankDog(), ...saved };
  } catch {
    return null;
  }
};

export const save = (dog: Dog) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(dog));
  } catch {
    // 저장 실패로 화면이 멈추게 하지는 않는다
  }
};
