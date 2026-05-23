import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: "student-pqq",
  project: "javascript-nextjs",

  // Only log source-map upload in CI.
  silent: !process.env.CI,

  // Upload a wider set of source maps for readable stack traces.
  widenClientFileUpload: true,

  webpack: {
    // Tree-shake Sentry debug logging to reduce bundle size.
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
