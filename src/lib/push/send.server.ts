import webpush from "web-push";
import { getSql } from "@/lib/db";

/**
 * Genuinely server-only (unlike persist.ts's createServerFn functions): this
 * imports the Node-only `web-push` package directly, with no isomorphic
 * client/server split. Only ever call this from server code (the cron route
 * that already imports it does exactly that) — never from a client
 * component or hook.
 */

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

/**
 * Push `{ title, body, url }` to every subscribed browser. Silently drops
 * dead subscriptions (410 Gone / 404 — the browser unsubscribed or the
 * endpoint expired) rather than retrying them. Returns how many sends
 * succeeded, so the caller can log/report it.
 */
export async function sendPushToAll(payload: {
  title: string;
  body: string;
  url?: string;
}): Promise<{ sent: number; pruned: number; skipped: boolean }> {
  if (!ensureVapid()) {
    // Not configured yet (no VAPID_* env vars) — this is expected until
    // someone actually enables notifications in Settings. Don't throw; the
    // insight computation this rides alongside should still succeed.
    return { sent: 0, pruned: 0, skipped: true };
  }

  const sql = await getSql();
  const subs = await sql<{ endpoint: string; keys: { p256dh: string; auth: string } }>`
    select "endpoint", "keys" from "push_subscriptions"
  `;

  let sent = 0;
  let pruned = 0;
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body);
        sent += 1;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await sql`delete from "push_subscriptions" where "endpoint" = ${sub.endpoint}`;
          pruned += 1;
        } else {
          console.error("[push] send failed:", err);
        }
      }
    }),
  );

  return { sent, pruned, skipped: false };
}
