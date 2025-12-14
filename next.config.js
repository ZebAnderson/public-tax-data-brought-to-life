/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['antd', '@ant-design/icons', 'recharts'],
  poweredByHeader: false,

  // Webpack config for Leaflet
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },

  // Environment variables available on client
  env: {
    NEXT_PUBLIC_USE_MOCK_DATA: process.env.NEXT_PUBLIC_USE_MOCK_DATA || 'true',
  },

  // Security headers to allow map tile servers
  async headers() {
    const cspValue = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://tile.openstreetmap.org",
      "connect-src 'self' https://tile.openstreetmap.org ws: wss:",
      "font-src 'self' data:",
      "frame-src 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspValue,
          },
          // Also set CSP-Report-Only for development debugging
          ...(process.env.NODE_ENV === 'development' ? [{
            key: 'Content-Security-Policy-Report-Only',
            value: cspValue,
          }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
