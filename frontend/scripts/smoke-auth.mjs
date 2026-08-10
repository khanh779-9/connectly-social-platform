import { chromium } from 'playwright';

const base = 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Pretend we are signed in so the router lets us into the app pages.
await page.addInitScript(() => {
  localStorage.setItem(
    'connectly.auth',
    JSON.stringify({
      accessToken: 'smoke-access-token',
      refreshToken: 'smoke-refresh-token',
      userId: 'smoke-user-id',
      displayName: 'Smoke Tester',
      rememberMe: true,
    }),
  );
});

const problems = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  const text = message.text();
  // The backend is offline in this smoke test, so failed API calls are expected.
  if (message.type() === 'error' && !text.includes('ERR_CONNECTION_REFUSED')) {
    problems.push(`console: ${text}`);
  }
});

const routes = ['/', '/profile', '/messages', '/settings', '/explore', '/bookmarks'];

for (const route of routes) {
  await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);

  const shell = await page.locator('header').count();
  const heading = await page.locator('h1').first().textContent().catch(() => '(none)');
  console.log(`${route.padEnd(12)} -> ${page.url().replace(base, '')}  headers=${shell}  h1="${heading?.trim()}"`);
  await page.screenshot({ path: `output/playwright/auth${route.replace(/\//g, '-') || '-root'}.png` });
}

console.log('\nProblems (ignoring the offline backend):');
console.log(problems.length ? problems.join('\n') : '(none)');

await browser.close();
