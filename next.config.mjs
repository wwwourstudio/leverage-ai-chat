/** @type {import('next').NextConfig} */
// Note: "SES Removing unpermitted intrinsics" console warnings (5x on load) originate
// from Stripe.js's built-in lockdown-install.js security sandbox — one log per intrinsic
// removed. These are informational, not errors, and cannot be suppressed without removing
// Stripe. They do not affect functionality in production.
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    cpus: 2,
  },
  // Turbopack (default in Next.js 16) — empty config silences the webpack/turbopack conflict warning
  turbopack: {},
  // Prevent webpack from attempting to bundle Node.js built-ins for the browser bundle.
  // This guards against any server-only libraries (fs, net, tls, crypto) that might be
  // transitively imported in client code, avoiding "Module not found: Can't resolve 'fs'" errors.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
  // Allow iframe embedding for v0 preview.
  // X-Frame-Options SAMEORIGIN is a legacy fallback — modern browsers use
  // Content-Security-Policy frame-ancestors (which takes precedence).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://v0.dev https://*.v0.dev",
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
}

export default nextConfig
