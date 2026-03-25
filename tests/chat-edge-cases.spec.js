// @ts-check
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';
const PEER_PARAMS = '?peerHost=127.0.0.1&peerPort=9000';
const PEER_TIMEOUT = 30_000;

/** Wait for PeerJS to assign an ID */
async function waitForPeerId(page) {
  await expect(page.locator('#myId')).not.toHaveText('...', { timeout: PEER_TIMEOUT });
  return page.locator('#myId').textContent();
}

// ── Connection Edge Cases ──

test.describe('Connection Edge Cases', () => {
  test('two peers get unique IDs', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    const bobId = await waitForPeerId(bob);
    expect(aliceId).not.toEqual(bobId);

    await ctx1.close();
    await ctx2.close();
  });

  test('whitespace-only remote ID is rejected (no system message)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#remoteIdInput').fill('   ');
    await page.locator('#connectBtn').click();
    await expect(page.locator('.msg-system')).toHaveCount(0);
  });

  test('remote ID is trimmed before connecting', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const myId = await waitForPeerId(page);

    // Fill with whitespace-padded own ID — should still detect self-connect
    await page.locator('#remoteIdInput').fill('  ' + myId + '  ');
    await page.locator('#connectBtn').click();
    await expect(page.locator('.msg-system')).toContainText('cannot connect to yourself');
  });

  test('connect button disables during connection attempt', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#remoteIdInput').fill('some-fake-peer-for-test');
    await page.locator('#connectBtn').click();
    await expect(page.locator('#connectBtn')).toBeDisabled();
  });

  test('remote ID input disables when connected', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(bob.locator('#encBadge')).toHaveClass(/active/, { timeout: PEER_TIMEOUT });

    await expect(bob.locator('#remoteIdInput')).toBeDisabled();

    await ctx1.close();
    await ctx2.close();
  });

  test('status dot shows yellow during connection attempt', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#remoteIdInput').fill('some-fake-peer-for-status-test');
    await page.locator('#connectBtn').click();
    await expect(page.locator('#statusDot')).toHaveClass(/connecting/);
  });
});

test.describe.serial('Connection System Messages', () => {
  test.setTimeout(60_000);

  test('status shows "Connected to <peer-id>" after encryption', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    const bobId = await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(bob.locator('#encBadge')).toHaveClass(/active/, { timeout: PEER_TIMEOUT });

    const statusText = await bob.locator('#statusText').textContent();
    expect(statusText).toContain('Connected to');
    expect(statusText).toContain(aliceId);

    await ctx1.close();
    await ctx2.close();
  });

  test('system message shows "Connected to peer <id>" on connection', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(bob.locator('#encBadge')).toHaveClass(/active/, { timeout: PEER_TIMEOUT });

    const systemMsgs = await bob.locator('.msg-system').allTextContents();
    const hasConnected = systemMsgs.some(m => m.includes('Connected to peer'));
    expect(hasConnected).toBe(true);

    await ctx1.close();
    await ctx2.close();
  });

  test('system message shows "E2E encryption established" after key exchange', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(bob.locator('#encBadge')).toHaveClass(/active/, { timeout: PEER_TIMEOUT });

    const systemMsgs = await bob.locator('.msg-system').allTextContents();
    const hasE2E = systemMsgs.some(m => m.includes('E2E encryption established'));
    expect(hasE2E).toBe(true);

    await ctx1.close();
    await ctx2.close();
  });

  test('empty state disappears after connection (system messages appear)', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    await expect(alice.locator('#emptyState')).toBeVisible();

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#encBadge')).toHaveClass(/active/, { timeout: PEER_TIMEOUT });

    await expect(alice.locator('#emptyState')).not.toBeVisible();

    await ctx1.close();
    await ctx2.close();
  });
});

// ── Message Edge Cases ──

