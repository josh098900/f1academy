// Sentry initialization for the browser. Runs whenever a user loads a page.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://90c6facbfabe094777c9d010c32f3497@o4511440924442624.ingest.de.sentry.io/4511440927916112",

  // Full tracing in dev, sampled in prod to stay within the cost budget.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Benign Supabase auth noise: a returning user with an expired/cleared
  // refresh token cookie is correctly treated as logged-out — not an error
  // worth tracking. Dropped so it doesn't bury real issues.
  ignoreErrors: [/Invalid Refresh Token/i, /Auth session missing/i],

  // Drop errors thrown by code we didn't ship: browser-extension content
  // scripts and the JS that social in-app browsers (X, Instagram, Snapchat…)
  // inject into every page. Our own bundle serves from /_next/static, so
  // this can't mask a real app error. First seen live: X's WebView script
  // crashing with "Can't find variable: CONFIG" from app:///.
  denyUrls: [
    /^app:\/\//,
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    /^safari(-web)?-extension:\/\//,
  ],

  // No PII to Sentry — see docs/files/LEGAL_AND_ETHICS.md. No Session Replay,
  // no Logs product in v1 (quota + privacy). Revisit if we need them.
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
