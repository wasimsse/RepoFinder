/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure server-only modules work correctly
  serverExternalPackages: ['child_process'],
}

module.exports = nextConfig

