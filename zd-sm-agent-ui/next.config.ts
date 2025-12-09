import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.experiments = { ...config.experiments, topLevelAwait: false };
    return config;
  },
};

export default nextConfig;
