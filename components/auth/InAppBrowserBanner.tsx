"use client";

import { useSyncExternalStore } from "react";

// Detects User-Agent strings of social-app in-app WebViews. Google's OAuth
// rejects these with error 403 disallowed_useragent ("Use secure browsers"
// policy) — there's no developer setting that lets us through, so the only
// practical move is to warn the user before they tap the Google button.
// Patterns cover the apps people actually share links in.
const IN_APP_PATTERNS: RegExp[] = [
  /FBAN|FBAV/i, // Facebook (Browser + App)
  /Instagram/i, // Instagram
  /Snap\b|Snapchat/i, // Snapchat
  // TikTok: iOS UAs often don't include the literal "TikTok" string and
  // instead identify ByteDance via internal codenames (trill_*), the locale
  // header, or the bespoke webview marker. Without these, sharing a link in
  // TikTok lands users on Google's 403 wall with no banner.
  /TikTok|musical_ly|trill_|BytedanceWebview|ByteLocale/i,
  /Reddit\//i, // Reddit (app prefix)
  /LinkedInApp/i, // LinkedIn
  /Twitter|TwitterAndroid/i, // X / Twitter
  /WhatsApp/i, // WhatsApp
  /\bLine\//i, // LINE
  /MessengerForiOS|FBMessenger/i, // Messenger
  /KAKAOTALK/i, // KakaoTalk
  /; wv\)/, // Android WebView (catch-all — only WebViews emit this)
];

function detect(): boolean {
  if (typeof navigator === "undefined") return false;
  return IN_APP_PATTERNS.some((p) => p.test(navigator.userAgent));
}

// useSyncExternalStore lets us read navigator.userAgent without a setState-
// in-effect lint complaint. UA doesn't change during a session so subscribe
// is a no-op; the server snapshot is `false` so SSR hides the banner and
// hydration matches when the client renders.
const subscribe = () => () => {};

export function InAppBrowserBanner() {
  const show = useSyncExternalStore(subscribe, detect, () => false);

  if (!show) return null;

  return (
    <aside
      role="status"
      className="border-l-2 border-warning bg-warning/[0.06] px-3 py-2 font-body text-xs leading-relaxed text-warning"
    >
      Heads-up: in-app browsers (Reddit, Snapchat, Instagram, etc.) block
      Google sign-in. Use the email option below, or open this page in your
      phone&apos;s normal browser via the app&apos;s ⋯ menu.
    </aside>
  );
}
