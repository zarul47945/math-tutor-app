import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return {
      // Serve the complete game as a top-level document for camera/fullscreen.
      beforeFiles: [{ source: "/game", destination: "/air-math/index.html" }],
    };
  },
};

export default nextConfig;
