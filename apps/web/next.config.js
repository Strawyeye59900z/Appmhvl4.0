/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: isProd
        ? [process.env.APP_URL?.replace('https://', '') ?? 'localhost:3000']
        : ['localhost:3000'],
    },
  },
  async rewrites() {
    // Em produção a API roda em localhost:3001 no mesmo LXC.
    // O rewrite evita expor a porta 3001 publicamente — só :3000 fica no túnel.
    const apiBase = process.env.NEXT_PUBLIC_API_URL_INTERNAL ?? 'http://localhost:3001/api/v1';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
