import { useState } from 'react';
import type { Dog, Temperament, WalkTime } from '../src/dog.ts';

/**
 * 내 강아지 프로필 입력.
 *
 * 성향 태그는 최대 3개까지만 고르게 한다. 전부 체크할 수 있게 두면
 * 다들 전부 체크해서 태그의 판별력이 0이 된다.
 * 어떤 태그가 매칭에 유리한지는 알려주지 않는다 — 역설계를 막기 위해서다.
 */

const TEMPERAMENTS: Temperament[] = ['활발함', '차분함', '개좋아함', '사람좋아', '겁많음', '짖음많음'];
const WALK_TIMES: WalkTime[] = ['아침', '점심', '저녁', '밤'];
const MAX_TEMPERAMENTS = 3;

type Props = {
  dog: Dog;
  districts: string[];
  /** 서비스 지역 안내. 서버가 만든 문장을 그대로 보여준다 — 판정 코드를 화면으로 끌어오지 않기 위해서다. */
  areaNotice: string;
  onSave: (dog: Dog) => void;
  /** 처음 등록하는 중이면 없다 — 취소할 이전 프로필이 없다. */
  onCancel?: () => void;
};

export function ProfileForm({ dog, districts, areaNotice, onSave, onCancel }: Props) {
  const isNew = !onCancel;
  const [draft, setDraft] = useState<Dog>(dog);
  const [years, setYears] = useState(Math.floor(dog.ageMonths / 12));
  const [months, setMonths] = useState(dog.ageMonths % 12);
  // 성별은 중성화 관련 룰에 직결된다. 기본값을 넣어두면 안 바꾸고 지나쳐 판정이 틀린다
  const [sexPicked, setSexPicked] = useState(!isNew);
  const [error, setError] = useState('');

  const patch = (over: Partial<Dog>) => setDraft((d) => ({ ...d, ...over }));

  const toggleTemperament = (t: Temperament) => {
    const has = draft.temperaments.includes(t);
    if (!has && draft.temperaments.length >= MAX_TEMPERAMENTS) {
      setError(`성향은 ${MAX_TEMPERAMENTS}개까지 고를 수 있어요.`);
      return;
    }
    setError('');
    patch({
      temperaments: has
        ? draft.temperaments.filter((x) => x !== t)
        : [...draft.temperaments, t],
    });
  };

  const toggleWalkTime = (t: WalkTime) => {
    const current = draft.walkTimes ?? [];
    patch({
      walkTimes: current.includes(t) ? current.filter((x) => x !== t) : [...current, t],
    });
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
      // 성향을 저장한 시점을 남긴다. 오래되면 점수에서 신뢰를 낮춘다
      temperamentsUpdatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="profile-form">
      <h2>{isNew ? '우리 강아지를 등록해주세요' : '내 강아지 정보'}</h2>
      {isNew && (
        <p className="form-intro">
          입력한 정보로 맞는 산책 친구를 찾아드려요. 정확한 주소는 받지 않고 동네까지만 씁니다.
        </p>
      )}

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
          <div className="age">
            <input
              type="number"
              min={0}
              value={years}
              onChange={(e) => setYears(Math.max(0, Number(e.target.value)))}
            />
            <span>살</span>
            <input
              type="number"
              min={0}
              max={11}
              value={months}
              onChange={(e) => setMonths(Math.min(11, Math.max(0, Number(e.target.value))))}
            />
            <span>개월</span>
          </div>
        </label>

        <label>
          몸무게
          <div className="age">
            <input
              type="number"
              min={0}
              step={0.1}
              value={draft.weightKg}
              onChange={(e) => patch({ weightKg: Number(e.target.value) })}
            />
            <span>kg</span>
          </div>
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

      {/* 발정 여부는 묻지 않는다. 켜고 끄는 걸 기억해야 하는 값은 프로필에 둘 수 없다.
          대신 판정하지 않고 알려준다 — 룰이 못 잡는 건 절차로 막는다. */}
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
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      {/* 목록에 자기 동네가 없는 견주가 이유를 모르고 떠나면 안 된다 */}
      <p className="hint area-notice">{areaNotice}</p>

      <fieldset>
        <legend>주로 산책하는 시간대</legend>
        {WALK_TIMES.map((t) => (
          <label key={t} className="inline">
            <input
              type="checkbox"
              checked={draft.walkTimes?.includes(t) ?? false}
              onChange={() => toggleWalkTime(t)}
            />
            {t}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>
          성향 <span className="hint">최대 {MAX_TEMPERAMENTS}개 · 보통 이런 편이에요</span>
        </legend>
        {TEMPERAMENTS.map((t) => (
          <label key={t} className="inline">
            <input
              type="checkbox"
              checked={draft.temperaments.includes(t)}
              onChange={() => toggleTemperament(t)}
            />
            {t}
          </label>
        ))}
      </fieldset>

      <label className="inline highlight-field">
        <input
          type="checkbox"
          checked={draft.sensitiveToDogs === true}
          onChange={(e) => patch({ sensitiveToDogs: e.target.checked })}
        />
        낯선 개에게 예민한 편이에요
        <span className="hint">같은 사정인 친구를 먼저 보여드려요</span>
      </label>

      {error && <p className="error">{error}</p>}

      <div className="request-actions">
        <button type="button" className="primary" onClick={submit}>
          {isNew ? '등록하고 친구 찾기' : '저장'}
        </button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </div>
  );
}
