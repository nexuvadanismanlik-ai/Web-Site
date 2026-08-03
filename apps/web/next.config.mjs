/** @type {import('next').NextConfig} */
const config = {
  // Static export — Render Static Site serves the `out/` directory directly.
  // No Node server at runtime.
  output: 'export',
  // Emits /tr/index.html instead of /tr.html so static hosts resolve
  // directory-style URLs (/tr, /tr/services) without rewrite rules.
  trailingSlash: true,
  transpilePackages: ['@nexuva/ui', '@nexuva/shared', '@nexuva/types'],
  images: {
    // next/image optimization needs a server; static export requires this off.
    unoptimized: true,
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
