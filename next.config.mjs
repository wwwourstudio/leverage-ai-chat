/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Disable webpack cache in development
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  experimental: {
    // Optimize memory usage
    workerThreads: false,
    cpus: 1,
  },
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
