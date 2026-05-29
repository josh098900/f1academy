import "server-only";

// Lock-time reminder email — sent via Resend's REST API (no SDK dependency).
// Uses the same verified domain as the auth emails (noreply@academy.jmathers.com)
// but a different API key entry-point: RESEND_API_KEY lives on Vercel.

const FROM = "Academy Fantasy <noreply@academy.jmathers.com>";
const RESEND_URL = "https://api.resend.com/emails";

export type LockReminderInput = {
  to: string;
  roundNumber: number;
  circuitName: string;
  country: string;
  lockTime: string; // ISO
  appUrl: string; // e.g. https://f1academy-mu.vercel.app
};

function hoursUntil(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3600000));
}

export function buildLockReminder({
  roundNumber,
  circuitName,
  country,
  lockTime,
  appUrl,
}: Omit<LockReminderInput, "to">): { subject: string; html: string } {
  const hours = hoursUntil(lockTime);
  const subject = `R${roundNumber} ${circuitName} locks in ~${hours} hours — you haven't picked yet`;
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0; background:#0a0a0a; font-family:Helvetica,Arial,sans-serif; color:#f5f5f5;">
    <div style="max-width:540px; margin:0 auto; padding:32px 24px;">
      <p style="margin:0 0 8px 0; font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:#888888;">
        Round ${roundNumber} · ${country}
      </p>
      <h1 style="margin:0 0 8px 0; font-size:28px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:#f5f5f5;">
        ${circuitName}
      </h1>
      <p style="margin:0 0 24px 0; font-size:13px; letter-spacing:0.08em; text-transform:uppercase; color:#ff2d92;">
        Locks in ~${hours} hours
      </p>

      <p style="margin:0 0 24px 0; font-size:15px; line-height:1.6; color:#f5f5f5;">
        You haven't saved a team for this round yet. Pick four drivers, set
        your boost, and you're in.
      </p>

      <p style="margin:0 0 32px 0;">
        <a href="${appUrl}/team"
           style="display:inline-block; background:#ff2d92; color:#0a0a0a; font-weight:bold; text-decoration:none; padding:14px 28px; letter-spacing:0.1em; text-transform:uppercase;">
          Pick your team
        </a>
      </p>

      <p style="margin:0; font-size:11px; line-height:1.6; color:#555555;">
        You're getting this because lock-time reminders are on. Turn them off
        any time from the account section on your dashboard, or just reply to
        this email — though no one's reading the inbox, so the toggle is
        faster. Free to play · no money involved.
      </p>
    </div>
  </body>
</html>`;
  return { subject, html };
}

export type SendResult = { ok: true } | { ok: false; error: string };

// Sends the lock reminder via Resend's REST API. Returns ok/error rather than
// throwing so the cron route can keep iterating through recipients.
export async function sendLockReminder(
  input: LockReminderInput
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };

  const { subject, html } = buildLockReminder(input);

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [input.to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
  }

  return { ok: true };
}
