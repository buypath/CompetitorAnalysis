// MIT Licence — AI CFO Wallet — Buypath Ltd
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: false,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api/v1',
  },
};

export default nextConfig;
