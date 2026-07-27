import type { Dog } from '../src/dog.ts';

/**
 * 로컬 저장. 서버는 두지 않기로 했으므로 브라우저에만 남는다.
 * 저장된 값이 깨져 있어도 앱이 죽지 않게 항상 기본값으로 되돌린다.
 */

const MY_DOG = 'mung-mate:my-dog';
const REQUESTS = 'mung-mate:requests';

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패(용량 초과 등)로 화면이 멈추게 하지는 않는다
  }
};

/**
 * 아직 아무것도 등록하지 않은 프로필.
 * 샘플 강아지를 기본값으로 쓰면 안 된다 — 처음 온 견주에게 남의 개가 내 개로 보인다.
 */
export const blankDog = (): Dog => ({
  id: 'me',
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

/** 등록한 프로필이 없으면 null. 화면은 이때 등록부터 요구한다. */
export const loadMyDog = (): Dog | null => {
  const saved = read<Partial<Dog> | null>(MY_DOG, null);
  if (!saved || typeof saved.name !== 'string' || !saved.name.trim()) return null;
  // 저장된 프로필에 없는 필드는 빈 값으로 메운다 — 필드를 추가해도 기존 저장값이 깨지지 않는다
  return { ...blankDog(), ...saved };
};

export const saveMyDog = (dog: Dog) => write(MY_DOG, dog);

/** 산책 요청을 보낸 상대의 id. */
export const loadRequests = (): string[] => {
  const saved = read<unknown>(REQUESTS, []);
  return Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string') : [];
};

export const saveRequests = (ids: string[]) => write(REQUESTS, ids);
