import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: path.join(__dirname, ".."),        // allow files outside web/
  outputFileTracingIncludes: {                                   // bundle the data files read at runtime
    "/**": [
      "../examples/**/*",
      "../postings/**/*.json",
      "../pipeline/taxonomy/**/*.json",
    ],
  },
  experimental: {
    agentFeedback: true,
    agentUpgrade: "security",
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
