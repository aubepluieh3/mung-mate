import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMatches } from '../src/match.ts';
import { toView } from '../src/present.ts';
import { me, neighborhood, allDogs } from '../sample/neighborhood.ts';

const NOW = new Date('2026-07-27T00:00:00Z');
const views = findMatches(me, neighborhood, NOW).map(toView);
const byName = (name: string) => views.find((v) => v.name === name)!;

/** 다른 견주 시점으로 본 화면. 시점을 바꾸면 룰의 이상함이 드러난다. */
const viewFrom = (viewerName: string, targetName: string) => {
  const dogs = allDogs();
  const viewer = dogs.find((d) => d.name === viewerName)!;
  return findMatches(viewer, dogs, NOW).map(toView).find((v) => v.name === targetName)!;
};

/** 점수와 산식이 새어나가는 패턴. 체급 "1.9배" 같은 정보는 견주에게 유용하므로 허용한다. */
const LEAK = /×|\d+\s*점|[+-]\d+\s/;

test('점수와 계산식은 화면에 나오지 않는다', () => {
  for (const v of views) {
    assert.equal('score' in v, false);
    const text = [v.verdict, v.highlight ?? '', ...v.watchOuts, v.guidance].join(' ');
    assert.ok(!LEAK.test(text), `산식이 노출됨: ${v.name} — ${text}`);
  }
});

test('등급은 점수 대신 문장으로 나온다', () => {
  assert.equal(byName('보리').verdict, '잘 맞을 것 같아요'); // 90점
  assert.equal(byName('할부지').verdict, '괜찮은 편이에요'); // 68점
  assert.equal(byName('까미').verdict, '천천히 만나보세요'); // 38점
  assert.equal(byName('방울').verdict, '성향이 많이 달라요'); // 8점
});

test('안전 경고가 붙은 조합은 최상위 등급으로 올리지 않는다', () => {
  // 초코와 흰둥은 궁합 점수가 높지만 둘 다 중성화하지 않은 성견 수컷이다
  const heundung = viewFrom('초코', '흰둥');
  assert.notEqual(heundung.verdict, '잘 맞을 것 같아요');
  assert.equal(heundung.verdict, '괜찮은 편이에요');
  assert.ok(heundung.watchOuts.some((w) => w.includes('중성화하지 않은 성견 수컷')));
});

test('점수가 낮은 원인이 성향인지 조건인지 구분해서 말한다', () => {
  // 토리(겁많음) → 방울(활발+개좋아함): 체급은 비슷하고 성향이 정면으로 부딪힌다
  assert.equal(byName('방울').verdict, '성향이 많이 달라요');
  // 토리(8kg 겁많음) → 별이(20kg 차분+개좋아함): 성향은 나쁘지 않은데 체급 2.5배가 깎았다
  assert.equal(byName('별이').verdict, '조건 차이가 커요');
});

test('차단은 상대가 아니라 조합의 문제로 표현한다', () => {
  const choco = byName('초코');
  assert.equal(choco.verdict, '이 조합은 권하지 않아요');
  assert.equal(choco.requestable, false);
});

test('차단으로 끝내지 않고 다음에 뭘 하면 되는지 알려준다', () => {
  assert.match(byName('초코').guidance, /체급이 비슷한 친구/);
  assert.match(byName('새싹').guidance, /접종을 마친 뒤/);
});

test('첫 만남 안내는 궁합이 좋아도 똑같이 붙는다', () => {
  // 룰이 놓친 위험은 절차가 막는다. 점수가 높을 때 안내를 완화하면 그 방심이 사고를 만든다
  assert.equal(byName('보리').guidance, byName('까미').guidance);
  assert.match(byName('보리').guidance, /목줄/);
});

test('미리 알아둘 점은 두 개까지만 보여준다', () => {
  for (const v of views) assert.ok(v.watchOuts.length <= 2);
  assert.equal(byName('별이').watchOuts.length, 2); // 게이트 경고 + 성향 충돌 + 체급 중 둘만
});

test('경고가 있어도 좋은 점을 같이 보여준다', () => {
  const byeol = byName('별이');
  assert.ok(byeol.highlight?.includes('차분해서'));
  assert.ok(byeol.watchOuts.length > 0);
  assert.equal(byeol.requestable, true);
});

test('차단된 상대에게는 주의사항을 나열하지 않는다', () => {
  assert.deepEqual(byName('초코').watchOuts, []);
  assert.equal(byName('초코').highlight, undefined);
});

test('성향을 안 적은 상대는 위험한 게 아니라 정보가 없는 것으로 표현한다', () => {
  const kong = byName('콩이');
  assert.equal(kong.verdict, '아직 성향을 적지 않은 친구예요');
  assert.equal(kong.requestable, true);
  assert.match(kong.guidance, /성향을 알 수 없으니/);
});

test('견종·체급·나이는 그대로 보여준다', () => {
  assert.equal(byName('보리').subtitle, '말티즈 · 7kg · 3살');
});
