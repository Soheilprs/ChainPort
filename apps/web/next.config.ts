import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@chainport/shared", "@chainport/chain-registry"],
};

export default nextConfig;
