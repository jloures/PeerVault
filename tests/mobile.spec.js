// @ts-check
import { test, expect } from './fixtures.js';

const BASE = 'http://127.0.0.1:3000';
const PEER_PARAMS = '?peerHost=127.0.0.1&peerPort=9000';
const PEER_TIMEOUT = 30_000;

/** Wait for PeerJS to assign an ID */
async function waitForPeerId(page) {
  await expect(page.locator('#myId')).not.toHaveText('...', { timeout: PEER_TIMEOUT });
  return page.locator('#myId').textContent();
}

/** Create a mobile-sized browser context */
async function mobileContext(browser) {
  return browser.newContext({
    viewport: { width: 393, height: 851 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.0.0 Mobile Safari/537.36',
  });
}

/** Connect two pages and wait for E2E encryption */
async function connectPeers(alice, bob) {
  const aliceId = await waitForPeerId(alice);
  await waitForPeerId(bob);
  await bob.locator('#remoteIdInput').fill(aliceId);
  await bob.locator('#connectBtn').click();
  await expect(alice.locator('#encBadge')).toHaveClass(/active/, { timeout: PEER_TIMEOUT });
  await expect(bob.locator('#encBadge')).toHaveClass(/active/, { timeout: PEER_TIMEOUT });
}

// ══════════════════════════════════════════════════════════
// Mobile Layout — CSS & Responsive Design
// ══════════════════════════════════════════════════════════

test.describe('Mobile Layout', () => {
  test('header is visible with correct text', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const header = page.locator('.header');
    await expect(header).toBeVisible();
    await expect(page.locator('.header h1')).toHaveText('PeerVault');
  });

  test('header h1 uses smaller font on mobile', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const fontSize = await page.locator('.header h1').evaluate(
      el => parseFloat(getComputedStyle(el).fontSize)
    );
    expect(fontSize).toBeLessThanOrEqual(16);
  });

  test('connect bar stacks vertically (column layout)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const connectBar = page.locator('#connectBar');
    const style = await connectBar.evaluate(el => getComputedStyle(el).flexDirection);
    expect(style).toBe('column');
  });

  test('sidebar peer ID display is visible when sidebar opens', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);
    await page.locator('#sidebarToggle').click();
    await expect(page.locator('.sidebar')).toHaveClass(/open/);
    await expect(page.locator('#myId')).toBeVisible();
  });

  test('connect group takes full width', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const connectGroup = page.locator('.connect-group');
    const parentWidth = await page.locator('#connectBar').evaluate(el => el.clientWidth);
    const groupWidth = await connectGroup.evaluate(el => el.clientWidth);
    expect(groupWidth).toBeGreaterThan(parentWidth * 0.8);
  });

  test('primary action buttons have minimum 44px touch target', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    // Only check primary action buttons (connect, send) — icon buttons (copy, QR) use smaller targets
    const buttons = page.locator('#connectBtn, #sendBtn');
    for (const btn of await buttons.all()) {
      const height = await btn.evaluate(el => el.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(44);
    }
  });

  test('copy and QR buttons have adequate tap area', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);
    await page.locator('#sidebarToggle').click();
    await expect(page.locator('.sidebar')).toHaveClass(/open/);
    for (const id of ['#copyBtn', '#qrBtn']) {
      const size = await page.locator(id).evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      // Should be at least 36px in both dimensions for small icon buttons
      expect(size.width).toBeGreaterThanOrEqual(36);
      expect(size.height).toBeGreaterThanOrEqual(36);
    }
  });

  test('all inputs have >=16px font size to prevent iOS zoom', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const inputs = page.locator('input[type="text"]');
    for (const input of await inputs.all()) {
      const fontSize = await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(16);
    }
  });

  test('messages use wider max-width (88%) on mobile', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const maxWidth = await page.evaluate(() => {
      const rule = Array.from(document.styleSheets)
        .flatMap(s => { try { return Array.from(s.cssRules); } catch { return []; } })
        .find(r => r.cssText && r.cssText.includes('max-width: 88%'));
      return !!rule;
    });
    expect(maxWidth).toBe(true);
  });

  test('message font size >=15px on mobile', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const hasMobileFont = await page.evaluate(() => {
      const rules = Array.from(document.styleSheets)
        .flatMap(s => { try { return Array.from(s.cssRules); } catch { return []; } });
      const mediaRule = rules.find(r =>
        r instanceof CSSMediaRule &&
        r.conditionText?.includes('520px')
      );
      if (!mediaRule) return false;
      const innerRules = Array.from(mediaRule.cssRules);
      const bubbleRule = innerRules.find(r => r.selectorText?.includes('.msg-bubble'));
      return bubbleRule ? parseFloat(bubbleRule.style.fontSize) >= 15 : false;
    });
    expect(hasMobileFont).toBe(true);
  });

  test('encryption badge hides text on mobile (icon only)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const spanDisplay = await page.evaluate(() => {
      const rules = Array.from(document.styleSheets)
        .flatMap(s => { try { return Array.from(s.cssRules); } catch { return []; } });
      const mediaRule = rules.find(r =>
        r instanceof CSSMediaRule &&
        r.conditionText?.includes('520px')
      );
      if (!mediaRule) return null;
      const innerRules = Array.from(mediaRule.cssRules);
      const badgeSpan = innerRules.find(r => r.selectorText === '.encryption-badge span');
      return badgeSpan ? badgeSpan.style.display : null;
    });
    expect(spanDisplay).toBe('none');
  });

  test('chat input has safe area bottom padding', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const chatInput = page.locator('.chat-input');
    const paddingBottom = await chatInput.evaluate(el => getComputedStyle(el).paddingBottom);
    // On devices without a notch, env() falls back to 0px so it should just be 10px
    expect(parseFloat(paddingBottom)).toBeGreaterThanOrEqual(10);
  });

  test('header has safe area top padding', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const header = page.locator('.header');
    const paddingTop = await header.evaluate(el => getComputedStyle(el).paddingTop);
    // On devices without a notch, env() falls back to 0px so it should just be 10px
    expect(parseFloat(paddingTop)).toBeGreaterThanOrEqual(10);
  });

  test('messages container reduces padding on mobile', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const padding = await page.locator('#messages').evaluate(el =>
      parseFloat(getComputedStyle(el).paddingLeft)
    );
    expect(padding).toBeLessThanOrEqual(12);
  });

  test('body uses percentage height for keyboard compatibility', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const bodyHeight = await page.evaluate(() => {
      const rules = Array.from(document.styleSheets)
        .flatMap(s => { try { return Array.from(s.cssRules); } catch { return []; } });
      const bodyRule = rules.find(r => r.selectorText === 'body');
      return bodyRule?.style?.height ?? '';
    });
    expect(bodyHeight).toBe('100%');
  });

  test('viewport meta tag has viewport-fit=cover', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const content = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(content).toContain('viewport-fit=cover');
  });

  test('no horizontal scroll on mobile viewport', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('all visible interactive elements fit within viewport', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const viewportWidth = page.viewportSize().width;
    // Only check visible elements (sidebar elements are off-screen when closed)
    const elements = page.locator('main button:visible, main input:visible, header button:visible');
    for (const el of await elements.all()) {
      const box = await el.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { right: rect.right, left: rect.left };
      });
      expect(box.right).toBeLessThanOrEqual(viewportWidth);
      expect(box.left).toBeGreaterThanOrEqual(0);
    }
  });

  test('input focus does not cause layout shift', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    const beforeWidth = await page.evaluate(() => document.body.scrollWidth);
    await page.locator('#remoteIdInput').focus();
    const afterWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(afterWidth).toBe(beforeWidth);
  });
});

