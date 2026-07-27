import { findMatches } from '../src/match.ts';
import { toView, GROUP_HEADING, firstMeetingNotice } from '../src/present.ts';
import { me, neighborhood } from '../sample/neighborhood.ts';

/** 견주가 실제로 보게 될 화면. 점수와 계산식은 나오지 않는다. */

const NOW = new Date('2026-07-27T00:00:00Z');
const matches = findMatches(me, neighborhood, NOW);

console.log(`\n${me.name} · ${me.breed} ${me.weightKg}kg · ${Math.floor(me.ageMonths / 12)}살`);
console.log(`우리 동네 산책 친구 ${matches.length}마리\n`);
console.log(`  ${firstMeetingNotice}\n`);

let group = '';
for (const m of matches) {
  if (m.group !== group) {
    group = m.group;
    console.log(`\n【 ${GROUP_HEADING[m.group]} 】\n`);
  }

  const v = toView(m);
  console.log(`  ${v.name}  ·  ${v.subtitle}`);
  console.log(`  ${v.requestable ? '' : '🚫 '}${v.verdict}`);
  if (v.highlight) console.log(`     ${v.highlight}`);
  for (const w of v.watchOuts) console.log(`     · ${w}`);
  console.log(`     ${v.guidance}`);
  console.log(`     ${v.requestable ? '[ 산책 요청 보내기 ]' : '[ 요청 보낼 수 없음 ]'}`);
  console.log();
}
