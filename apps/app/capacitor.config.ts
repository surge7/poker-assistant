import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.poker.assistant',
  appName: "Sergey Romakhin's Poker Trainer",
  webDir: 'dist',
  server: {
    // Офлайн: не загружать контент с внешнего URL
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    // При необходимости: настройки Splash, Keyboard и т.д.
  },
};

export default config;
