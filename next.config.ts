import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  experimental: { cpus: 2 },
};

export default nextConfig;
