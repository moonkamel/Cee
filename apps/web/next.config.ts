import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Pièces administratives (devis, factures) envoyées par formulaire : 4 Mo au plus.
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
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
