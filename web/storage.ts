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

export const loadMyDog = (fallback: Dog): Dog => {
  const saved = read<Partial<Dog> | null>(MY_DOG, null);
  // 저장된 프로필에 없는 필드는 기본값으로 메운다 — 필드를 추가해도 기존 저장값이 깨지지 않는다
  return saved && typeof saved.name === 'string' ? { ...fallback, ...saved } : fallback;
};

export const saveMyDog = (dog: Dog) => write(MY_DOG, dog);

/** 산책 요청을 보낸 상대의 id. */
export const loadRequests = (): string[] => {
  const saved = read<unknown>(REQUESTS, []);
  return Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string') : [];
};

export const saveRequests = (ids: string[]) => write(REQUESTS, ids);
