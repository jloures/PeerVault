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

// ── Page Load (no PeerJS needed) ──

test.describe('Page Load', () => {
  test('has correct title', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await expect(page).toHaveTitle('P2P Chat');
  });

  test('shows heading', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await expect(page.locator('.header h1')).toHaveText('P2P Chat');
  });

  test('shows status indicator', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await expect(page.locator('#statusText')).toBeVisible();
  });

  test('message input and send button are disabled initially', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await expect(page.locator('#msgInput')).toBeDisabled();
    await expect(page.locator('#sendBtn')).toBeDisabled();
  });

  test('shows empty state instructions', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await expect(page.locator('#emptyState')).toBeVisible();
    await expect(page.locator('#emptyState')).toContainText('Copy your ID');
  });

  test('encryption badge is hidden initially', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await expect(page.locator('#encBadge')).not.toHaveClass(/active/);
  });
});

// ── PeerJS Init (needs signaling server) ──

test.describe('PeerJS Initialization', () => {
  test('assigns a peer ID', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const id = await waitForPeerId(page);
    expect(id.length).toBeGreaterThan(5);
  });

  test('enables buttons after peer ID is assigned', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);
    await expect(page.locator('#copyBtn')).toBeEnabled();
    await expect(page.locator('#qrBtn')).toBeEnabled();
    await expect(page.locator('#connectBtn')).toBeEnabled();
  });

  test('status shows waiting for connection', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);
    await expect(page.locator('#statusText')).toHaveText('Waiting for connection');
  });
});

// ── Copy Button ──

test.describe('Copy Button', () => {
  test('copies peer ID and shows feedback', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    const copyBtn = page.locator('#copyBtn');
    await copyBtn.click();
    await expect(copyBtn).toHaveText('Copied!');
    await expect(copyBtn).toHaveText('Copy', { timeout: 3000 });
  });
});

// ── QR Code ──

test.describe('QR Code', () => {
  test('QR button opens overlay with canvas', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#qrBtn').click();
    await expect(page.locator('#qrOverlay')).toHaveClass(/active/);
    await expect(page.locator('.qr-modal h2')).toHaveText('Scan to Connect');

    const width = await page.locator('#qrCanvas').evaluate(el => el.width);
    expect(width).toBeGreaterThan(0);
  });

  test('close button dismisses QR overlay', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#qrBtn').click();
    await expect(page.locator('#qrOverlay')).toHaveClass(/active/);
    await page.locator('#qrCloseBtn').click();
    await expect(page.locator('#qrOverlay')).not.toHaveClass(/active/);
  });

  test('clicking overlay backdrop closes it', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#qrBtn').click();
    await page.locator('#qrOverlay').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#qrOverlay')).not.toHaveClass(/active/);
  });
});

// ── Connection Validation ──

test.describe('Connection Validation', () => {
  test('cannot connect to yourself', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const myId = await waitForPeerId(page);

    await page.locator('#remoteIdInput').fill(myId);
    await page.locator('#connectBtn').click();
    await expect(page.locator('.msg-system')).toContainText('cannot connect to yourself');
  });

  test('connect button does nothing with empty input', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#connectBtn').click();
    await expect(page.locator('.msg-system')).toHaveCount(0);
  });

  test('Enter key triggers connect', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const myId = await waitForPeerId(page);

    await page.locator('#remoteIdInput').fill(myId);
    await page.locator('#remoteIdInput').press('Enter');
    await expect(page.locator('.msg-system')).toContainText('cannot connect to yourself');
  });

  test('connecting to nonexistent peer shows error', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    await page.locator('#remoteIdInput').fill('nonexistent-peer-id-12345');
    await page.locator('#connectBtn').click();
    await expect(page.locator('.msg-system').last()).toContainText('Peer not found', { timeout: PEER_TIMEOUT });
  });
});

// ── Two-Peer Chat (serial to avoid PeerJS rate limits) ──

test.describe.serial('Two-Peer Chat', () => {
  test.setTimeout(60_000);

  test('two peers can connect, exchange keys, and chat', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();
    const bob = await ctx2.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    await bob.goto(BASE + PEER_PARAMS);

    const aliceId = await waitForPeerId(alice);
    const bobId = await waitForPeerId(bob);
    expect(aliceId).not.toEqual(bobId);

    // Bob connects to Alice
    await bob.locator('#remoteIdInput').fill(aliceId);
    await bob.locator('#connectBtn').click();

    // Both establish E2E encryption
    await expect(alice.locator('#encBadge')).toHaveClass(/active/, { timeout: PEER_TIMEOUT });
    await expect(bob.locator('#encBadge')).toHaveClass(/active/, { timeout: PEER_TIMEOUT });
    await expect(alice.locator('#statusDot')).toHaveClass(/connected/);
    await expect(bob.locator('#statusDot')).toHaveClass(/connected/);
    await expect(alice.locator('#msgInput')).toBeEnabled();
    await expect(bob.locator('#msgInput')).toBeEnabled();

    // Alice sends a message
    await alice.locator('#msgInput').fill('Hello from Alice!');
    await alice.locator('#sendBtn').click();
    await expect(alice.locator('.msg.own .msg-bubble')).toContainText('Hello from Alice!');
    await expect(bob.locator('.msg.their .msg-bubble')).toContainText('Hello from Alice!', { timeout: 10_000 });

    // Bob replies
    await bob.locator('#msgInput').fill('Hey Alice!');
    await bob.locator('#sendBtn').click();
    await expect(bob.locator('.msg.own .msg-bubble')).toContainText('Hey Alice!');
    await expect(alice.locator('.msg.their .msg-bubble')).toContainText('Hey Alice!', { timeout: 10_000 });

    // Verify labels and timestamps
    await expect(alice.locator('.msg.own .msg-sender')).toHaveText('You');
    await expect(alice.locator('.msg.their .msg-sender')).toHaveText('Them');
    await expect(alice.locator('.msg-time').first()).toBeVisible();

    await ctx1.close();
    await ctx2.close();
  });

  test('Enter key sends message', async ({ browser }) => {
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

    await alice.locator('#msgInput').fill('Enter test');
    await alice.locator('#msgInput').press('Enter');
    await expect(alice.locator('.msg.own .msg-bubble')).toContainText('Enter test');
    await expect(bob.locator('.msg.their .msg-bubble')).toContainText('Enter test', { timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('empty message is not sent', async ({ browser }) => {
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

    await alice.locator('#msgInput').fill('   ');
    await alice.locator('#sendBtn').click();
    await expect(alice.locator('.msg-bubble')).toHaveCount(0);

    await ctx1.close();
    await ctx2.close();
  });

  test('typing indicator shows for remote peer', async ({ browser }) => {
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

    await alice.locator('#msgInput').pressSequentially('typing...');
    await expect(bob.locator('#typingIndicator')).toContainText('typing', { timeout: 5_000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('auto-connects when URL has #peer= parameter', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const alice = await ctx1.newPage();

    await alice.goto(BASE + PEER_PARAMS);
    const aliceId = await waitForPeerId(alice);

    const bob = await ctx2.newPage();
    await bob.goto(BASE + PEER_PARAMS + '#peer=' + aliceId);

    await expect(alice.locator('#encBadge')).toHaveClass(/active/, { timeout: PEER_TIMEOUT });
    await expect(bob.locator('#encBadge')).toHaveClass(/active/, { timeout: PEER_TIMEOUT });

    await ctx1.close();
    await ctx2.close();
  });
});
