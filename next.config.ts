import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@erp/shared'],
  // Luật 1 (apps/web/CLAUDE.md): web không bao giờ chạm DB — không có serverExternalPackages cho prisma.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;
