import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // better-sqlite3 is een native module; buiten de serverbundel houden.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
