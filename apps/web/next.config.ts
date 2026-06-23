import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@nexuva/ui', '@nexuva/shared', '@nexuva/types'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: '**.nexuva.com',
      },
    ],
  },
  experimental: {
    typedRoutes: true,
  },
};

export default config;
