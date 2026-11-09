import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Pièces administratives (devis, factures) envoyées par formulaire : 4 Mo au plus.
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
  // Pages client et de vérification : jamais indexées, jamais mises en cache (section 12).
  async headers() {
    return ['/c/:path*', '/verifier/:path*'].map((source) => ({
      source,
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ],
    }));
  },
  transpilePackages: ['@preuvio/shared', '@preuvio/ui-tokens'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
