import type { Config } from 'tailwindcss';
import nexuvaPreset from '@nexuva/ui/tailwind';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  presets: [nexuvaPreset as Config],
  // hover: utilities apply only on devices that can hover. On a phone a tap
  // would otherwise leave a card enlarged until the next tap elsewhere.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
