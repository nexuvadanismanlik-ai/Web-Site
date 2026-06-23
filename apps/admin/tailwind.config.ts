import type { Config } from 'tailwindcss';
import nexuvaPreset from '@nexuva/ui/tailwind';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  presets: [nexuvaPreset as Config],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
