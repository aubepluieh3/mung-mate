import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { findMatches } from '../src/match.ts';
import { buildMatchScreen, firstMeetingNotice, toWalkView } from '../src/present.ts';
import { checkJoin, MAX_PARTICIPANTS, type Walk } from '../src/walk.ts';
import { toTrailView, TRAIL_TAGS, type TrailTag } from '../src/trail.ts';
import type { Dog, WalkTime } from '../src/dog.ts';
import {
  addRequest,
  allDogs,
  allTrails,
  allWalks,
  createTrail,
  createWalk,
  districtGraph,
  findDog,
  findWalk,
  joinWalk,
  requestsFrom,
  saveDog,
  seed,
} from './db.ts';

/**
 * API 서버. 판정 엔진은 여기서만 돈다.
 * 클라이언트에는 완성된 화면 데이터만 내려간다 — 점수와 산식, 남의 개 프로필은 나가지 않는다.
 */

const PORT = Number(process.env.PORT ?? 5181);

const json = (res: ServerResponse, status: number, body: unknown) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
};

const readBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('본문이 올바른 JSON 이 아닙니다.');
  }
};

const KNOWN_DISTRICTS = new Set(Object.keys(districtGraph));
const WALK_TIMES = new Set(['아침', '점심', '저녁', '밤']);
const TEMPERAMENTS = new Set(['활발함', '차분함', '개좋아함', '사람좋아', '겁많음', '짖음많음']);

/** 프로필은 견주가 보내는 값이므로 그대로 믿지 않는다. 판정에 쓰이는 값이라 더욱. */
function parseDog(input: unknown): Dog {
  const d = (input ?? {}) as Record<string, unknown>;
  const name = String(d.name ?? '').trim();
  const weightKg = Number(d.weightKg);
  const ageMonths = Number(d.ageMonths);

  if (!name) throw new Error('이름을 적어주세요.');
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new Error('몸무게를 적어주세요.');
  if (!Number.isFinite(ageMonths) || ageMonths < 0) throw new Error('나이를 확인해주세요.');
  if (d.sex !== 'male' && d.sex !== 'female') throw new Error('성별을 골라주세요.');

  const pick = (v: unknown, allowed: Set<string>) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => allowed.has(x)))] : [];
  const neutered = Boolean(d.neutered);

  // 모르는 동네를 받아두면 조용히 "먼 동네"가 되어, 견주는 왜 아무도 안 뜨는지 알 수 없다
  const district = typeof d.district === 'string' && d.district ? d.district : undefined;
  if (district && !KNOWN_DISTRICTS.has(district)) {
    throw new Error(`아직 지원하지 않는 동네예요. (${[...KNOWN_DISTRICTS].join(', ')})`);
  }

  return {
    id: typeof d.id === 'string' ? d.id : '',
    name,
    breed: String(d.breed ?? '').trim() || '믹스',
    ageMonths: Math.floor(ageMonths),
    weightKg,
    sex: d.sex,
    neutered,
    district,
    walkTimes: pick(d.walkTimes, WALK_TIMES) as Dog['walkTimes'],
    // 태그 상한은 화면에서도 막지만, 서버가 최종 방어선이다
    temperaments: pick(d.temperaments, TEMPERAMENTS).slice(0, 3) as Dog['temperaments'],
    preferences: [],
    sensitiveToDogs: Boolean(d.sensitiveToDogs),
    temperamentsUpdatedAt:
      typeof d.temperamentsUpdatedAt === 'string' ? d.temperamentsUpdatedAt : undefined,
  };
}

const screenFor = (dog: Dog) => {
  const candidates = findMatches(dog, allDogs(), { districts: districtGraph });
  return {
    dog,
    ...buildMatchScreen(dog, candidates, new Set(requestsFrom(dog.id))),
    firstMeetingNotice,
  };
};

