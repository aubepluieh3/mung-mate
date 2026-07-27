import { useMemo, useState } from 'react';
import { findMatches, type MatchGroup } from '../src/match.ts';
import { toView, GROUP_HEADING, firstMeetingNotice, type MatchView } from '../src/present.ts';
import { allDogs } from '../sample/neighborhood.ts';

const years = (months: number) => Math.floor(months / 12);

/** 이 단계는 목록에서 한 줄로 접는다. 안 만날 상대에게 카드 한 장을 주면 목록이 안 읽힌다. */
const isCompact = (view: MatchView) => view.tier === 'low';

function RequestPanel({ view, onClose }: { view: MatchView; onClose: () => void }) {
  return (
    <div className="request">
      {/* 안내 문장이 실제로 읽히는 시점은 만나기로 결정하는 순간이다.
          카드마다 반복해서 붙이면 아무도 읽지 않는다. */}
      <p className="request-guide">{view.guidance}</p>
      <div className="request-actions">
        <button type="button" className="primary">
          {view.name}에게 요청 보내기
        </button>
        <button type="button" className="ghost" onClick={onClose}>
          취소
        </button>
      </div>
    </div>
  );
}

function DogCard({ view }: { view: MatchView }) {
  const [requesting, setRequesting] = useState(false);

  if (isCompact(view)) {
    return (
      <li className={`card ${view.tier} compact`}>
        <div className="card-head">
          <strong className="name">{view.name}</strong>
          <span className="subtitle">{view.subtitle}</span>
          <span className="verdict-inline">{view.verdict}</span>
        </div>
        <details>
          <summary>왜 그런지 보기</summary>
          {view.watchOuts.map((w) => (
            <p key={w} className="watch-out">
              {w}
            </p>
          ))}
        </details>
      </li>
    );
  }

  return (
    <li className={`card ${view.tier}`}>
      <div className="card-head">
        <strong className="name">{view.name}</strong>
        <span className="subtitle">{view.subtitle}</span>
      </div>

      <p className="verdict">{view.verdict}</p>
      {view.highlight && <p className="highlight">{view.highlight}</p>}

      {view.watchOuts.length > 0 && (
        <ul className="watch-outs">
          {view.watchOuts.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {/* 차단된 조합에는 버튼을 두지 않는다. 누를 수 없는 버튼은 자리만 차지한다. */}
      {view.requestable &&
        (requesting ? (
          <RequestPanel view={view} onClose={() => setRequesting(false)} />
        ) : (
          <button type="button" className="primary" onClick={() => setRequesting(true)}>
            산책 요청 보내기
          </button>
        ))}

      {!view.requestable && <p className="alternative">{view.guidance}</p>}
    </li>
  );
}

export function App() {
  const dogs = useMemo(() => allDogs(), []);
  const [viewerId, setViewerId] = useState(dogs[0].id);
  const viewer = dogs.find((d) => d.id === viewerId)!;

  const groups = useMemo(() => {
    const found = findMatches(viewer, dogs).map(toView);
    const order: MatchGroup[] = ['match', 'unknown', 'blocked'];
    return order
      .map((group) => ({
        group,
        items: found.filter((v) =>
          group === 'blocked'
            ? v.tier === 'blocked'
            : group === 'unknown'
              ? v.tier === 'unknown'
              : v.tier !== 'blocked' && v.tier !== 'unknown',
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [viewer, dogs]);

  return (
    <main>
      <header>
        <h1>멍메이트</h1>
        <label>
          내 강아지
          <select value={viewerId} onChange={(e) => setViewerId(e.target.value)}>
            {dogs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.breed} {d.weightKg}kg · {years(d.ageMonths)}살
              </option>
            ))}
          </select>
        </label>
        <p className="my-tags">
          {viewer.temperaments.join(' · ') || '성향을 아직 적지 않았어요'}
          {viewer.sensitiveToDogs && ' · 낯선 개에게 예민해요'}
        </p>
      </header>

      <p className="notice">{firstMeetingNotice}</p>

      {groups.map(({ group, items }) =>
        // 권하지 않는 조합은 접어둔다. 이유는 볼 수 있어야 하지만 매번 펼쳐져 있을 필요는 없다.
        group === 'blocked' ? (
          <details key={group} className="blocked-section">
            <summary>
              {GROUP_HEADING[group]} <span className="count">{items.length}</span>
            </summary>
            <ul className="cards">
              {items.map((view) => (
                <DogCard key={view.name} view={view} />
              ))}
            </ul>
          </details>
        ) : (
          <section key={group}>
            <h2>
              {GROUP_HEADING[group]} <span className="count">{items.length}</span>
            </h2>
            <ul className="cards">
              {items.map((view) => (
                <DogCard key={view.name} view={view} />
              ))}
            </ul>
          </section>
        ),
      )}
    </main>
  );
}
