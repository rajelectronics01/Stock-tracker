/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {},

  async headers() {
    return [
      {
        // Apply these headers to ALL routes
        source: '/(.*)',
        headers: [
          // ✅ Tells browser: camera IS allowed on this origin (required for PWA / mobile Chrome)
          {
            key: 'Permissions-Policy',
            value: 'camera=*, microphone=(), geolocation=()',
          },
          // ✅ Legacy fallback for older Android WebViews / browsers
          {
            key: 'Feature-Policy',
            value: "camera 'self'",
          },
          // ✅ Prevents clickjacking (bonus security)
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          // ✅ Forces HTTPS awareness in mixed-content scenarios
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
