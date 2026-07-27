/** 강아지 이름에 조사를 붙인다. 견주에게 그대로 보여줄 문장이라 "방울가" 같은 게 나오면 안 된다. */

const hasFinalConsonant = (word: string): boolean => {
  const last = word.trim().at(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false; // 한글 음절이 아니면 받침 없는 것으로 본다
  return (code - 0xac00) % 28 !== 0;
};

/** 이 / 가 */
export const subj = (name: string) => `${name}${hasFinalConsonant(name) ? '이' : '가'}`;
/** 은 / 는 */
export const topic = (name: string) => `${name}${hasFinalConsonant(name) ? '은' : '는'}`;
/** 을 / 를 */
export const obj = (name: string) => `${name}${hasFinalConsonant(name) ? '을' : '를'}`;
/** 과 / 와 */
export const conj = (name: string) => `${name}${hasFinalConsonant(name) ? '과' : '와'}`;
