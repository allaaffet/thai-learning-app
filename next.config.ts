import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Next.js also needs to accept the dev connection from phones on the same LAN.
// Use this machine's exact IPv4 addresses, including loopback, without wildcards.
const localIPv4Addresses = Object.values(networkInterfaces()).flatMap(
  (entries) =>
    (entries ?? [])
      .filter((entry) => entry.family === "IPv4")
      .map((entry) => entry.address),
);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  allowedDevOrigins: [...new Set(localIPv4Addresses)],
  experimental: { cpus: 2 },
};

export default nextConfig;
