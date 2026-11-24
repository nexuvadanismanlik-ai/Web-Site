/**
 * Server deployment on Vercel with ISR.
 *
 * The site used to be a static export served from a Render Static Site, which
 * meant every published edit needed a full rebuild and the site could not
 * answer a redirect or send a header. On Vercel it runs as a normal Next.js
 * app: pages are rendered once, cached, and re-rendered when the API calls
 * /api/revalidate after a publish (see lib/content.ts and MIGRATION.md).
 */

/**
 * Sent with every response. Kept to headers that cannot break the site:
 * a Content-Security-Policy is shipped in Report-Only mode first, because the
 * analytics integrations the panel can switch on (GTM, Meta Pixel, Clarity)
 * load scripts from hosts that are only known once they are configured.
 * SECURITY.md describes how to promote it to enforcing.
 */
const API_ORIGIN = (() => {
  try {
    return new URL(process.env['NEXT_PUBLIC_API_URL'] ?? '').origin;
  } catch {
    return '';
  }
})();

const ADMIN_ORIGIN = (() => {
  try {
    return new URL(process.env['NEXT_PUBLIC_ADMIN_ORIGIN'] ?? '').origin;
  } catch {
    return '';
  }
})();

const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  // The visual editor opens the site inside the admin panel.
  `frame-ancestors 'self'${ADMIN_ORIGIN ? ` ${ADMIN_ORIGIN}` : ''}`,
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net https://www.clarity.ms",
  `connect-src 'self'${API_ORIGIN ? ` ${API_ORIGIN}` : ''} https://www.google-analytics.com https://*.google-analytics.com https://*.clarity.ms https://www.facebook.com`,
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
];

/** @type {import('next').NextConfig} */
const config = {
  // Kept from the static-export era: every URL the site has ever published
  // ends in a slash, and that is what search engines have indexed.
  trailingSlash: true,
  transpilePackages: ['@nexuva/ui', '@nexuva/shared', '@nexuva/types'],
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.nexuva.com' },
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/_img/:id',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, s-maxage=31536000, immutable' }],
      },
    ];
  },
  async rewrites() {
    return [
      // Photographs, relayed from their CDN through this origin.
      { source: '/_img/:id', destination: 'https://images.unsplash.com/:id' },
      // Browser calls to the API, relayed by app/api/site; nothing to rewrite.
    ];
  },
  async redirects() {
    return [
      // The site used to live under /tr and /en. A static host could only
      // answer those with a meta refresh; this is the real 301.
      { source: '/tr', destination: '/', permanent: true },
      { source: '/tr/:path*', destination: '/:path*', permanent: true },
      { source: '/en', destination: '/', permanent: true },
      { source: '/en/:path*', destination: '/:path*', permanent: true },
    ];
  },
};

export default config;
