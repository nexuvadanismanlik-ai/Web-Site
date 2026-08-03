/** @type {import('next').NextConfig} */
const config = {
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
};

export default config;
