import type { Dog } from '../src/dog.ts';

/**
 * 동네 샘플. 서버가 없으니 이웃은 이 목록이 전부다.
 *
 * 판정이 실제로 어떻게 보이는지 확인할 수 있게 룰마다 걸리는 개를 하나씩 넣었다 —
 * 접종 전(새싹), 체급 차단(초코), 미중성화 암컷(나비), 노견(할부지).
 */

/** 지금 운영하는 동네. 동네 사이 거리를 알 방법이 없어 같은 동끼리만 만난다. */
export const DISTRICTS = ['성산동', '망원동', '연남동', '합정동'];

const dog = (
  id: string,
  name: string,
  breed: string,
  ageMonths: number,
  weightKg: number,
  sex: Dog['sex'],
  neutered: boolean,
  district: string,
  walkTimes: Dog['walkTimes'],
): Dog => ({ id, name, breed, ageMonths, weightKg, sex, neutered, district, walkTimes });

export const neighborhood: Dog[] = [
  dog('bori', '보리', '말티즈', 36, 7, 'female', true, '성산동', ['아침', '저녁']),
  dog('kong', '콩이', '믹스', 48, 9, 'male', true, '성산동', ['저녁']),
  dog('bangul', '방울', '포메라니안', 24, 10, 'male', true, '성산동', ['점심', '저녁']),
  dog('kkami', '까미', '닥스훈트', 96, 6, 'male', true, '성산동', ['밤']),
  dog('byeol', '별이', '보더콜리', 40, 20, 'female', true, '성산동', ['아침', '저녁']),

  // 체급 3배 이상 → 소형견과 차단
  dog('choco', '초코', '리트리버', 60, 30, 'male', false, '성산동', ['아침', '저녁']),
  // 4개월 미만 → 접종 전이라 누구와도 차단
  dog('saessak', '새싹', '푸들', 3, 4, 'female', false, '성산동', ['점심']),
  // 미중성화 암컷 → 미중성화 수컷과 차단
  dog('nabi', '나비', '진돗개', 48, 15, 'female', false, '성산동', ['밤']),
  // 노견 → 퍼피와 경고
  dog('grandpa', '할부지', '시바', 144, 11, 'male', true, '성산동', ['아침']),

  dog('dubu', '두부', '코카스파니엘', 72, 12, 'female', true, '망원동', ['저녁']),
  dog('mungchi', '뭉치', '비숑', 42, 8, 'male', false, '연남동', ['밤']),
  dog('heundung', '흰둥', '진돗개', 18, 25, 'male', false, '합정동', ['아침']),
];
