import type { CapacitorConfig } from '@capacitor/cli';

// The production URL where the web app is hosted.
// Mobile apps load from this URL instead of bundling local files.
const APP_URL = 'https://jloures.github.io/PeerVault/';

const config: CapacitorConfig = {
  appId: 'com.peervault.app',
  appName: 'PeerVault',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    url: APP_URL,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1a1a',
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0f0f0f',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
