// Manual UI check for the new chat features, run against the seeded dev accounts:
//   1. the 3-dot menu offers "Xoá" (delete for me) and "Thu hồi" (recall for everybody)
//   2. a recalled message shows the faint "Tin nhắn đã thu hồi" hint
//   3. an attachment can be sent and is shown in the bubble
//   4. the conversation info panel offers block / unblock
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const API = 'http://localhost:5000';
const OUT = path.join(__dirname, '..', 'output', 'playwright');
const PASSWORD = 'Password123!';

function log(...args) {
  console.log('[check]', ...args);
}

async function loginApi(email) {
  const res = await fetch(`${API}/identity/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, rememberMe: false }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return body.accessToken ?? body.access_token ?? body.token;
}

async function profileOf(token) {
  const res = await fetch(`${API}/social/api/v1/me/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`profile failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function signIn(browser, email, label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('response', async (res) => {
    if (res.status() >= 400) {
      let body = '';
      try {
        body = (await res.text()).slice(0, 200);
      } catch {
        body = '(unreadable)';
      }
      errors.push(`HTTP ${res.status()} ${res.request().method()} ${res.url()} :: ${body}`);
    }
  });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  const inputs = page.locator('input');
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|đăng nhập/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  log(`${label} signed in`);
  return { context, page, errors };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  let alice = null;
  let bob = null;

  try {
    alice = await signIn(browser, 'alice@example.com', 'alice');
    bob = await signIn(browser, 'bob@example.com', 'bob');

    const bobToken = await loginApi('bob@example.com');
    const bobProfile = await profileOf(bobToken);
    log('bob userId:', bobProfile.userId);

    // Alice opens Bob's profile and starts the conversation from there.
    await alice.page.goto(`${BASE}/profile/${bobProfile.userId}`, { waitUntil: 'networkidle' });
    await alice.page.waitForTimeout(1500);
    await alice.page.screenshot({ path: path.join(OUT, '01-profile.png') });

    const messageBtn = alice.page.getByRole('button', { name: /^message$/i }).first();
    log('message button count:', await messageBtn.count());
    if ((await messageBtn.count()) > 0) {
      await messageBtn.click();
      await alice.page.waitForURL(/\/messages/, { timeout: 20000 });
      await alice.page.waitForTimeout(3000);
    }
    await alice.page.screenshot({ path: path.join(OUT, '02-messages.png') });

    // Send a plain message.
    const composer = alice.page.getByPlaceholder(/viết tin nhắn|write a message/i).first();
    await composer.fill('Xin chào, đây là tin nhắn kiểm tra');
    await alice.page.getByRole('button', { name: /gửi tin nhắn|send/i }).first().click();
    await alice.page.waitForTimeout(1800);
    await alice.page.screenshot({ path: path.join(OUT, '03-message-sent.png') });
    log('plain message sent');

    // Open the 3-dot menu of the last message.
    const menuBtn = alice.page.getByRole('button', { name: /message actions/i }).last();
    await menuBtn.click();
    await alice.page.waitForTimeout(800);
    await alice.page.screenshot({ path: path.join(OUT, '04-menu.png') });

    const menuText = await alice.page.locator('[data-msg-menu]').last().innerText();
    log('MENU TEXT:', JSON.stringify(menuText));
    log('  has "Xoá":', /xoá/i.test(menuText));
    log('  has "Thu hồi":', /thu hồi/i.test(menuText));
    log('  still has "Unsend":', /unsend/i.test(menuText));

    // Attach an image and send it.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAT0lEQVR42u3PQREAAAgDoJnc6BpjDyQgd3XSlgQCgQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdgKcWQAAAABJRU5ErkJggg==',
      'base64',
    );
    const imgPath = path.join(OUT, 'sample.png');
    fs.writeFileSync(imgPath, png);

    await alice.page.setInputFiles('input[type="file"]', imgPath);
    await alice.page.waitForTimeout(1000);
    await alice.page.screenshot({ path: path.join(OUT, '05-attachment-picked.png') });

    await alice.page.getByRole('button', { name: /gửi tin nhắn|send/i }).first().click();
    await alice.page.waitForTimeout(3500);
    await alice.page.screenshot({ path: path.join(OUT, '06-attachment-sent.png') });
    const imgCount = await alice.page.locator('[role="log"] img').count();
    log('images rendered in the log:', imgCount);

    // Recall the plain message for everybody.
    const menuBtn2 = alice.page.getByRole('button', { name: /message actions/i }).first();
    await menuBtn2.click();
    await alice.page.waitForTimeout(800);
    const recallBtn = alice.page.getByRole('button', { name: /thu hồi/i }).first();
    if ((await recallBtn.count()) > 0) {
      await recallBtn.click();
      await alice.page.waitForTimeout(2500);
      log('recalled the first message');
    } else {
      log('!! no "Thu hồi" button');
    }
    await alice.page.screenshot({ path: path.join(OUT, '07-recalled.png') });

    const bodyText = await alice.page.locator('[role="log"]').innerText();
    log('RECALLED HINT present:', /tin nhắn đã thu hồi/i.test(bodyText));

    // Bob must see the same placeholder.
    await bob.page.goto(`${BASE}/messages`, { waitUntil: 'networkidle' });
    await bob.page.waitForTimeout(2000);
    // open the conversation in the list
    const convBtn = bob.page.getByRole('button', { name: /alice nguyen/i }).first();
    if ((await convBtn.count()) > 0) {
      await convBtn.click();
      await bob.page.waitForTimeout(2500);
    } else {
      log('!! Bob could not find the conversation in his list');
    }
    await bob.page.screenshot({ path: path.join(OUT, '08-bob-view.png') });
    const bobText = await bob.page.locator('[role="log"]').first().innerText().catch(() => '');
    log('BOB sees recalled hint:', /tin nhắn đã thu hồi/i.test(bobText));

    // "Xoá" removes the message for Alice only — Bob keeps seeing it.
    const marker = `delete-for-me-${Date.now()}`;
    await alice.page.getByPlaceholder(/viết tin nhắn|write a message/i).first().fill(marker);
    await alice.page.getByRole('button', { name: /gửi tin nhắn|send/i }).first().click();
    await alice.page.waitForTimeout(1800);

    const markerMsg = alice.page.locator('[role="log"]').getByText(marker).first();
    await markerMsg.locator('xpath=ancestor::div[contains(@class,"items-end")]').locator('button[aria-label="Message actions"]').first().click();
    await alice.page.waitForTimeout(700);
    const deleteBtn = alice.page.getByRole('button', { name: /^xoá$/i }).first();
    if ((await deleteBtn.count()) > 0) {
      await deleteBtn.click();
      await alice.page.waitForTimeout(1800);
    } else {
      log('!! no "Xoá" button');
    }
    await alice.page.screenshot({ path: path.join(OUT, '10-deleted-for-me.png') });
    const aliceText = await alice.page.locator('[role="log"]').innerText();
    log('ALICE no longer sees the message:', !aliceText.includes(marker));

    await bob.page.reload({ waitUntil: 'networkidle' });
    await bob.page.waitForTimeout(1500);
    const convBtn2 = bob.page.getByRole('button', { name: /alice nguyen/i }).first();
    if ((await convBtn2.count()) > 0) {
      await convBtn2.click();
      await bob.page.waitForTimeout(2500);
    }
    const bobText2 = await bob.page.locator('[role="log"]').first().innerText().catch(() => '');
    log('BOB still sees the message:', bobText2.includes(marker));
    await bob.page.screenshot({ path: path.join(OUT, '11-bob-still-sees.png') });

    // The info panel carries block / unblock.
    const infoBtn = alice.page.getByRole('button', { name: /thông tin hội thoại|conversation info/i }).first();
    if ((await infoBtn.count()) > 0) {
      await infoBtn.click();
      await alice.page.waitForTimeout(1500);
      await alice.page.screenshot({ path: path.join(OUT, '09-info-panel.png') });
      const panelText = await alice.page.locator('#conversation-info').innerText().catch(() => '');
      log('PANEL has "Chặn":', /chặn người này/i.test(panelText));
      log('PANEL has "Bỏ chặn":', /bỏ chặn/i.test(panelText));
    } else {
      log('!! no info button (hidden below xl)');
    }

    log('alice console errors:', alice.errors.length);
    alice.errors.slice(0, 8).forEach((e) => log('  ', e));
  } catch (err) {
    log('ERROR', err.message);
    await (alice?.page ?? bob?.page)?.screenshot({ path: path.join(OUT, 'error.png') }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
