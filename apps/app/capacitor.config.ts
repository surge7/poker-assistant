import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.poker.assistant',
  appName: "Покерный тренажер СР",
  webDir: 'dist',
  server: {
    // Офлайн: не загружать контент с внешнего URL
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#0d2818',
      style: 'DARK',
      overlaysWebView: false,
    },
  },
};

export default config;
