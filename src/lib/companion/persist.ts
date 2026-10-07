import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";

/**
 * Server-side persistence for the companion world model — the durable
 * counterpart to the client's localStorage-persisted Zustand store
 * (src/lib/companion/store.ts).
 *
 * Single-user app: one fixed row (see migrations/0002_companion_world.sql),
 * no auth/user scoping. Traffics a JSON STRING across the createServerFn
 * boundary rather than a typed CompanionWorld object — TanStack Start's
 * serializability checker can't prove CompanionWorld's intentionally-`unknown`
 * field (Insight.pendingPayload) is serializable, even though the actual JSON
 * round-trip through Postgres JSONB is fine. The client's normalizeWorld()
 * already treats any incoming world as untrusted/partial and validates its
 * shape regardless of this boundary's static type.
 */
const SINGLETON_ID = "chief";

/** The saved world as a JSON string, or null if nothing's been saved yet. */
export const loadCompanionWorld = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ worldJson: string | null }> => {
    const sql = await getSql();
    const rows = await sql<{ world: unknown }>`
      select "world" from "companion_world" where "id" = ${SINGLETON_ID}
    `;
    const world = rows[0]?.world;
    return { worldJson: world === undefined ? null : JSON.stringify(world) };
  },
);

export const saveCompanionWorld = createServerFn({ method: "POST" })
  .validator((input: { worldJson: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into "companion_world" ("id", "world", "updated_at")
      values (${SINGLETON_ID}, ${data.worldJson}::jsonb, current_timestamp)
      on conflict ("id")
      do update set "world" = excluded."world", "updated_at" = excluded."updated_at"
    `;
    return { ok: true as const };
  });
