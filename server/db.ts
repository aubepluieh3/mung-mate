import { DatabaseSync } from 'node:sqlite';
import type { Dog, MeetPreference, Sex, Temperament, WalkTime } from '../src/dog.ts';
import type { Walk } from '../src/walk.ts';
import type { Trail, TrailTag } from '../src/trail.ts';
import { me, neighborhood, districts, sampleTrails } from '../sample/neighborhood.ts';

/**
 * 저장소. Node 내장 sqlite 를 쓴다(의존성 없음).
 *
 * 강아지 프로필이 서버로 오면서 두 가지가 해결된다.
 * - 궁합 산식이 브라우저 번들에서 빠진다. 산식이 보이면 유리한 태그만 골라 적게 된다
 * - 남의 개 프로필을 클라이언트에 통째로 내려주지 않는다
 */

const db = new DatabaseSync(process.env.MUNG_DB ?? 'data/mung-mate.db');

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS dogs (
    id                      TEXT PRIMARY KEY,
    name                    TEXT NOT NULL,
    breed                   TEXT NOT NULL,
    age_months              INTEGER NOT NULL,
    weight_kg               REAL NOT NULL,
    sex                     TEXT NOT NULL,
    neutered                INTEGER NOT NULL,
    district                TEXT,
    walk_times              TEXT NOT NULL DEFAULT '[]',
    temperaments            TEXT NOT NULL DEFAULT '[]',
    preferences             TEXT NOT NULL DEFAULT '[]',
    sensitive_to_dogs       INTEGER NOT NULL DEFAULT 0,
    temperaments_updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS requests (
    from_id    TEXT NOT NULL,
    to_id      TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (from_id, to_id)
  );

  CREATE TABLE IF NOT EXISTS walks (
    id        TEXT PRIMARY KEY,
    host_id   TEXT NOT NULL,
    district  TEXT NOT NULL,
    date      TEXT NOT NULL,
    time      TEXT NOT NULL,
    place     TEXT NOT NULL,
    minutes   INTEGER NOT NULL,
    capacity  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS walk_participants (
    walk_id   TEXT NOT NULL,
    dog_id    TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (walk_id, dog_id)
  );

  CREATE TABLE IF NOT EXISTS trails (
    id         TEXT PRIMARY KEY,
    district   TEXT NOT NULL,
    name       TEXT NOT NULL,
    note       TEXT NOT NULL DEFAULT '',
    minutes    INTEGER NOT NULL,
    tags       TEXT NOT NULL DEFAULT '[]',
    created_by TEXT NOT NULL
  );
`);

/** 동 인접 관계. 실제 서비스라면 행정구역 데이터에서 온다. */
export const districtGraph = districts;

type Row = Record<string, unknown>;

const parseList = <T,>(raw: unknown): T[] => {
  try {
    const parsed = JSON.parse(String(raw ?? '[]'));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const toDog = (row: Row): Dog => ({
  id: String(row.id),
  name: String(row.name),
  breed: String(row.breed),
  ageMonths: Number(row.age_months),
  weightKg: Number(row.weight_kg),
  sex: String(row.sex) as Sex,
  neutered: Boolean(row.neutered),

  district: row.district ? String(row.district) : undefined,
  walkTimes: parseList<WalkTime>(row.walk_times),
  temperaments: parseList<Temperament>(row.temperaments),
  preferences: parseList<MeetPreference>(row.preferences),
  sensitiveToDogs: Boolean(row.sensitive_to_dogs),
  temperamentsUpdatedAt: row.temperaments_updated_at
    ? String(row.temperaments_updated_at)
    : undefined,
});

const upsert = db.prepare(`
  INSERT INTO dogs (
    id, name, breed, age_months, weight_kg, sex, neutered,
    district, walk_times, temperaments, preferences, sensitive_to_dogs, temperaments_updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name, breed = excluded.breed, age_months = excluded.age_months,
    weight_kg = excluded.weight_kg, sex = excluded.sex, neutered = excluded.neutered,
    district = excluded.district, walk_times = excluded.walk_times,
    temperaments = excluded.temperaments, preferences = excluded.preferences,
    sensitive_to_dogs = excluded.sensitive_to_dogs,
    temperaments_updated_at = excluded.temperaments_updated_at
`);

export function saveDog(dog: Dog): Dog {
  const id = dog.id?.trim() || crypto.randomUUID();
  upsert.run(
    id,
    dog.name,
    dog.breed,
    dog.ageMonths,
    dog.weightKg,
    dog.sex,
    dog.neutered ? 1 : 0,
    dog.district ?? null,
    JSON.stringify(dog.walkTimes ?? []),
    JSON.stringify(dog.temperaments),
    JSON.stringify(dog.preferences),
    dog.sensitiveToDogs ? 1 : 0,
    dog.temperamentsUpdatedAt ?? null,
  );
  return { ...dog, id };
}

const selectOne = db.prepare('SELECT * FROM dogs WHERE id = ?');
const selectAll = db.prepare('SELECT * FROM dogs');

export const findDog = (id: string): Dog | null => {
  const row = selectOne.get(id) as Row | undefined;
  return row ? toDog(row) : null;
};

export const allDogs = (): Dog[] => (selectAll.all() as Row[]).map(toDog);

const insertRequest = db.prepare(
  'INSERT OR IGNORE INTO requests (from_id, to_id, created_at) VALUES (?, ?, ?)',
);
const selectRequests = db.prepare('SELECT to_id FROM requests WHERE from_id = ?');

export const addRequest = (fromId: string, toId: string) =>
  insertRequest.run(fromId, toId, new Date().toISOString());

export const requestsFrom = (fromId: string): string[] =>
  (selectRequests.all(fromId) as Row[]).map((r) => String(r.to_id));

// --- 산책 약속 ---

const insertWalk = db.prepare(
  'INSERT INTO walks (id, host_id, district, date, time, place, minutes, capacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
);
const insertParticipant = db.prepare(
  'INSERT OR IGNORE INTO walk_participants (walk_id, dog_id, joined_at) VALUES (?, ?, ?)',
);
const selectWalks = db.prepare('SELECT * FROM walks ORDER BY date, time');
const selectWalk = db.prepare('SELECT * FROM walks WHERE id = ?');
const selectParticipants = db.prepare(
  'SELECT dog_id FROM walk_participants WHERE walk_id = ? ORDER BY joined_at',
);

const toWalk = (row: Row): Walk => ({
  id: String(row.id),
  hostId: String(row.host_id),
  district: String(row.district),
  date: String(row.date),
  time: String(row.time) as WalkTime,
  place: String(row.place),
  minutes: Number(row.minutes),
  capacity: Number(row.capacity),
  participantIds: (selectParticipants.all(String(row.id)) as Row[]).map((r) => String(r.dog_id)),
});

export function createWalk(walk: Omit<Walk, 'id' | 'participantIds'>): Walk {
  const id = crypto.randomUUID();
  insertWalk.run(
    id,
    walk.hostId,
    walk.district,
    walk.date,
    walk.time,
    walk.place,
    walk.minutes,
    walk.capacity,
  );
  // 만든 사람도 참여자다
  insertParticipant.run(id, walk.hostId, new Date().toISOString());
  return { ...walk, id, participantIds: [walk.hostId] };
}

export const allWalks = (): Walk[] => (selectWalks.all() as Row[]).map(toWalk);

export const findWalk = (id: string): Walk | null => {
  const row = selectWalk.get(id) as Row | undefined;
  return row ? toWalk(row) : null;
};

export const joinWalk = (walkId: string, dogId: string) =>
  insertParticipant.run(walkId, dogId, new Date().toISOString());

// --- 산책로 ---

const insertTrail = db.prepare(
  'INSERT INTO trails (id, district, name, note, minutes, tags, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
);
const selectTrails = db.prepare('SELECT * FROM trails ORDER BY district, name');

const toTrail = (row: Row): Trail => ({
  id: String(row.id),
  district: String(row.district),
  name: String(row.name),
  note: String(row.note ?? ''),
  minutes: Number(row.minutes),
  tags: parseList<TrailTag>(row.tags),
  createdBy: String(row.created_by),
});

export function createTrail(trail: Omit<Trail, 'id'>): Trail {
  const id = crypto.randomUUID();
  insertTrail.run(
    id,
    trail.district,
    trail.name,
    trail.note,
    trail.minutes,
    JSON.stringify(trail.tags),
    trail.createdBy,
  );
  return { ...trail, id };
}

export const allTrails = (): Trail[] => (selectTrails.all() as Row[]).map(toTrail);

/** 동네가 비어 있으면 첫 사용자에게 후보가 0명이다. 샘플로 채워둔다. */
export function seed() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM dogs').get() as { count: number };
  if (count > 0) return count;
  for (const dog of [me, ...neighborhood]) saveDog(dog);
  for (const trail of sampleTrails) createTrail(trail);
  return [me, ...neighborhood].length;
}
