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
};

export default withNextIntl(nextConfig);
