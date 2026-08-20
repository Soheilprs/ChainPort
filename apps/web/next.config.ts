import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@chainport/shared", "@chainport/chain-registry"],
  async rewrites() {
    const api =
      process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    return [{ source: "/backend/:path*", destination: `${api}/:path*` }];
  },
};

export default nextConfig;
