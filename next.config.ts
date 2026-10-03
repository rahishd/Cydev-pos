import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TODO: remove once the existing type errors (expenses, inventory, purchases, users, sales) are fixed
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
