import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@contextninja/session"],
  agentRules: false,
};

export default nextConfig;