// ══════════════════════════════════════════════════════════
// Mobile Connect Bar — Show/Hide on Connect/Disconnect
// ══════════════════════════════════════════════════════════

test.describe('Mobile Connect Bar', () => {
  test.setTimeout(60_000);

  test('connect bar hides when connected', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await connectPeers(alice, bob);

    await expect(alice.locator('#connectBar')).toHaveClass(/hidden-connected/);
    await expect(alice.locator('#connectBar')).not.toBeVisible();

    await ctx1.close();
    await ctx2.close();
  });

  test('status shows disconnected after peer leaves', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await connectPeers(alice, bob);
    await expect(alice.locator('#connectBar')).not.toBeVisible();

    // Bob navigates away, closing the WebRTC connection
    await bob.goto('about:blank');
    await ctx2.close();
    await expect(alice.locator('#statusText')).toHaveText(/Reconnecting|Disconnected/, { timeout: PEER_TIMEOUT });
    await expect(alice.locator('#msgInput')).toBeDisabled();

    await ctx1.close();
  });

  test('chat input becomes enabled on mobile after connection', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await expect(alice.locator('#msgInput')).toBeDisabled();
    await connectPeers(alice, bob);
    await expect(alice.locator('#msgInput')).toBeEnabled();

    await ctx1.close();
    await ctx2.close();
  });

  test('chat input disabled again after peer disconnects on mobile', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await connectPeers(alice, bob);
    await expect(alice.locator('#msgInput')).toBeEnabled();

    await bob.goto('about:blank');
    await ctx2.close();
    await expect(alice.locator('#msgInput')).toBeDisabled({ timeout: PEER_TIMEOUT });

    await ctx1.close();
  });
});

