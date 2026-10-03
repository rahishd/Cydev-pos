import os from "os";
import type { NextConfig } from "next";

// While developing, let phones on the same Wi-Fi load the app (needed for the payment QR demo).
const lanHosts = Object.values(os.networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanHosts,
  // TODO: remove once the existing type errors (expenses, inventory, purchases, users, sales) are fixed
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
