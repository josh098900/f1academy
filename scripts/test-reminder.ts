/**
 * test-reminder — fire one lock-time reminder email for verification, without
 * involving the cron or any prod data. Uses a fake R3 Silverstone payload with
 * a lock ~24 hours from now so the template renders realistically.
 *
 * Run (inline-keyed so the secret never lives in .env.local):
 *
 *   RESEND_API_KEY=re_... pnpm exec tsx scripts/test-reminder.ts <to-email>
 */

import { sendLockReminder } from "../lib/email/reminders";

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes("@")) {
    console.error(
      "Usage: RESEND_API_KEY=re_... pnpm exec tsx scripts/test-reminder.ts <to-email>"
    );
    process.exit(1);
  }

  if (!process.env.RESEND_API_KEY) {
    console.error(
      "RESEND_API_KEY is not set. Prefix the command with RESEND_API_KEY=re_..."
    );
    process.exit(1);
  }

  const lockTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  console.log(`Sending lock-reminder to ${to}…`);
  const result = await sendLockReminder({
    to,
    roundNumber: 3,
    circuitName: "Silverstone Circuit",
    country: "GB",
    lockTime,
    appUrl: "https://f1academy-mu.vercel.app",
  });

  if (result.ok) {
    console.log("✓ Sent. Check the inbox (incl. spam/promotions).");
    process.exit(0);
  } else {
    console.error("✗ Send failed:", result.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
