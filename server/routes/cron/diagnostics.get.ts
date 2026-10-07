import { defineHandler } from "nitro";
import { getSql } from "@/lib/db";
import { deriveInsights } from "@/lib/companion/insights";
import { sendPushToAll } from "@/lib/push/send.server";
import type { CompanionWorld, Draft, Insight } from "@/lib/companion/types";

/**
 * The background job that makes "notices things without the app being open"
 * real. Wired to Vercel Cron (see vercel.json — schedule and this path must
 * match). Single-user app: one row in companion_world (id = 'chief'), no
 * auth/user loop needed.
 *
 * On each run:
 *   1. Load the stored world.
 *   2. Re-run the SAME deriveInsights() the client already uses on every chat
 *      turn (src/lib/companion/insights.ts) — no separate "server logic" to
 *      keep in sync with the client's.
 *   3. Merge only NEW insights/drafts in (dedup by title+body / title) rather
 *      than replacing wholesale like the client's refreshInsights() does — a
 *      cron run happens unattended, so blindly replacing would resurrect
 *      insights already dismissed. The client path has this same
 *      resurrection quirk and is left as-is for now; this endpoint just
 *      doesn't repeat it.
 *   4. Save the merged world back.
 *
 * Deliberately doesn't send a notification when there's nothing new to
 * report — see sendPushToAll for what happens once VAPID keys are set up
 * (Settings > Notifications is where a browser actually subscribes).
 */
const SINGLETON_ID = "chief";

function dedupeKey(i: Pick<Insight, "title" | "body">): string {
  return `${i.title}::${i.body}`;
}

export default defineHandler(async (event) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed: an unconfigured secret must never mean "unprotected".
    return new Response("CRON_SECRET is not configured", { status: 500 });
  }
  const authHeader = event.req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sql = await getSql();
  const rows = await sql<{ world: CompanionWorld }>`
    select "world" from "companion_world" where "id" = ${SINGLETON_ID}
  `;
  const world = rows[0]?.world;
  if (!world || typeof world !== "object" || !Array.isArray(world.goals)) {
    return Response.json({ ok: true, skipped: "no world saved yet" });
  }

  const derived = deriveInsights(world);
  const existingInsightKeys = new Set((world.insights ?? []).map(dedupeKey));
  const freshInsights = derived.insights.filter((i) => !existingInsightKeys.has(dedupeKey(i)));

  const existingDraftTitles = new Set((world.drafts ?? []).map((d: Draft) => d.title));
  const freshDrafts = derived.drafts.filter((d) => !existingDraftTitles.has(d.title));

  if (freshInsights.length === 0 && freshDrafts.length === 0) {
    return Response.json({ ok: true, insightsAdded: 0, draftsAdded: 0 });
  }

  const nextWorld: CompanionWorld = {
    ...world,
    insights: [...freshInsights, ...(world.insights ?? [])].slice(0, 40),
    drafts: [...freshDrafts, ...(world.drafts ?? [])].slice(0, 12),
  };

  await sql`
    update "companion_world"
    set "world" = ${JSON.stringify(nextWorld)}::jsonb, "updated_at" = current_timestamp
    where "id" = ${SINGLETON_ID}
  `;

  const headline = freshInsights[0]?.title ?? freshDrafts[0]?.title ?? "New activity";
  const extraCount = freshInsights.length + freshDrafts.length - 1;
  const push = await sendPushToAll({
    title: "Chief noticed something",
    body: extraCount > 0 ? `${headline} (+${extraCount} more)` : headline,
    url: "/",
  });

  return Response.json({
    ok: true,
    insightsAdded: freshInsights.length,
    draftsAdded: freshDrafts.length,
    push,
  });
});
