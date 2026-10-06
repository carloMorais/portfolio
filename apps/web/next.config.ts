import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The game used to have a page of its own; it now opens the RaceGame page.
      {
        source: "/:locale(pt|en)/projects/racegame/play",
        destination: "/:locale/projects/racegame",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      // The Food Point demo runs the 2024 frontend unchanged, and it asks for
      // its files at the root (/assets, /js). They live in public/food-point-2024.
      { source: "/assets/:path*", destination: "/food-point-2024/assets/:path*" },
      { source: "/js/:path*", destination: "/food-point-2024/js/:path*" },
    ];
  },
};

export default withNextIntl(nextConfig);
