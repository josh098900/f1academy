// Sentry initialization for the edge runtime (proxy, edge routes).
// Required even when running locally. Unrelated to the Vercel Edge Runtime.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://90c6facbfabe094777c9d010c32f3497@o4511440924442624.ingest.de.sentry.io/4511440927916112",

  // Full tracing in dev, sampled in prod to stay within the cost budget.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // No PII to Sentry — see docs/files/LEGAL_AND_ETHICS.md.
  sendDefaultPii: false,
});
