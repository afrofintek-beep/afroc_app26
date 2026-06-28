import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.afroloc.app',
  appName: 'AFROLOC',
  webDir: 'dist',
  server: {
    url: 'https://app.afroloc.example',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false
    },
    Camera: {
      saveToGallery: false
    }
  },
  // Deep link configuration
  // iOS: Add URL scheme 'afroloc' in Xcode > Info > URL Types
  // Android: Handled via intent-filter in AndroidManifest.xml
  appUrlScheme: 'afroloc',
};

export default config;
