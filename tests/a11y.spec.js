// @ts-check
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PEER_PARAMS = '?peerHost=127.0.0.1&peerPort=9000';

test.describe('Accessibility', () => {
  test('page passes axe automated audit', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    // Don't wait for PeerJS — test the static HTML structure
    await page.waitForLoadState('domcontentloaded');

    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast']) // dark theme contrast is intentional
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('html has lang attribute', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('page has exactly one h1', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('all inputs have placeholders', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const inputs = page.locator('input[type="text"]');
    for (const input of await inputs.all()) {
      const placeholder = await input.getAttribute('placeholder');
      expect(placeholder).toBeTruthy();
    }
  });

  test('buttons have accessible text', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const buttons = page.locator('button');
    for (const btn of await buttons.all()) {
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      const title = await btn.getAttribute('title');
      expect(text?.trim() || ariaLabel || title).toBeTruthy();
    }
  });

  test('copy and QR buttons have title attributes', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await expect(page.locator('#copyBtn')).toHaveAttribute('title');
    await expect(page.locator('#qrBtn')).toHaveAttribute('title');
  });

  test('enabled interactive elements are keyboard focusable', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await expect(page.locator('#myId')).not.toHaveText('...', { timeout: 30_000 });
    // Only test elements that are enabled (disabled inputs/buttons can't receive focus)
    const selectors = ['#copyBtn', '#qrBtn', '#connectBtn', '#remoteIdInput'];
    for (const sel of selectors) {
      const el = page.locator(sel);
      await el.focus();
      await expect(el).toBeFocused();
    }
  });

  test('QR modal has heading and is keyboard dismissible', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await expect(page.locator('#myId')).not.toHaveText('...', { timeout: 30_000 });

    await page.locator('#qrBtn').click();
    await expect(page.locator('.qr-modal h2')).toHaveText('Scan to Connect');

    await page.locator('#qrCloseBtn').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#qrOverlay')).not.toHaveClass(/active/);
  });
});
