import { useMemo, useState } from 'react';
import { findMatches, type MatchGroup } from '../src/match.ts';
import { toView, GROUP_HEADING, firstMeetingNotice, type MatchView } from '../src/present.ts';
import { me, neighborhood, districts } from '../sample/neighborhood.ts';
import type { Dog } from '../src/dog.ts';
import { ProfileForm } from './ProfileForm.tsx';
import { loadMyDog, saveMyDog, loadRequests, saveRequests } from './storage.ts';

/** 이 단계는 목록에서 한 줄로 접는다. 안 만날 상대에게 카드 한 장을 주면 목록이 안 읽힌다. */
const isCompact = (view: MatchView) => view.tier === 'low';

type CardProps = {
  view: MatchView;
  group: MatchGroup;
  requested: boolean;
  onRequest: (id: string) => void;
};

function RequestPanel({ view, onSend, onClose }: { view: MatchView; onSend: () => void; onClose: () => void }) {
  return (
    <div className="request">
      {/* 안내 문장이 실제로 읽히는 시점은 만나기로 결정하는 순간이다.
          카드마다 반복해서 붙이면 아무도 읽지 않는다. */}
      <p className="request-guide">{view.guidance}</p>
      <div className="request-actions">
        <button type="button" className="primary" onClick={onSend}>
          {view.name}에게 요청 보내기
        </button>
        <button type="button" className="ghost" onClick={onClose}>
          취소
        </button>
      </div>
    </div>
  );
}

function DogCard({ view, group, requested, onRequest }: CardProps) {
  const [opening, setOpening] = useState(false);
  // 만날 수 없는 상대는 톤을 낮춘다. 못 만나는 상대를 강조하면 목록이 거짓말을 한다.
  const cls = `card ${view.tier}${group === 'far' ? ' muted' : ''}`;

  if (isCompact(view)) {
    return (
      <li className={`${cls} compact`}>
        <div className="card-head">
          <strong className="name">{view.name}</strong>
          <span className="subtitle">{view.subtitle}</span>
          <span className="verdict-inline">{view.verdict}</span>
        </div>
        <p className="reach">{view.reach}</p>
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
    <li className={cls}>
      <div className="card-head">
        <strong className="name">{view.name}</strong>
        <span className="subtitle">{view.subtitle}</span>
      </div>

      {/* 만날 수 있는지가 궁합보다 먼저 읽혀야 한다 */}
      <p className="reach">{view.reach}</p>

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
        (requested ? (
          <p className="requested">산책 요청을 보냈어요 · 답을 기다리는 중</p>
        ) : opening ? (
          <RequestPanel
            view={view}
            onSend={() => {
              onRequest(view.id);
              setOpening(false);
            }}
            onClose={() => setOpening(false)}
          />
        ) : (
          <button type="button" className="primary" onClick={() => setOpening(true)}>
            산책 요청 보내기
          </button>
        ))}

      {!view.requestable && <p className="alternative">{view.guidance}</p>}
    </li>
  );
}

const profileSummary = (dog: Dog) =>
  [
    dog.district,
    dog.walkTimes?.length ? `${dog.walkTimes.join(', ')} 산책` : '산책 시간대 미기재',
    dog.temperaments.join(' · ') || '성향 미기재',
    dog.sensitiveToDogs ? '낯선 개에게 예민해요' : null,
    dog.inHeat ? '발정 중' : null,
  ]
    .filter(Boolean)
    .join(' · ');

export function App() {
  const [myDog, setMyDog] = useState<Dog>(() => loadMyDog(me));
  const [editing, setEditing] = useState(false);
  const [requested, setRequested] = useState<string[]>(() => loadRequests());

  const groups = useMemo(() => {
    const found = findMatches(myDog, neighborhood, { districts });
    const order: MatchGroup[] = ['reachable', 'far', 'blocked'];
    return order
      .map((group) => ({
        group,
        items: found.filter((m) => m.group === group).map(toView),
      }))
      .filter((g) => g.items.length > 0);
  }, [myDog]);

  const save = (dog: Dog) => {
    setMyDog(dog);
    saveMyDog(dog);
    setEditing(false);
  };

  const request = (id: string) => {
    const next = [...new Set([...requested, id])];
    setRequested(next);
    saveRequests(next);
  };

  if (editing) {
    return (
      <main>
        <h1>멍메이트</h1>
        <ProfileForm
          dog={myDog}
          districts={Object.keys(districts)}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      </main>
    );
  }

  return (
    <main>
      <header>
        <h1>멍메이트</h1>
        <div className="my-dog">
          <div>
            <strong>{myDog.name}</strong>
            <span className="subtitle">
              {myDog.breed} · {myDog.weightKg}kg · {Math.floor(myDog.ageMonths / 12)}살
            </span>
            <p className="my-tags">{profileSummary(myDog)}</p>
          </div>
          <button type="button" className="ghost" onClick={() => setEditing(true)}>
            수정
          </button>
        </div>
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
                <DogCard
                  key={view.id}
                  view={view}
                  group={group}
                  requested={requested.includes(view.id)}
                  onRequest={request}
                />
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
                <DogCard
                  key={view.id}
                  view={view}
                  group={group}
                  requested={requested.includes(view.id)}
                  onRequest={request}
                />
              ))}
            </ul>
          </section>
        ),
      )}
    </main>
  );
}
