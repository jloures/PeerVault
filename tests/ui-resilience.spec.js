// @ts-check
import { test, expect } from './fixtures.js';

const PEER_PARAMS = '?peerHost=127.0.0.1&peerPort=9000';
const PEER_TIMEOUT = 30_000;

/** Wait for PeerJS to assign an ID */
async function waitForPeerId(page) {
  await expect(page.locator('#myId')).not.toHaveText('...', { timeout: PEER_TIMEOUT });
  return page.locator('#myId').textContent();
}

// ── HTML Structure ──

test.describe('HTML Structure', () => {
  test('page has exactly one <main> element', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await expect(page.locator('main')).toHaveCount(1);
  });

  test('page has exactly one <header> element', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await expect(page.locator('header')).toHaveCount(1);
  });

  test('meta tags: theme-color is present', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBeTruthy();
  });

  test('meta tags: apple-mobile-web-app-capable is set', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const content = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content');
    expect(content).toBe('yes');
  });

  test('meta tags: apple-mobile-web-app-status-bar-style is set', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const content = await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute('content');
    expect(content).toBe('black-translucent');
  });
});

// ── Dark Theme & Global Styles ──

test.describe('Dark Theme & Global Styles', () => {
  test('page uses dark theme (body background is dark)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // --bg: #0f0f0f → rgb(15, 15, 15)
    // Parse the rgb values and verify they are dark
    const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    expect(match).toBeTruthy();
    const [, r, g, b] = match.map(Number);
    expect(r).toBeLessThan(50);
    expect(g).toBeLessThan(50);
    expect(b).toBeLessThan(50);
  });

  test('all CSS custom properties are defined in :root', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const props = ['--bg', '--surface', '--surface-2', '--border', '--text', '--text-dim',
        '--accent', '--accent-hover', '--green', '--yellow', '--red', '--radius'];
      return props.every(p => root.getPropertyValue(p).trim() !== '');
    });
    expect(result).toBe(true);
  });

  test('box-sizing is border-box globally', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const boxSizing = await page.evaluate(() =>
      getComputedStyle(document.querySelector('main')).boxSizing
    );
    expect(boxSizing).toBe('border-box');
  });

  test('body has no overflow (hidden)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(overflow).toBe('hidden');
  });
});

// ── Messages Container ──

test.describe('Messages Container', () => {
  test('messages container has overflow-y auto (scrollable)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const overflowY = await page.locator('#messages').evaluate(el =>
      getComputedStyle(el).overflowY
    );
    expect(overflowY).toBe('auto');
  });

  test('messages container uses flexbox column layout', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const styles = await page.locator('#messages').evaluate(el => {
      const s = getComputedStyle(el);
      return { display: s.display, flexDirection: s.flexDirection };
    });
    expect(styles.display).toBe('flex');
    expect(styles.flexDirection).toBe('column');
  });
});

// ── Button Styles ──

test.describe('Button Styles', () => {
  test('buttons have cursor:pointer when enabled', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    const cursor = await page.locator('#connectBtn').evaluate(el =>
      getComputedStyle(el).cursor
    );
    expect(cursor).toBe('pointer');
  });

  test('buttons have cursor:not-allowed when disabled', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    // sendBtn is disabled initially
    const cursor = await page.locator('#sendBtn').evaluate(el =>
      getComputedStyle(el).cursor
    );
    expect(cursor).toBe('not-allowed');
  });

  test('disabled buttons have reduced opacity (0.4)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const opacity = await page.locator('#sendBtn').evaluate(el =>
      getComputedStyle(el).opacity
    );
    expect(parseFloat(opacity)).toBeCloseTo(0.4, 1);
  });
});

// ── Input Styles ──

test.describe('Input Styles', () => {
  test('input focus changes border color', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    const unfocusedBorder = await page.locator('#remoteIdInput').evaluate(el =>
      getComputedStyle(el).borderColor
    );
    await page.locator('#remoteIdInput').focus();
    // Wait for 0.2s CSS transition to complete
    await page.waitForTimeout(300);
    const focusedBorder = await page.locator('#remoteIdInput').evaluate(el =>
      getComputedStyle(el).borderColor
    );
    // Border color should change on focus
    expect(focusedBorder).not.toBe(unfocusedBorder);
  });
});

// ── QR Overlay Styles ──

test.describe('QR Overlay Styles', () => {
  test('QR overlay uses position:fixed and covers full viewport (inset: 0)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);
    await page.locator('#qrBtn').click();

    const styles = await page.locator('#qrOverlay').evaluate(el => {
      const s = getComputedStyle(el);
      return {
        position: s.position,
        top: s.top,
        right: s.right,
        bottom: s.bottom,
        left: s.left,
      };
    });
    expect(styles.position).toBe('fixed');
    expect(styles.top).toBe('0px');
    expect(styles.right).toBe('0px');
    expect(styles.bottom).toBe('0px');
    expect(styles.left).toBe('0px');
  });

  test('QR overlay has backdrop blur', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);
    await page.locator('#qrBtn').click();

    const backdropFilter = await page.locator('#qrOverlay').evaluate(el =>
      getComputedStyle(el).backdropFilter
    );
    expect(backdropFilter).toContain('blur');
  });
});