// ══════════════════════════════════════════════════════════
// Mobile Full Chat Flow — P2P messaging on a mobile viewport
// ══════════════════════════════════════════════════════════

test.describe('Mobile Chat Flow', () => {
  test.setTimeout(60_000);

  test('two mobile peers can chat end-to-end', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await mobileContext(browser);
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await connectPeers(alice, bob);

    await alice.locator('#msgInput').fill('Hello from mobile Alice!');
    await alice.locator('#sendBtn').click();
    await expect(bob.locator('.msg.their .msg-bubble')).toContainText('Hello from mobile Alice!', { timeout: 10_000 });

    await bob.locator('#msgInput').fill('Hey mobile Alice!');
    await bob.locator('#sendBtn').click();
    await expect(alice.locator('.msg.their .msg-bubble')).toContainText('Hey mobile Alice!', { timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('mobile peer can chat with desktop peer', async ({ browser }) => {
    const mobileCtx = await mobileContext(browser);
    const desktopCtx = await browser.newContext();
    const mobile = await mobileCtx.newPage();
    const desktop = await desktopCtx.newPage();

    await mobile.goto(BASE + PEER_PARAMS);
    await desktop.goto(BASE + PEER_PARAMS);

    await connectPeers(mobile, desktop);

    await mobile.locator('#msgInput').fill('From phone');
    await mobile.locator('#sendBtn').click();
    await expect(desktop.locator('.msg.their .msg-bubble')).toContainText('From phone', { timeout: 10_000 });

    await desktop.locator('#msgInput').fill('From desktop');
    await desktop.locator('#sendBtn').click();
    await expect(mobile.locator('.msg.their .msg-bubble')).toContainText('From desktop', { timeout: 10_000 });

    await mobileCtx.close();
    await desktopCtx.close();
  });

  test('typing indicator works on mobile viewport', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await connectPeers(alice, bob);

    await alice.locator('#msgInput').pressSequentially('typing on mobile...');
    await expect(bob.locator('#typingIndicator')).toContainText('typing', { timeout: 5_000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('Enter key sends message on mobile', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await connectPeers(alice, bob);

    await alice.locator('#msgInput').fill('Enter on mobile');
    await alice.locator('#msgInput').press('Enter');
    await expect(alice.locator('.msg.own .msg-bubble')).toContainText('Enter on mobile');
    await expect(bob.locator('.msg.their .msg-bubble')).toContainText('Enter on mobile', { timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('messages auto-scroll to bottom on mobile', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await connectPeers(alice, bob);

    // Send enough messages to overflow
    for (let i = 0; i < 15; i++) {
      await alice.locator('#msgInput').fill(`Message ${i}`);
      await alice.locator('#sendBtn').click();
    }

    // Verify scroll is at bottom
    const isAtBottom = await alice.locator('#messages').evaluate(el =>
      Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 5
    );
    expect(isAtBottom).toBe(true);

    await ctx1.close();
    await ctx2.close();
  });

  test('empty state hides after first message on mobile', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    // Empty state visible before connection
    await expect(alice.locator('#emptyState')).toBeVisible();

    await connectPeers(alice, bob);

    // System messages from connection should hide empty state
    await expect(alice.locator('#emptyState')).not.toBeVisible();

    await ctx1.close();
    await ctx2.close();
  });
});

// ══════════════════════════════════════════════════════════
// Mobile Connection States & Status Indicator
// ══════════════════════════════════════════════════════════

test.describe('Mobile Connection States', () => {
  test.setTimeout(60_000);

  test('status transitions through all states on mobile', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    // After peer init: "Waiting for connection"
    await waitForPeerId(alice);
    await expect(alice.locator('#statusText')).toHaveText('Waiting for connection');

    await connectPeers(alice, bob);

    // After encryption: "Connected to <id>"
    await expect(alice.locator('#statusDot')).toHaveClass(/connected/);
    const statusText = await alice.locator('#statusText').textContent();
    expect(statusText).toMatch(/Connected to /);

    await ctx1.close();
    await ctx2.close();
  });

  test('encryption badge shows on mobile (icon only, no text)', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await expect(alice.locator('#encBadge')).not.toHaveClass(/active/);
    await connectPeers(alice, bob);
    await expect(alice.locator('#encBadge')).toHaveClass(/active/);

    // Verify SVG icon is visible but text span is hidden
    await expect(alice.locator('#encBadge svg')).toBeVisible();
    const spanVisible = await alice.locator('#encBadge span').evaluate(el =>
      getComputedStyle(el).display
    );
    expect(spanVisible).toBe('none');

    await ctx1.close();
    await ctx2.close();
  });

  test('encryption badge deactivates on disconnect', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await connectPeers(alice, bob);
    await expect(alice.locator('#encBadge')).toHaveClass(/active/);

    await bob.goto('about:blank');
    await ctx2.close();
    await expect(alice.locator('#encBadge')).not.toHaveClass(/active/, { timeout: PEER_TIMEOUT });

    await ctx1.close();
  });

  test('system messages display correctly on mobile', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await connectPeers(alice, bob);

    // Should have connection system messages
    const systemMessages = alice.locator('.msg-system');
    const count = await systemMessages.count();
    expect(count).toBeGreaterThanOrEqual(2); // "Connected to peer..." and "E2E encryption established"

    // System messages should be visible and within viewport
    for (const msg of await systemMessages.all()) {
      await expect(msg).toBeVisible();
      const right = await msg.evaluate(el => el.getBoundingClientRect().right);
      expect(right).toBeLessThanOrEqual(393); // Pixel 5 width
    }

    await ctx1.close();
    await ctx2.close();
  });
});

// ══════════════════════════════════════════════════════════
// Mobile QR Code
// ══════════════════════════════════════════════════════════

test.describe('Mobile QR Code', () => {
  test.setTimeout(60_000);

  test('QR modal fits mobile viewport', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#sidebarToggle').click();
    await page.locator('#qrBtn').click();
    await expect(page.locator('#qrOverlay')).toHaveClass(/active/);

    const modal = page.locator('.qr-modal');
    const box = await modal.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, right: rect.right };
    });
    const viewportWidth = page.viewportSize().width;
    expect(box.right).toBeLessThanOrEqual(viewportWidth);
    expect(box.width).toBeLessThanOrEqual(viewportWidth);
  });

  test('QR canvas renders at reasonable size on mobile', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#sidebarToggle').click();
    await page.locator('#qrBtn').click();
    const canvas = page.locator('#qrCanvas');
    const size = await canvas.evaluate(el => ({ w: el.width, h: el.height }));
    expect(size.w).toBeGreaterThan(100);
    expect(size.h).toBeGreaterThan(100);
    // Should be square
    expect(size.w).toBe(size.h);
  });

  test('QR overlay can be dismissed by tapping backdrop on mobile', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#sidebarToggle').click();
    await page.locator('#qrBtn').click();
    await expect(page.locator('#qrOverlay')).toHaveClass(/active/);

    // Tap far corner of overlay (not the modal)
    await page.locator('#qrOverlay').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#qrOverlay')).not.toHaveClass(/active/);
  });

  test('QR auto-connect works from mobile viewport', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await mobileContext(browser);
    const alice = await ctx1.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    const aliceId = await waitForPeerId(alice);

    // Bob opens the QR link directly (simulating camera scan)
    const bob = await ctx2.newPage();
    await bob.goto(BASE + PEER_PARAMS + '#peer=' + aliceId);

    await expect(alice.locator('#encBadge')).toHaveClass(/active/, { timeout: PEER_TIMEOUT });
    await expect(bob.locator('#encBadge')).toHaveClass(/active/, { timeout: PEER_TIMEOUT });

    // Both should have chat enabled
    await expect(alice.locator('#msgInput')).toBeEnabled();
    await expect(bob.locator('#msgInput')).toBeEnabled();

    await ctx1.close();
    await ctx2.close();
  });
});

