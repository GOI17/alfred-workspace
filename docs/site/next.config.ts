import { createMDX } from 'fumadocs-mdx/next'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep this zone's Next assets separate from the marketing zone.
  assetPrefix: '/docs-static',
  turbopack: {
    root: process.cwd()
  },
  async headers() {
    const media = 'public, max-age=2592000, stale-while-revalidate=86400'
    return [
      {
        source: '/docs/:all*(mp4|gif)',
        headers: [{ key: 'Cache-Control', value: media }]
      },
      {
        source: '/docs/posters/:path*',
        headers: [{ key: 'Cache-Control', value: media }]
      },
      {
        source: '/docs/videos/:path*',
        headers: [{ key: 'Cache-Control', value: media }]
      }
    ]
  }
}

const withMDX = createMDX()

export default withMDX(nextConfig)
