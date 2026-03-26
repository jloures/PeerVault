import { test as base } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const loopbackScript = readFileSync(resolve(__dirname, 'webrtc-loopback.js'), 'utf8');

/**
 * Extended Playwright test that injects WebRTC loopback ICE candidates.
 * This fixes WebRTC connectivity when the local network uses a VPN tunnel
 * interface that doesn't support loopback UDP (e.g., WireGuard/Tailscale).
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(loopbackScript);
    await use(context);
  },
  browser: async ({ browser }, use) => {
    // Wrap browser.newContext to inject the script into new contexts
    const origNewContext = browser.newContext.bind(browser);
    browser.newContext = async (options) => {
      const ctx = await origNewContext(options);
      await ctx.addInitScript(loopbackScript);
      return ctx;
    };
    await use(browser);
  },
});

export { expect } from '@playwright/test';
