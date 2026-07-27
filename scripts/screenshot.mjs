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

const clickTarget = process.argv[4];
if (clickTarget) {
  await page.locator(clickTarget).first().click();
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
