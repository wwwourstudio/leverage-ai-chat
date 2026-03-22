/** @type {import('next').NextConfig} */
// Note: "SES Removing unpermitted intrinsics" console warnings (5x on load) originate
// from Stripe.js's built-in lockdown-install.js security sandbox — one log per intrinsic
// removed. These are informational, not errors, and cannot be suppressed without removing
// Stripe. They do not affect functionality in production.
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    cpus: 2,
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