const routes: Record<string, (req: IncomingMessage, url: URL) => Promise<[number, unknown]>> = {
  /** 프로필 등록·수정. id 가 없으면 발급한다. */
  'POST /api/dogs': async (req) => {
    const saved = saveDog(parseDog(await readBody(req)));
    return [200, screenFor(saved)];
  },

  /** 내 화면. 엔진은 서버에서만 돈다. */
  'GET /api/matches': async (_req, url) => {
    const id = url.searchParams.get('dogId') ?? '';
    const dog = findDog(id);
    if (!dog) return [404, { error: '등록된 프로필을 찾을 수 없습니다.' }];
    return [200, screenFor(dog)];
  },

  /** 산책 요청. */
  'POST /api/requests': async (req) => {
    const body = (await readBody(req)) as { fromId?: string; toId?: string };
    const from = findDog(String(body.fromId ?? ''));
    const to = findDog(String(body.toId ?? ''));
    if (!from || !to) return [404, { error: '상대를 찾을 수 없습니다.' }];

    // 차단된 조합에는 요청을 남기지 않는다. 화면에서 버튼을 감췄지만 서버도 막아야 한다
    const target = findMatches(from, [to], { districts: districtGraph })[0];
    if (!target?.requestable) return [409, { error: '지금은 권하지 않는 조합입니다.' }];

    addRequest(from.id, to.id);
    return [200, screenFor(from)];
  },

  'GET /api/districts': async () => [200, { districts: Object.keys(districtGraph) }],

  /**
   * 근처 산책 일정. 참여 가능 여부를 서버가 판정해서 내려준다.
   * 같은 동이나 인접 동만 보여준다 — 걸어갈 수 없는 일정은 목록에 있을 이유가 없다.
   */
  'GET /api/walks': async (_req, url) => {
    const dog = findDog(url.searchParams.get('dogId') ?? '');
    if (!dog) return [404, { error: '등록된 프로필을 찾을 수 없습니다.' }];

    const near = (d: string) =>
      d === dog.district || (dog.district ? (districtGraph[dog.district] ?? []).includes(d) : false);

    const walks = allWalks()
      .filter((w) => near(w.district) && w.date >= today())
      .map((w) => {
        const participants = w.participantIds.map(findDog).filter((d): d is Dog => d !== null);
        return toWalkView(w, participants, checkJoin(w, dog, participants), dog.id);
      });

    return [200, { walks, maxParticipants: MAX_PARTICIPANTS, firstMeetingNotice }];
  },

  /** 산책 일정 만들기. */
  'POST /api/walks': async (req) => {
    const body = (await readBody(req)) as Record<string, unknown>;
    const host = findDog(String(body.hostId ?? ''));
    if (!host) return [404, { error: '등록된 프로필을 찾을 수 없습니다.' }];
    if (!host.district) return [400, { error: '동네를 먼저 적어주세요.' }];

    const date = String(body.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('날짜를 골라주세요.');
    if (date < today()) throw new Error('지난 날짜로는 만들 수 없어요.');
    if (!WALK_TIMES.has(String(body.time))) throw new Error('시간대를 골라주세요.');

    const place = String(body.place ?? '').trim();
    if (!place) throw new Error('만날 장소를 적어주세요.');

    const minutes = Number(body.minutes);
    if (!Number.isFinite(minutes) || minutes < 10 || minutes > 180) {
      throw new Error('산책 시간은 10분에서 180분 사이로 적어주세요.');
    }

    const capacity = Math.min(Math.max(Number(body.capacity) || 2, 2), MAX_PARTICIPANTS);

    createWalk({
      hostId: host.id,
      district: host.district,
      date,
      time: String(body.time) as WalkTime,
      place,
      minutes: Math.round(minutes),
      capacity,
    });
    return [200, { ok: true }];
  },

  /**
   * 근처 산책로. 내 동네를 먼저, 그다음 인접 동.
   * 상대가 없어도 쓸 수 있는 기능이라 후보가 0명인 견주에게도 보여줄 게 있다.
   */
  'GET /api/trails': async (_req, url) => {
    const dog = findDog(url.searchParams.get('dogId') ?? '');
    if (!dog) return [404, { error: '등록된 프로필을 찾을 수 없습니다.' }];

    const adjacent = dog.district ? (districtGraph[dog.district] ?? []) : [];
    const walksAtNight = (dog.walkTimes ?? []).includes('밤');

    const trails = allTrails()
      .filter((t) => t.district === dog.district || adjacent.includes(t.district))
      .map((t) => toTrailView(t, dog.district, walksAtNight))
      .sort((a, b) => Number(b.nearby) - Number(a.nearby) || a.name.localeCompare(b.name, 'ko'));

    return [200, { trails, tags: TRAIL_TAGS }];
  },

  /** 산책로 등록. */
  'POST /api/trails': async (req) => {
    const body = (await readBody(req)) as Record<string, unknown>;
    const dog = findDog(String(body.dogId ?? ''));
    if (!dog) return [404, { error: '등록된 프로필을 찾을 수 없습니다.' }];
    if (!dog.district) return [400, { error: '동네를 먼저 적어주세요.' }];

    const name = String(body.name ?? '').trim();
    if (!name) throw new Error('산책로 이름을 적어주세요.');

    const minutes = Number(body.minutes);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 240) {
      throw new Error('걸리는 시간은 5분에서 240분 사이로 적어주세요.');
    }

    const allowed = new Set<string>(TRAIL_TAGS);
    createTrail({
      district: dog.district,
      name,
      note: String(body.note ?? '').trim(),
      minutes: Math.round(minutes),
      tags: (Array.isArray(body.tags)
        ? [...new Set(body.tags.filter((t): t is string => allowed.has(t)))]
        : []) as TrailTag[],
      createdBy: dog.id,
    });
    return [200, { ok: true }];
  },

  /** 참여 신청. 이미 참여한 개들과 전부 쌍으로 검사한다. */
  'POST /api/walks/join': async (req) => {
    const body = (await readBody(req)) as { walkId?: string; dogId?: string };
    const dog = findDog(String(body.dogId ?? ''));
    const walk = findWalk(String(body.walkId ?? ''));
    if (!dog || !walk) return [404, { error: '산책을 찾을 수 없습니다.' }];

    const participants = walk.participantIds.map(findDog).filter((d): d is Dog => d !== null);
    const check = checkJoin(walk, dog, participants);
    // 화면에서 버튼을 감췄더라도 서버가 다시 막는다
    if (!check.ok) return [409, { error: check.reason }];

    joinWalk(walk.id, dog.id);
    return [200, { ok: true }];
  },
};

const today = () => new Date().toISOString().slice(0, 10);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const handler = routes[`${req.method} ${url.pathname}`];

  if (!handler) return json(res, 404, { error: '없는 경로입니다.' });

  try {
    const [status, body] = await handler(req, url);
    json(res, status, body);
  } catch (error) {
    // 입력 검증 실패는 견주에게 보여줄 문장이므로 그대로 내려보낸다
    json(res, 400, { error: error instanceof Error ? error.message : '요청을 처리할 수 없습니다.' });
  }
});

const seeded = seed();
server.listen(PORT, () => {
  console.log(`멍메이트 API → http://localhost:${PORT} (강아지 ${seeded}마리)`);
});
