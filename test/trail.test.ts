import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toTrailView, TRAIL_TAGS, type Trail } from '../src/trail.ts';

const trail = (over: Partial<Trail> = {}): Trail => ({
  id: 't1',
  district: '성산동',
  name: '망원한강공원 산책길',
  note: '넓고 평평해요',
  minutes: 40,
  tags: [],
  createdBy: 'me',
  ...over,
});

test('내 동네 산책로를 구분해서 표시한다', () => {
  assert.equal(toTrailView(trail(), '성산동', false).nearby, true);
  assert.equal(toTrailView(trail(), '망원동', false).nearby, false);
  assert.equal(toTrailView(trail(), undefined, false).nearby, false);
});

test('밤에 걷는 견주에게만 조명 경고를 띄운다', () => {
  const dark = trail({ tags: ['그늘많음'] });
  const lit = trail({ tags: ['야간조명있음'] });

  assert.match(toTrailView(dark, '성산동', true).nightWarning, /어두울 수 있어요/);
  assert.equal(toTrailView(lit, '성산동', true).nightWarning, '');
  // 낮에만 걷는 견주에게는 필요 없는 정보다
  assert.equal(toTrailView(dark, '성산동', false).nightWarning, '');
});

test('동네와 소요시간을 한 줄로 보여준다', () => {
  assert.equal(toTrailView(trail(), '성산동', false).subtitle, '성산동 · 40분 코스');
});

test('목줄을 풀어도 된다는 태그는 두지 않는다', () => {
  // 동물보호법은 산책 시 목줄을 의무로 둔다.
  // 안전을 우선하는 앱이 위법을 권하는 태그를 가질 수는 없어서 울타리 정보로 대신한다
  assert.ok(!TRAIL_TAGS.some((t) => t.includes('목줄')));
  assert.ok(TRAIL_TAGS.includes('울타리있음'));
});
