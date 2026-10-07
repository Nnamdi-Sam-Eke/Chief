import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";

export const getGoogleCalendarStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ connected: boolean }> => {
    const sql = await getSql();
    const rows = await sql<{ provider: string }>`
      select "provider" from "oauth_tokens" where "provider" = 'google'
    `;
    return { connected: rows.length > 0 };
  },
);

export const disconnectGoogleCalendar = createServerFn({ method: "POST" }).handler(async () => {
  const sql = await getSql();
  await sql`delete from "oauth_tokens" where "provider" = 'google'`;
  return { ok: true as const };
});
