import type { Dog } from '../src/dog.ts';
import type { MatchScreen, WalkView } from '../src/present.ts';

/**
 * 서버 호출. 판정은 서버에서만 돌기 때문에 화면은 완성된 결과만 받는다.
 * 궁합 산식과 남의 개 프로필은 여기로 내려오지 않는다.
 */

/** 서버가 그리라고 준 화면 한 벌. */
export type Screen = MatchScreen & {
  dog: Dog;
  firstMeetingNotice: string;
};

const call = async (path: string, init?: RequestInit): Promise<Screen> => {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 서버가 내려준 문장은 견주에게 그대로 보여줄 수 있게 쓰여 있다
    throw new Error(body.error ?? '요청을 처리할 수 없습니다.');
  }
  return body as Screen;
};

const send = (path: string, body: unknown) =>
  call(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const fetchScreen = (dogId: string) =>
  call(`/api/matches?dogId=${encodeURIComponent(dogId)}`);

export const saveDog = (dog: Dog) => send('/api/dogs', dog);

export const sendRequest = (fromId: string, toId: string) =>
  send('/api/requests', { fromId, toId });

export type WalkScreen = {
  walks: WalkView[];
  maxParticipants: number;
  firstMeetingNotice: string;
};

export const fetchWalks = async (dogId: string): Promise<WalkScreen> => {
  const res = await fetch(`/api/walks?dogId=${encodeURIComponent(dogId)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? '산책 목록을 불러올 수 없습니다.');
  return body as WalkScreen;
};

const command = async (path: string, body: unknown): Promise<void> => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? '요청을 처리할 수 없습니다.');
  }
};

export const createWalk = (walk: {
  hostId: string;
  date: string;
  time: string;
  place: string;
  minutes: number;
  capacity: number;
}) => command('/api/walks', walk);

export const joinWalk = (walkId: string, dogId: string) =>
  command('/api/walks/join', { walkId, dogId });

export const fetchDistricts = async (): Promise<string[]> => {
  const res = await fetch('/api/districts');
  if (!res.ok) return [];
  const body = (await res.json()) as { districts?: string[] };
  return body.districts ?? [];
};
