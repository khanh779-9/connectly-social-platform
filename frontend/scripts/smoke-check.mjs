import { chromium } from 'playwright';

const base = 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const problems = [];
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

// 1. Root without a session should send the visitor to the login page.
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
console.log('URL after "/"      :', page.url());
console.log('H1 on "/"          :', await page.locator('h1').first().textContent().catch(() => '(none)'));
await page.screenshot({ path: 'output/playwright/root.png', fullPage: true });

// 2. The login page itself.
await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
console.log('URL after "/login" :', page.url());
console.log('H1 on "/login"     :', await page.locator('h1').first().textContent().catch(() => '(none)'));
await page.screenshot({ path: 'output/playwright/login.png', fullPage: true });

// 3. A protected route without a session should also end up on the login page.
await page.goto(`${base}/messages`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
console.log('URL after "/messages":', page.url());

// 4. Filling the form must not crash the page (the backend is offline here).
const email = page.locator('input[type="email"], input[name="email"]').first();
if (await email.count()) {
  await email.fill('smoke@example.com');
  const password = page.locator('input[type="password"]').first();
  await password.fill('SmokeTest123!');
  const submit = page.locator('button[type="submit"]').first();
  if (await submit.count()) {
    await submit.click();
    await page.waitForTimeout(2000);
    console.log('URL after submit   :', page.url());
  }
}
await page.screenshot({ path: 'output/playwright/login-filled.png', fullPage: true });

console.log('\nProblems seen in the browser:');
console.log(problems.length ? problems.join('\n') : '(none)');

await browser.close();
