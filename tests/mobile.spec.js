// @ts-check
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';
const PEER_PARAMS = '?peerHost=127.0.0.1&peerPort=9000';

test.describe('Mobile Layout', () => {
  test('header is visible', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const header = page.locator('.header');
    await expect(header).toBeVisible();
    await expect(page.locator('.header h1')).toHaveText('P2P Chat');
  });

  test('connect bar stacks vertically', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const connectBar = page.locator('#connectBar');
    const style = await connectBar.evaluate(el => getComputedStyle(el).flexDirection);
    expect(style).toBe('column');
  });

  test('id-display takes full width', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const idDisplay = page.locator('.id-display');
    const parentWidth = await page.locator('#connectBar').evaluate(el => el.clientWidth);
    const idWidth = await idDisplay.evaluate(el => el.clientWidth);
    // Should be nearly the full width (minus padding)
    expect(idWidth).toBeGreaterThan(parentWidth * 0.8);
  });

  test('buttons have minimum 44px touch target', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const buttons = page.locator('#connectBtn, #sendBtn');
    for (const btn of await buttons.all()) {
      const height = await btn.evaluate(el => el.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(44);
    }
  });

  test('inputs have 16px font size to prevent iOS zoom', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const inputs = page.locator('input[type="text"]');
    for (const input of await inputs.all()) {
      const fontSize = await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(16);
    }
  });

  test('messages use wider max-width on mobile', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    // The CSS sets max-width: 88% on mobile
    const maxWidth = await page.evaluate(() => {
      const rule = Array.from(document.styleSheets)
        .flatMap(s => { try { return Array.from(s.cssRules); } catch { return []; } })
        .find(r => r.cssText && r.cssText.includes('max-width: 88%'));
      return !!rule;
    });
    expect(maxWidth).toBe(true);
  });

  test('encryption badge hides text on mobile', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    // The CSS rule hides the span inside encryption-badge on mobile
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

  test('chat input has safe area padding', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const chatInput = page.locator('.chat-input');
    const paddingBottom = await chatInput.evaluate(el => getComputedStyle(el).paddingBottom);
    // On devices without a notch, env() falls back to 0px so it should just be 10px
    expect(parseFloat(paddingBottom)).toBeGreaterThanOrEqual(10);
  });
});

test.describe('Mobile Connect Bar', () => {
  test.setTimeout(60_000);

  test('connect bar hides when connected', async ({ browser }) => {
    // Alice on mobile viewport
    const ctx1 = await browser.newContext({
      viewport: { width: 393, height: 851 },
      userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.0.0 Mobile Safari/537.36',
    });
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await expect(alice.locator('#myId')).not.toHaveText('...', { timeout: 30_000 });
    await expect(bob.locator('#myId')).not.toHaveText('...', { timeout: 30_000 });

    const aliceId = await alice.locator('#myId').textContent();
    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();

    await expect(alice.locator('#encBadge')).toHaveClass(/active/, { timeout: 30_000 });

    // Connect bar should be hidden on mobile
    await expect(alice.locator('#connectBar')).toHaveClass(/hidden-connected/);
    await expect(alice.locator('#connectBar')).not.toBeVisible();

    await ctx1.close();
    await ctx2.close();
  });
});