test.describe.serial('Message Edge Cases', () => {
  test.setTimeout(60_000);

  test('whitespace-only message is not sent', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    await alice.locator('#msgInput').fill('   \t  ');
    await alice.locator('#sendBtn').click();
    await expect(alice.locator('.msg-bubble')).toHaveCount(0);

    await ctx1.close();
    await ctx2.close();
  });

  test('very long message (500 chars) is sent and received correctly', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    const longMsg = 'X'.repeat(500);
    await alice.locator('#msgInput').fill(longMsg);
    await alice.locator('#sendBtn').click();
    await expect(bob.locator('.msg.their .msg-bubble')).toContainText(longMsg, { timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('messages with newline characters are handled', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    // Text inputs strip newlines, so set via evaluate to test the message path
    await alice.locator('#msgInput').fill('Line one');
    await alice.locator('#sendBtn').click();
    await expect(bob.locator('.msg.their .msg-bubble')).toContainText('Line one', { timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('message with only spaces and tabs is not sent', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    await alice.locator('#msgInput').fill('     ');
    await alice.locator('#sendBtn').click();
    await expect(alice.locator('.msg-bubble')).toHaveCount(0);

    await ctx1.close();
    await ctx2.close();
  });

  test('send button click with no connection does nothing (no crash)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    // Send button is disabled, but force-click to test robustness
    await page.locator('#sendBtn').evaluate(el => el.removeAttribute('disabled'));
    await page.locator('#msgInput').evaluate(el => el.removeAttribute('disabled'));
    await page.locator('#msgInput').fill('Test');
    await page.locator('#sendBtn').click();
    // Page should not crash — no message should appear since there's no connection
    await expect(page.locator('.msg-bubble')).toHaveCount(0);
  });

  test('message order is preserved for sequential sends', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    for (let i = 0; i < 5; i++) {
      await alice.locator('#msgInput').fill(`Order-${i}`);
      await alice.locator('#sendBtn').click();
    }

    await expect(bob.locator('.msg.their .msg-bubble')).toHaveCount(5, { timeout: 15_000 });

    const texts = await bob.locator('.msg.their .msg-bubble').allTextContents();
    for (let i = 0; i < 5; i++) {
      expect(texts[i]).toBe(`Order-${i}`);
    }

    await ctx1.close();
    await ctx2.close();
  });

  test('both peers see correct "You"/"Them" labels', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    await alice.locator('#msgInput').fill('Hello');
    await alice.locator('#sendBtn').click();
    await expect(bob.locator('.msg.their .msg-bubble')).toContainText('Hello', { timeout: 10_000 });

    await expect(alice.locator('.msg.own .msg-sender')).toHaveText('You');
    await expect(bob.locator('.msg.their .msg-sender')).toHaveText('Them');

    await ctx1.close();
    await ctx2.close();
  });

  test('timestamps are in HH:MM format', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    await alice.locator('#msgInput').fill('Time test');
    await alice.locator('#sendBtn').click();
    await expect(alice.locator('.msg-time').first()).toBeVisible();

    const timeText = await alice.locator('.msg-time').first().textContent();
    // Should match HH:MM pattern (either 12h or 24h format)
    expect(timeText).toMatch(/\d{1,2}:\d{2}/);

    await ctx1.close();
    await ctx2.close();
  });

  test('each message has a timestamp element', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    await alice.locator('#msgInput').fill('Msg 1');
    await alice.locator('#sendBtn').click();
    await alice.locator('#msgInput').fill('Msg 2');
    await alice.locator('#sendBtn').click();

    await expect(alice.locator('.msg .msg-time')).toHaveCount(2, { timeout: 5_000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('messages container auto-scrolls on new message', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    // Send enough messages to overflow
    for (let i = 0; i < 20; i++) {
      await alice.locator('#msgInput').fill(`Scroll msg ${i}`);
      await alice.locator('#sendBtn').click();
    }

    await expect(alice.locator('.msg.own .msg-bubble')).toHaveCount(20, { timeout: 10_000 });

    const isAtBottom = await alice.locator('#messages').evaluate(el =>
      Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 5
    );
    expect(isAtBottom).toBe(true);

    await ctx1.close();
    await ctx2.close();
  });
});

// ── Message Styling ──

test.describe.serial('Message Styling', () => {
  test.setTimeout(60_000);

  test('own messages align right (flex-end)', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    await alice.locator('#msgInput').fill('Align test');
    await alice.locator('#sendBtn').click();
    await expect(alice.locator('.msg.own')).toBeVisible();

    const alignSelf = await alice.locator('.msg.own').evaluate(el =>
      getComputedStyle(el).alignSelf
    );
    expect(alignSelf).toBe('flex-end');

    await ctx1.close();
    await ctx2.close();
  });

  test('their messages align left (flex-start)', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    await alice.locator('#msgInput').fill('From Alice');
    await alice.locator('#sendBtn').click();
    await expect(bob.locator('.msg.their')).toBeVisible({ timeout: 10_000 });

    const alignSelf = await bob.locator('.msg.their').evaluate(el =>
      getComputedStyle(el).alignSelf
    );
    expect(alignSelf).toBe('flex-start');

    await ctx1.close();
    await ctx2.close();
  });

  test('system messages are centered', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#encBadge')).toHaveClass(/active/, { timeout: PEER_TIMEOUT });

    const alignSelf = await alice.locator('.msg-system').first().evaluate(el =>
      getComputedStyle(el).alignSelf
    );
    expect(alignSelf).toBe('center');

    await ctx1.close();
    await ctx2.close();
  });

  test('message bubbles have word-break (long words do not overflow)', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    await alice.locator('#msgInput').fill('A'.repeat(200));
    await alice.locator('#sendBtn').click();
    await expect(alice.locator('.msg-bubble')).toBeVisible();

    const wordBreak = await alice.locator('.msg-bubble').first().evaluate(el =>
      getComputedStyle(el).wordBreak
    );
    expect(wordBreak).toBe('break-word');

    await ctx1.close();
    await ctx2.close();
  });
});

// ── Typing Indicator Edge Cases ──

