/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Fail builds if TypeScript errors are present so we catch regressions early.
    ignoreBuildErrors: false,
  },
  images: {
    // Enable Next.js image optimization for better performance
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  experimental: {
    // Optimize package imports for better bundle size
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
    ],
  },
}

export default nextConfig
