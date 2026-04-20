/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/_next/static/:path*",
        has: [{ type: "query", key: "v" }],
        destination: "/_next/static/:path*"
      }
    ]
  }
}

module.exports = nextConfig
