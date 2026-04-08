/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: 'minio' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.API_INTERNAL_URL || 'http://localhost:8000'}/:path*`,
      },
      {
        source: '/api/ai/:path*',
        destination: `${process.env.AI_INTERNAL_URL || 'http://localhost:8001'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
