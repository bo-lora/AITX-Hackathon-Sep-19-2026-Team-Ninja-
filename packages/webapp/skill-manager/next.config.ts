import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@contextninja/backend"],
  agentRules: false,
};

export default nextConfig;
