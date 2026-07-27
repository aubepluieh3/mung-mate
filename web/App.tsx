import { useMemo, useState } from 'react';
import { WALK_TIMES, type Dog, type WalkTime } from '../src/dog.ts';
import {
  describe,
  emptyMessage,
  findMatches,
  FIRST_MEETING_NOTICE,
  VERDICT_LABEL,
  type Match,
} from '../src/match.ts';
import { DISTRICTS, neighborhood } from '../sample/neighborhood.ts';
import { blankDog, load, save } from './storage.ts';

/** 우리 개를 등록하고, 동네에서 만나도 되는 친구를 확인한다. 이 앱은 그것만 한다. */

function ProfileForm({
  dog,
  onSave,
  onCancel,
}: {
  dog: Dog;
  onSave: (dog: Dog) => void;
  /** 처음 등록하는 중이면 없다 — 취소할 이전 프로필이 없다. */
  onCancel?: () => void;
}) {
  const isNew = !onCancel;
  const [draft, setDraft] = useState(dog);
  const [years, setYears] = useState(Math.floor(dog.ageMonths / 12));
  const [months, setMonths] = useState(dog.ageMonths % 12);
  // 성별은 중성화 관련 룰에 직결된다. 기본값을 넣어두면 안 바꾸고 지나쳐 판정이 틀린다
  const [sexPicked, setSexPicked] = useState(!isNew);
  const [error, setError] = useState('');

  const patch = (over: Partial<Dog>) => setDraft((d) => ({ ...d, ...over }));

  const toggleTime = (t: WalkTime) => {
    const now = draft.walkTimes ?? [];
    patch({ walkTimes: now.includes(t) ? now.filter((x) => x !== t) : [...now, t] });
  };

  const submit = () => {
    if (!draft.name.trim()) return setError('이름을 적어주세요.');
    if (!(draft.weightKg > 0)) return setError('몸무게를 적어주세요.');
    if (!sexPicked) return setError('성별을 골라주세요.');
    onSave({
      ...draft,
      name: draft.name.trim(),
      breed: draft.breed.trim() || '믹스',
      ageMonths: years * 12 + months,
    });
  };

  return (
    <div className="form">
      <h2>{isNew ? '우리 강아지를 등록해주세요' : '내 강아지 정보'}</h2>
      {isNew && <p className="hint">정확한 주소는 받지 않고 동네까지만 씁니다.</p>}

      <label>
        이름
        <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
      </label>

      <label>
        견종
        <input
          value={draft.breed}
          placeholder="믹스"
          onChange={(e) => patch({ breed: e.target.value })}
        />
      </label>

      <div className="row">
        <label>
          나이
          <span className="units">
            <input
              type="number"
              min={0}
              value={years}
              onChange={(e) => setYears(Math.max(0, Number(e.target.value)))}
            />
            살
            <input
              type="number"
              min={0}
              max={11}
              value={months}
              onChange={(e) => setMonths(Math.min(11, Math.max(0, Number(e.target.value))))}
            />
            개월
          </span>
        </label>
        <label>
          몸무게
          <span className="units">
            <input
              type="number"
              min={0}
              step={0.1}
              value={draft.weightKg}
              onChange={(e) => patch({ weightKg: Number(e.target.value) })}
            />
            kg
          </span>
        </label>
      </div>

      <fieldset>
        <legend>성별</legend>
        {(['male', 'female'] as const).map((sex) => (
          <label key={sex} className="inline">
            <input
              type="radio"
              checked={sexPicked && draft.sex === sex}
              onChange={() => {
                setSexPicked(true);
                patch({ sex });
              }}
            />
            {sex === 'male' ? '수컷' : '암컷'}
          </label>
        ))}
        <label className="inline">
          <input
            type="checkbox"
            checked={draft.neutered}
            onChange={(e) => patch({ neutered: e.target.checked })}
          />
          중성화했어요
        </label>
      </fieldset>

      {sexPicked && !draft.neutered && (
        <p className="notice">
          중성화하지 않은 암수는 서로 만나지 않도록 안내하고 있어요. 발정기에는 다른 친구와의 만남을
          미뤄주세요.
        </p>
      )}

      <label>
        동네
        <select
          value={draft.district ?? ''}
          onChange={(e) => patch({ district: e.target.value || undefined })}
        >
          <option value="">선택해주세요</option>
          {DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      {/* 목록에 자기 동네가 없는 견주가 이유를 모르고 떠나면 안 된다 */}
      <p className="hint">
        지금은 서울 마포구 {DISTRICTS.join(' · ')} 에서만 운영해요. 다른 동네는 준비 중입니다.
      </p>

      <fieldset>
        <legend>주로 산책하는 시간대</legend>
        {WALK_TIMES.map((t) => (
          <label key={t} className="inline">
            <input
              type="checkbox"
              checked={draft.walkTimes?.includes(t) ?? false}
              onChange={() => toggleTime(t)}
            />
            {t}
          </label>
        ))}
      </fieldset>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button type="button" className="primary" onClick={submit}>
          {isNew ? '등록하고 친구 찾기' : '저장'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const { dog, verdict, reasons, when, reachable } = match;
  return (
    <li className={`card ${verdict}${reachable ? '' : ' far'}`}>
      <div className="head">
        <strong>{dog.name}</strong>
        <span className="sub">{describe(dog)}</span>
      </div>
      <p className="when">{when}</p>
      <p className="verdict">{VERDICT_LABEL[verdict]}</p>
      {/* 차단이든 경고든 이유는 반드시 보여준다 — 모르면 견주는 판단을 신뢰하지 않는다 */}
      {reasons.map((r) => (
        <p key={r} className="reason">
          {r}
        </p>
      ))}
    </li>
  );
}

export function App() {
  const [myDog, setMyDog] = useState(load);
  const [editing, setEditing] = useState(false);

  const matches = useMemo(() => (myDog ? findMatches(myDog, neighborhood) : []), [myDog]);
  const canMeet = matches.filter((m) => m.reachable && m.verdict !== 'blocked');

  const onSave = (dog: Dog) => {
    setMyDog(dog);
    save(dog);
    setEditing(false);
  };

  // 등록한 프로필이 없으면 등록부터 받는다
  if (!myDog || editing) {
    return (
      <main>
        <h1>멍메이트</h1>
        <ProfileForm
          dog={myDog ?? blankDog()}
          onSave={onSave}
          onCancel={myDog ? () => setEditing(false) : undefined}
        />
      </main>
    );
  }

  return (
    <main>
      <h1>멍메이트</h1>

      <div className="me">
        <div>
          <strong>{myDog.name}</strong> <span className="sub">{describe(myDog)}</span>
          <p className="sub">
            {myDog.district} · {myDog.walkTimes?.join(', ') || '산책 시간대 미기재'}
          </p>
        </div>
        <button type="button" onClick={() => setEditing(true)}>
          수정
        </button>
      </div>

      {/* 판정 결과와 무관하게 항상 같은 안내를 붙인다.
          "만나도 좋아요"일 때 완화하면 그 방심이 사고를 만든다 */}
      <p className="notice">{FIRST_MEETING_NOTICE}</p>

      {canMeet.length === 0 && (
        <div className="empty">
          <p>{emptyMessage(myDog, matches)}</p>
          <button type="button" onClick={() => setEditing(true)}>
            프로필 고치기
          </button>
        </div>
      )}

      <ul className="cards">
        {matches.map((m) => (
          <MatchCard key={m.dog.id} match={m} />
        ))}
      </ul>
    </main>
  );
}