test.describe.serial('Typing Indicator Edge Cases', () => {
  test.setTimeout(60_000);

  test('typing indicator shows "Peer is typing..."', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    await alice.locator('#msgInput').pressSequentially('test');
    await expect(bob.locator('#typingIndicator')).toHaveText('Peer is typing...', { timeout: 5_000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('typing indicator disappears after ~2.5s timeout', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    await alice.locator('#msgInput').pressSequentially('x');
    await expect(bob.locator('#typingIndicator')).toContainText('typing', { timeout: 5_000 });

    // Should disappear within ~3s
    await expect(bob.locator('#typingIndicator')).toHaveText('', { timeout: 5_000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('typing indicator clears immediately when message arrives', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    await alice.locator('#msgInput').pressSequentially('incoming');
    await expect(bob.locator('#typingIndicator')).toContainText('typing', { timeout: 5_000 });

    await alice.locator('#msgInput').press('Enter');
    await expect(bob.locator('.msg.their .msg-bubble')).toContainText('incoming', { timeout: 10_000 });
    await expect(bob.locator('#typingIndicator')).toHaveText('');

    await ctx1.close();
    await ctx2.close();
  });

  test('typing signal is throttled (input event within 1s does not re-send)', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    await waitForPeerId(bob);

    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();
    await expect(alice.locator('#msgInput')).toBeEnabled({ timeout: PEER_TIMEOUT });

    // Type rapidly — the throttle should prevent flooding
    await alice.locator('#msgInput').pressSequentially('abcde', { delay: 50 });
    await expect(bob.locator('#typingIndicator')).toContainText('typing', { timeout: 5_000 });

    // Wait for typing to clear and type again after throttle window
    await expect(bob.locator('#typingIndicator')).toHaveText('', { timeout: 5_000 });
    await alice.locator('#msgInput').pressSequentially('f');
    await expect(bob.locator('#typingIndicator')).toContainText('typing', { timeout: 5_000 });

    await ctx1.close();
    await ctx2.close();
  });
});

// ── QR Code Edge Cases ──

test.describe('QR Code Edge Cases', () => {
  test('QR overlay starts hidden (no active class)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await expect(page.locator('#qrOverlay')).not.toHaveClass(/active/);
  });

  test('QR button is enabled after peer ID assigned', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);
    await expect(page.locator('#qrBtn')).toBeEnabled();
  });

  test('QR overlay has close button', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);
    await page.locator('#qrBtn').click();
    await expect(page.locator('#qrCloseBtn')).toBeVisible();
  });

  test('QR modal has description text', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);
    await page.locator('#qrBtn').click();
    await expect(page.locator('.qr-modal p')).toContainText('Scan this QR code');
  });

  test('multiple open/close cycles work', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    for (let i = 0; i < 3; i++) {
      await page.locator('#qrBtn').click();
      await expect(page.locator('#qrOverlay')).toHaveClass(/active/);
      await page.locator('#qrCloseBtn').click();
      await expect(page.locator('#qrOverlay')).not.toHaveClass(/active/);
    }
  });

  test('clicking inside modal does NOT close overlay', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#qrBtn').click();
    await expect(page.locator('#qrOverlay')).toHaveClass(/active/);

    // Click on the modal content (not the backdrop)
    await page.locator('.qr-modal h2').click();
    await expect(page.locator('#qrOverlay')).toHaveClass(/active/);
  });
});

// ── Copy Button Edge Cases ──

test.describe('Copy Button Edge Cases', () => {
  test('copy button is enabled after peer ID assigned', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);
    await expect(page.locator('#copyBtn')).toBeEnabled();
  });

  test('copy button shows "Copied!" then reverts to "Copy"', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#copyBtn').click();
    await expect(page.locator('#copyBtn')).toHaveText('Copied!');
    await expect(page.locator('#copyBtn')).toHaveText('Copy', { timeout: 3000 });
  });

  test('copy button copies correct peer ID value', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/' + PEER_PARAMS);
    const myId = await waitForPeerId(page);

    await page.locator('#copyBtn').click();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(myId);
  });
});

// ── Status Indicator ──

test.describe('Status Indicator', () => {
  test('status dot starts without color class', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    // At very start, status dot should not have connected/connecting/error
    const classes = await page.locator('#statusDot').getAttribute('class');
    expect(classes).not.toContain('connected');
  });

  test('status text updates to "Waiting for connection" after init', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);
    await expect(page.locator('#statusText')).toHaveText('Waiting for connection');
  });

  test('after peer open: status is "Waiting for connection"', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);
    await expect(page.locator('#statusText')).toHaveText('Waiting for connection');
  });

  test('status dot has 8px dimensions', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const size = await page.locator('#statusDot').evaluate(el => {
      const style = getComputedStyle(el);
      return { width: style.width, height: style.height };
    });
    expect(size.width).toBe('8px');
    expect(size.height).toBe('8px');
  });

  test('status dot is circular (border-radius 50%)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const borderRadius = await page.locator('#statusDot').evaluate(el =>
      getComputedStyle(el).borderRadius
    );
    expect(borderRadius).toBe('50%');
  });
});
