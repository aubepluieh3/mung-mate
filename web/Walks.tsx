import { useEffect, useState } from 'react';
import type { WalkTime } from '../src/dog.ts';
import { createWalk, fetchWalks, joinWalk, type WalkScreen } from './api.ts';

/**
 * 산책 약속.
 *
 * 개↔개 매칭만으로는 동네와 시간대가 안 맞으면 못 만난다.
 * 일정이 사람을 모으면 그 제약이 풀린다 — 평소 시간대가 달라도 그날 그 시간엔 나올 수 있다.
 * 참여 가능 여부는 서버가 판정해서 내려주므로 여기서는 그리기만 한다.
 */

const WALK_TIMES: WalkTime[] = ['아침', '점심', '저녁', '밤'];
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

function WalkForm({ dogId, onDone }: { dogId: string; onDone: () => void }) {
  const [date, setDate] = useState(tomorrow());
  const [time, setTime] = useState<WalkTime>('저녁');
  const [place, setPlace] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [capacity, setCapacity] = useState(2);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    try {
      await createWalk({ hostId: dogId, date, time, place, minutes, capacity });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : '만들지 못했어요.');
    }
  };

  return (
    <div className="profile-form">
      <h2>산책 약속 만들기</h2>
      <p className="form-intro">
        만날 장소는 사람이 많은 공개된 곳으로 정해주세요. 서로의 집 앞은 텃세가 생기기 쉽습니다.
      </p>

      <div className="row">
        <label>
          날짜
          <input type="date" value={date} min={tomorrow()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          시간대
          <select value={time} onChange={(e) => setTime(e.target.value as WalkTime)}>
            {WALK_TIMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        만날 장소
        <input
          value={place}
          placeholder="망원한강공원 입구"
          onChange={(e) => setPlace(e.target.value)}
        />
      </label>

      <div className="row">
        <label>
          걸을 시간
          <div className="age">
            <input
              type="number"
              min={10}
              max={180}
              step={10}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
            <span>분</span>
          </div>
        </label>
        <label>
          최대 인원
          <div className="age">
            <input
              type="number"
              min={2}
              max={3}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
            <span>마리</span>
          </div>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="request-actions">
        <button type="button" className="primary" onClick={submit}>
          약속 만들기
        </button>
        <button type="button" className="ghost" onClick={onDone}>
          취소
        </button>
      </div>
    </div>
  );
}

export function Walks({ dogId }: { dogId: string }) {
  const [screen, setScreen] = useState<WalkScreen | null>(null);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState('');

  const load = () => fetchWalks(dogId).then(setScreen).catch(() => setScreen(null));
  useEffect(() => {
    load();
  }, [dogId]);

  const join = async (walkId: string) => {
    setError('');
    try {
      await joinWalk(walkId, dogId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '참여할 수 없어요.');
      await load();
    }
  };

  if (making) {
    return (
      <WalkForm
        dogId={dogId}
        onDone={() => {
          setMaking(false);
          load();
        }}
      />
    );
  }

  return (
    <section>
      <h2>
        근처 산책 약속 <span className="count">{screen?.walks.length ?? 0}</span>
      </h2>

      <button type="button" className="primary" onClick={() => setMaking(true)}>
        산책 약속 만들기
      </button>

      {error && <p className="error">{error}</p>}

      {screen && screen.walks.length === 0 && (
        <div className="empty">
          <p>아직 근처에 올라온 산책 약속이 없어요. 먼저 만들어보세요.</p>
        </div>
      )}

      <ul className="cards">
        {screen?.walks.map((w) => (
          <li key={w.id} className={`card ${w.joined ? 'good' : w.joinable ? 'fine' : 'muted'}`}>
            <div className="card-head">
              <strong className="name">{w.when}</strong>
              <span className="subtitle">{w.district}</span>
            </div>
            <p className="reach">{w.place}</p>
            <p className="highlight">{w.participants}</p>

            {w.notes.length > 0 && (
              <ul className="watch-outs">
                {w.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}

            {w.joined ? (
              <p className="requested">참여하는 산책이에요</p>
            ) : w.joinable ? (
              <button type="button" className="primary" onClick={() => join(w.id)}>
                참여 신청
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
