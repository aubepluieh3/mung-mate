import { useEffect, useState } from 'react';
import type { TrailTag, TrailView } from '../src/trail.ts';

/**
 * 산책로.
 * 다른 기능은 상대가 있어야 쓸 수 있지만 이건 혼자서도 쓸모가 있다 —
 * 동네에 후보가 0명인 견주에게도 보여줄 게 남는다.
 */

type Screen = { trails: TrailView[]; tags: TrailTag[] };

const load = async (dogId: string): Promise<Screen> => {
  const res = await fetch(`/api/trails?dogId=${encodeURIComponent(dogId)}`);
  if (!res.ok) throw new Error('산책로를 불러올 수 없습니다.');
  return res.json();
};

function TrailForm({
  dogId,
  tags,
  onDone,
}: {
  dogId: string;
  tags: TrailTag[];
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [mapQuery, setMapQuery] = useState('');
  const [note, setNote] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [picked, setPicked] = useState<TrailTag[]>([]);
  const [error, setError] = useState('');

  const toggle = (t: TrailTag) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const submit = async () => {
    setError('');
    const res = await fetch('/api/trails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dogId, name, mapQuery, note, minutes, tags: picked }),
    });
    if (res.ok) return onDone();
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? '등록하지 못했어요.');
  };

  return (
    <div className="profile-form">
      <h2>산책로 등록</h2>
      <p className="form-intro">내 동네에 등록됩니다. 이웃 견주들이 보게 돼요.</p>

      <label>
        산책로 이름
        <input value={name} placeholder="망원한강공원 산책길" onChange={(e) => setName(e.target.value)} />
      </label>

      {/* 산책로 이름은 별칭이라 지도에 없는 경우가 많다.
          "망원한강공원 산책길"은 검색 결과가 0건이고 "망원한강공원"은 나온다. */}
      <label>
        지도에서 찾을 장소 <span className="hint">비워두면 산책로 이름으로 찾아요</span>
        <input
          value={mapQuery}
          placeholder="망원한강공원"
          onChange={(e) => setMapQuery(e.target.value)}
        />
      </label>

      <label>
        한줄평
        <input
          value={note}
          placeholder="넓고 평평해서 소형견도 편해요"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <label>
        걸리는 시간
        <div className="age">
          <input
            type="number"
            min={5}
            max={240}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
          <span>분</span>
        </div>
      </label>

      <fieldset>
        <legend>이런 곳이에요</legend>
        {tags.map((t) => (
          <label key={t} className="inline">
            <input type="checkbox" checked={picked.includes(t)} onChange={() => toggle(t)} />
            {t}
          </label>
        ))}
      </fieldset>

      {error && <p className="error">{error}</p>}

      <div className="request-actions">
        <button type="button" className="primary" onClick={submit}>
          등록
        </button>
        <button type="button" className="ghost" onClick={onDone}>
          취소
        </button>
      </div>
    </div>
  );
}

export function Trails({ dogId }: { dogId: string }) {
  const [screen, setScreen] = useState<Screen | null>(null);
  const [adding, setAdding] = useState(false);
  // 불러오기 전에 "0개"를 보여주면 견주는 산책로가 없다고 오해한다
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    return load(dogId)
      .then(setScreen)
      .catch(() => setScreen(null))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    refresh();
  }, [dogId]);

  if (adding) {
    return (
      <TrailForm
        dogId={dogId}
        tags={screen?.tags ?? []}
        onDone={() => {
          setAdding(false);
          refresh();
        }}
      />
    );
  }

  if (loading && !screen) {
    return (
      <section>
        <h2>근처 산책로</h2>
        <p className="notice">불러오는 중…</p>
      </section>
    );
  }

  return (
    <section>
      <h2>
        근처 산책로 {screen && <span className="count">{screen.trails.length}</span>}
      </h2>

      <button type="button" className="primary" onClick={() => setAdding(true)}>
        산책로 등록
      </button>

      {!screen && <p className="error">산책로를 불러오지 못했어요. 잠시 뒤에 다시 시도해주세요.</p>}

      {screen && screen.trails.length === 0 && (
        <div className="empty">
          <p>아직 근처에 등록된 산책로가 없어요. 좋았던 길을 남겨주세요.</p>
        </div>
      )}

      <ul className="cards">
        {screen?.trails.map((t) => (
          <li key={t.id} className={`card ${t.nearby ? 'good' : 'muted'}`}>
            <div className="card-head">
              <strong className="name">{t.name}</strong>
              <span className="subtitle">{t.subtitle}</span>
            </div>
            {t.note && <p className="highlight">{t.note}</p>}
            {t.tags.length > 0 && (
              <p className="trail-tags">{t.tags.map((tag) => `#${tag}`).join(' ')}</p>
            )}
            {t.nightWarning && <p className="alternative">{t.nightWarning}</p>}
            <a className="map-link" href={t.mapUrl} target="_blank" rel="noreferrer noopener">
              카카오맵에서 보기
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
