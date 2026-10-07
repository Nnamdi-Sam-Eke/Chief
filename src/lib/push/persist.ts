import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";

/**
 * Shape of the browser's PushSubscription.toJSON() — kept as a plain type
 * here (not importing the DOM lib's PushSubscriptionJSON) so this stays
 * import-safe from server code too.
 */
export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const savePushSubscription = createServerFn({ method: "POST" })
  .validator((input: PushSubscriptionPayload) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into "push_subscriptions" ("endpoint", "keys")
      values (${data.endpoint}, ${JSON.stringify(data.keys)}::jsonb)
      on conflict ("endpoint") do update set "keys" = excluded."keys"
    `;
    return { ok: true as const };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .validator((input: { endpoint: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from "push_subscriptions" where "endpoint" = ${data.endpoint}`;
    return { ok: true as const };
  });
