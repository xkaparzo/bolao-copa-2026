import type { NextConfig } from "next";

// Build: force fresh compile with Supabase env vars
const nextConfig: NextConfig = {
  images: {
    domains: [],
  },
  // Permitir que o cron job chame a API
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ]
  },
}

export default nextConfig;
