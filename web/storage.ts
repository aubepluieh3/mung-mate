import type { Dog } from '../src/dog.ts';

/**
 * 브라우저에 남기는 건 견주 식별자 하나뿐이다.
 * 프로필과 요청 기록은 서버가 들고 있다 — 로그인이 없으니 이 브라우저가 곧 이 견주다.
 */

const DOG_ID = 'mung-mate:dog-id';

export const loadDogId = (): string => {
  try {
    return localStorage.getItem(DOG_ID) ?? '';
  } catch {
    return '';
  }
};

export const saveDogId = (id: string) => {
  try {
    localStorage.setItem(DOG_ID, id);
  } catch {
    // 저장 실패로 화면이 멈추게 하지는 않는다. 이 세션에서는 계속 쓸 수 있다
  }
};

export const clearDogId = () => {
  try {
    localStorage.removeItem(DOG_ID);
  } catch {
    /* 무시 */
  }
};

/**
 * 아직 아무것도 등록하지 않은 프로필.
 * 샘플 강아지를 기본값으로 쓰면 안 된다 — 처음 온 견주에게 남의 개가 내 개로 보인다.
 */
export const blankDog = (): Dog => ({
  id: '',
  name: '',
  breed: '',
  ageMonths: 0,
  weightKg: 0,
  sex: 'male',
  neutered: false,
  temperaments: [],
  preferences: [],
  walkTimes: [],
});