// ── Message Animation ──

test.describe('Message Animation', () => {
  test('message animation exists (fadeIn keyframes)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const hasFadeIn = await page.evaluate(() => {
      const rules = Array.from(document.styleSheets)
        .flatMap(s => { try { return Array.from(s.cssRules); } catch { return []; } });
      return rules.some(r =>
        r instanceof CSSKeyframesRule && r.name === 'fadeIn'
      );
    });
    expect(hasFadeIn).toBe(true);
  });
});

// ── Message Bubble Styles ──

test.describe('Message Bubble Styles', () => {
  test('own message bubble has accent background color', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(() => {
      const rules = Array.from(document.styleSheets)
        .flatMap(s => { try { return Array.from(s.cssRules); } catch { return []; } });
      const rule = rules.find(r => r.selectorText === '.msg.own .msg-bubble');
      return rule ? rule.style.background : null;
    });
    expect(result).toContain('var(--accent)');
  });

  test('their message bubble has surface-2 background', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(() => {
      const rules = Array.from(document.styleSheets)
        .flatMap(s => { try { return Array.from(s.cssRules); } catch { return []; } });
      const rule = rules.find(r => r.selectorText === '.msg.their .msg-bubble');
      return rule ? rule.style.background : null;
    });
    expect(result).toContain('var(--surface-2)');
  });

  test('system messages have pill shape (border-radius: 20px)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(() => {
      const rules = Array.from(document.styleSheets)
        .flatMap(s => { try { return Array.from(s.cssRules); } catch { return []; } });
      const rule = rules.find(r => r.selectorText === '.msg-system');
      return rule ? rule.style.borderRadius : null;
    });
    expect(result).toBe('20px');
  });
});

// ── Layout Styles ──

test.describe('Layout Styles', () => {
  test('header uses flexbox layout', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const styles = await page.locator('.header').evaluate(el => {
      const s = getComputedStyle(el);
      return { display: s.display, alignItems: s.alignItems };
    });
    expect(styles.display).toBe('flex');
    expect(styles.alignItems).toBe('center');
  });

  test('chat input area has border-top separator', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const borderTop = await page.locator('.chat-input').evaluate(el =>
      getComputedStyle(el).borderTopStyle
    );
    expect(borderTop).toBe('solid');
  });

  test('connect bar has border-bottom separator', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const borderBottom = await page.locator('.connect-bar').evaluate(el =>
      getComputedStyle(el).borderBottomStyle
    );
    expect(borderBottom).toBe('solid');
  });
});

// ── Encryption Badge Styles ──

test.describe('Encryption Badge Styles', () => {
  test('encryption badge uses green color scheme', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(() => {
      const rules = Array.from(document.styleSheets)
        .flatMap(s => { try { return Array.from(s.cssRules); } catch { return []; } });
      const rule = rules.find(r => r.selectorText === '.encryption-badge');
      return rule ? rule.style.color : null;
    });
    expect(result).toContain('var(--green)');
  });

  test('encryption badge has lock SVG icon', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const hasSvg = await page.locator('#encBadge svg').count();
    expect(hasSvg).toBe(1);

    // Verify the SVG contains a lock path (rect for lock body)
    const hasRect = await page.locator('#encBadge svg rect').count();
    expect(hasRect).toBeGreaterThan(0);
  });
});

// ── Empty State Styles ──

test.describe('Empty State Styles', () => {
  test('empty state uses flexbox centered layout', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const styles = await page.locator('#emptyState').evaluate(el => {
      const s = getComputedStyle(el);
      return { display: s.display, alignItems: s.alignItems, justifyContent: s.justifyContent };
    });
    expect(styles.display).toBe('flex');
    expect(styles.alignItems).toBe('center');
    expect(styles.justifyContent).toBe('center');
  });

  test('empty state text color is dim', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const color = await page.locator('#emptyState').evaluate(el =>
      getComputedStyle(el).color
    );
    // --text-dim: #777 → rgb(119, 119, 119)
    expect(color).toContain('119');
  });

  test('typing indicator is self-aligned to flex-start', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const alignSelf = await page.locator('#typingIndicator').evaluate(el =>
      getComputedStyle(el).alignSelf
    );
    expect(alignSelf).toBe('flex-start');
  });

  test('id-value uses monospace font family', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const fontFamily = await page.locator('#myId').evaluate(el =>
      getComputedStyle(el).fontFamily
    );
    expect(fontFamily).toMatch(/mono/i);
  });
});

// ── Page Load Resilience ──

test.describe('Page Load Resilience', () => {
  test('page loads without console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/' + PEER_PARAMS);
    await waitForPeerId(page);

    // Filter out expected network errors (PeerJS might retry connections)
    const unexpectedErrors = errors.filter(e =>
      !e.includes('net::ERR') &&
      !e.includes('Failed to load resource') &&
      !e.includes('WebSocket')
    );
    expect(unexpectedErrors).toEqual([]);
  });
});
