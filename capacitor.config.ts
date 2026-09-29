import type {CapacitorConfig} from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rafiq.systembuilder',
  appName: 'System Builder',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
