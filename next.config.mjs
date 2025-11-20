/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Fail builds if TypeScript errors are present so we catch regressions early.
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
