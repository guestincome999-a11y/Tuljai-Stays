import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@tuljai/shared', '@tuljai/types', '@tuljai/utils'],
};

export default nextConfig;
