/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Prevent bundling of heavy server-only packages that don't need to be compiled
  serverExternalPackages: ['@supabase/supabase-js'],
  // Allow iframe embedding for v0 preview
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.v0.dev https://v0.dev",
          },
        ],
      },
    ];
  },
}

export default nextConfig
