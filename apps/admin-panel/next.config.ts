import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  headers() {
    return Promise.resolve([
      {
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value:
              "default-src 'self'; connect-src 'self' http: https: ws: wss:; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
          },
        ],
        source: '/(.*)',
      },
    ]);
  },
  reactStrictMode: true,
  transpilePackages: ['@tuljai/shared', '@tuljai/types', '@tuljai/utils'],
};

export default nextConfig;
