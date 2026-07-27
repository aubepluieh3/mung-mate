/**
 * 화면을 눈으로 확인하는 도구. 시스템에 설치된 Edge 를 쓴다(브라우저 내려받지 않음).
 * 사용법: node scripts/screenshot.mjs http://localhost:5176/ out.png [클릭할셀렉터]
 */
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'screenshot.png';

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 480, height: 1400 } });

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('h1', { timeout: 10000 });

// 4번째 인자부터는 순서대로 클릭할 셀렉터.
// --reload 를 끼우면 그 지점에서 새로고침한다 — 저장이 실제로 남는지 확인할 때 쓴다.
for (const step of process.argv.slice(4)) {
  if (step === '--reload') {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('h1');
    continue;
  }
  await page.locator(step).first().click();
  await page.waitForTimeout(150);
}

const result = {
  heading: await page.textContent('h1'),
  sections: await page.locator('h2').allTextContents(),
  cards: await page.locator('.card').count(),
  verdicts: await page.locator('.verdict').allTextContents(),
  errors,
};

await page.screenshot({ path: out, fullPage: true });
await browser.close();

console.log(JSON.stringify(result, null, 2));
