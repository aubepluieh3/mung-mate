import { findMatches } from '../src/match.ts';
import { toView, GROUP_HEADING, firstMeetingNotice } from '../src/present.ts';
import { me, allDogs, districts } from '../sample/neighborhood.ts';

/** 견주가 실제로 보게 될 화면. 점수와 계산식은 나오지 않는다. */
/** 사용법: node --experimental-strip-types scripts/demo.ts [강아지이름] */

const NOW = new Date('2026-07-27T00:00:00Z');
const dogs = allDogs();
const wanted = process.argv[2];
const viewer = wanted ? dogs.find((d) => d.name === wanted) : me;

if (!viewer) {
  console.error(`'${wanted}' 를 찾을 수 없습니다. 등록된 이름: ${dogs.map((d) => d.name).join(', ')}`);
  process.exit(1);
}

const matches = findMatches(viewer, dogs, { now: NOW, districts });

console.log(
  `\n${viewer.name} · ${viewer.breed} ${viewer.weightKg}kg · ${Math.floor(viewer.ageMonths / 12)}살 · ${viewer.temperaments.join(', ') || '태그 없음'}`,
);
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
  console.log(`  ${v.reach}`);
  console.log(`  ${v.requestable ? '' : '🚫 '}${v.verdict}`);
  if (v.highlight) console.log(`     ${v.highlight}`);
  for (const w of v.watchOuts) console.log(`     · ${w}`);
  console.log(`     ${v.guidance}`);
  console.log(`     ${v.requestable ? '[ 산책 요청 보내기 ]' : '[ 요청 보낼 수 없음 ]'}`);
  console.log();
}
