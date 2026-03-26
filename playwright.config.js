import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';

const webrtcLoopback = resolve('tests/webrtc-loopback.js');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-features=WebRtcHideLocalIpsWithMdns'],
        },
      },
      testIgnore: ['**/mobile.spec.js'],
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        launchOptions: {
          args: ['--disable-features=WebRtcHideLocalIpsWithMdns'],
        },
      },
      testMatch: ['**/mobile.spec.js'],
    },
  ],
  webServer: [
    {
      command: 'npm start',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npx peerjs --port 9000',
      url: 'http://127.0.0.1:9000',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