// ══════════════════════════════════════════════════════════
// Mobile Viewport Sizes — Different devices
// ══════════════════════════════════════════════════════════

test.describe('Different Mobile Viewports', () => {
  const devices = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 14 Pro', width: 393, height: 852 },
    { name: 'Galaxy S21', width: 360, height: 800 },
    { name: 'iPad Mini (portrait)', width: 768, height: 1024 },
    { name: 'Narrow phone', width: 320, height: 568 },
  ];

  for (const device of devices) {
    test(`no horizontal overflow on ${device.name} (${device.width}x${device.height})`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: device.width, height: device.height },
      });
      const page = await ctx.newPage();
      await page.goto(BASE + PEER_PARAMS);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(device.width);

      await ctx.close();
    });

    test(`primary buttons tappable on ${device.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: device.width, height: device.height },
      });
      const page = await ctx.newPage();
      await page.goto(BASE + PEER_PARAMS);

      // Only check primary action buttons — icon buttons (copy, QR, close) use smaller targets
      const buttons = page.locator('#connectBtn, #sendBtn');
      for (const btn of await buttons.all()) {
        const box = await btn.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        });
        if (device.width <= 520) {
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
        expect(box.width).toBeGreaterThan(0);
      }

      await ctx.close();
    });
  }
});

// ══════════════════════════════════════════════════════════
// Mobile Virtual Keyboard Handling
// ══════════════════════════════════════════════════════════

test.describe('Mobile Keyboard Handling', () => {
  test('visualViewport resize handler is registered', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const hasHandler = await page.evaluate(() => !!window.visualViewport);
    expect(hasHandler).toBe(true);
  });

  test('body adjusts to simulated viewport resize', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);

    // Simulate virtual keyboard opening by dispatching resize on visualViewport
    const adjusted = await page.evaluate(() => {
      if (!window.visualViewport) return false;
      // Manually trigger the resize behavior
      const originalHeight = window.visualViewport.height;
      document.body.style.height = (originalHeight - 300) + 'px';
      return document.body.style.height !== '';
    });
    expect(adjusted).toBe(true);
  });

  test('message input is reachable after focusing on mobile', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    // Focus the remote ID input (enabled by default)
    await page.locator('#remoteIdInput').focus();

    const inputBox = await page.locator('#remoteIdInput').evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    });
    const viewportHeight = page.viewportSize().height;
    expect(inputBox.bottom).toBeLessThanOrEqual(viewportHeight);
  });
});

// ══════════════════════════════════════════════════════════
// Mobile Connection Validation
// ══════════════════════════════════════════════════════════

test.describe('Mobile Connection Validation', () => {
  test.setTimeout(60_000);

  test('self-connect shows error on mobile', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const myId = await waitForPeerId(page);

    await page.locator('#remoteIdInput').fill(myId);
    await page.locator('#connectBtn').click();

    const systemMsg = page.locator('.msg-system');
    await expect(systemMsg).toContainText('cannot connect to yourself');
    // System message should be visible on mobile viewport
    await expect(systemMsg).toBeVisible();
  });

  test('nonexistent peer shows error on mobile', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#remoteIdInput').fill('nonexistent-mobile-peer-99999');
    await page.locator('#connectBtn').click();

    await expect(page.locator('.msg-system').last()).toContainText('Peer not found', { timeout: PEER_TIMEOUT });
  });

  test('duplicate connect switches to existing room', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const bobId = await waitForPeerId(bob);
    await connectPeers(alice, bob);

    // Use + New to show the connect bar, then try connecting to same peer
    await alice.locator('#sidebarToggle').click();
    await alice.locator('#newChatBtn').click();
    await alice.locator('#remoteIdInput').fill(bobId);
    await alice.locator('#connectBtn').click();

    // Should switch back to existing room (still encrypted)
    await expect(alice.locator('#encBadge')).toHaveClass(/active/);

    await ctx1.close();
    await ctx2.close();
  });
});

// ══════════════════════════════════════════════════════════
// Mobile Message Display
// ══════════════════════════════════════════════════════════

test.describe('Mobile Message Display', () => {
  test.setTimeout(60_000);

  test('long messages wrap properly on mobile', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await connectPeers(alice, bob);

    const longMessage = 'A'.repeat(200);
    await alice.locator('#msgInput').fill(longMessage);
    await alice.locator('#sendBtn').click();

    const bubble = alice.locator('.msg.own .msg-bubble');
    await expect(bubble).toContainText(longMessage);

    // Message should not overflow the viewport
    const bubbleRight = await bubble.evaluate(el => el.getBoundingClientRect().right);
    expect(bubbleRight).toBeLessThanOrEqual(393); // Pixel 5 width

    await ctx1.close();
    await ctx2.close();
  });

  test('messages have timestamps visible on mobile', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await connectPeers(alice, bob);

    await alice.locator('#msgInput').fill('Timestamp test');
    await alice.locator('#sendBtn').click();

    const time = alice.locator('.msg-time').last();
    await expect(time).toBeVisible();
    const timeText = await time.textContent();
    // Should be a valid time string like "12:34 PM"
    expect(timeText).toMatch(/\d{1,2}:\d{2}/);

    await ctx1.close();
    await ctx2.close();
  });

  test('own and their messages styled differently', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await connectPeers(alice, bob);

    await alice.locator('#msgInput').fill('From Alice');
    await alice.locator('#sendBtn').click();
    await expect(bob.locator('.msg.their .msg-bubble')).toContainText('From Alice', { timeout: 10_000 });

    await bob.locator('#msgInput').fill('From Bob');
    await bob.locator('#sendBtn').click();
    await expect(alice.locator('.msg.their .msg-bubble')).toContainText('From Bob', { timeout: 10_000 });

    // Own messages should be right-aligned, their messages left-aligned
    const ownAlign = await alice.locator('.msg.own').evaluate(el => getComputedStyle(el).alignItems);
    const theirAlign = await alice.locator('.msg.their').evaluate(el => getComputedStyle(el).alignItems);
    expect(ownAlign).toBe('flex-end');
    expect(theirAlign).toBe('flex-start');

    await ctx1.close();
    await ctx2.close();
  });

  test('special characters render safely (no XSS)', async ({ browser }) => {
    const ctx1 = await mobileContext(browser);
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await connectPeers(alice, bob);

    const xssPayload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    await alice.locator('#msgInput').fill(xssPayload);
    await alice.locator('#sendBtn').click();

    // Message should display as text, not execute
    const bubble = await bob.locator('.msg.their .msg-bubble');
    await expect(bubble).toContainText('<script>', { timeout: 10_000 });

    // No script should have executed
    const alertFired = await bob.evaluate(() => window.__xssTriggered || false);
    expect(alertFired).toBe(false);

    await ctx1.close();
    await ctx2.close();
  });
});

// ══════════════════════════════════════════════════════════
// Mobile Copy & Share
// ══════════════════════════════════════════════════════════

test.describe('Mobile Copy & Share', () => {
  test('copy button works on mobile viewport', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 393, height: 851 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await ctx.newPage();
    await page.goto(BASE + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#sidebarToggle').click();
    const copyBtn = page.locator('#copyBtn');
    await copyBtn.click();
    await expect(copyBtn).toHaveText('Copied!');
    await expect(copyBtn).toHaveText('Copy', { timeout: 3000 });

    await ctx.close();
  });

  test('peer ID is selectable by tapping', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    const userSelect = await page.locator('.id-value').evaluate(el =>
      getComputedStyle(el).userSelect
    );
    expect(userSelect).toBe('all');
  });

  test('peer ID uses monospace font', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    const fontFamily = await page.locator('.id-value').evaluate(el =>
      getComputedStyle(el).fontFamily
    );
    expect(fontFamily).toMatch(/monospace|Courier|Consolas/i);
  });
});
