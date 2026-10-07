import { getSql } from "@/lib/db";

/**
 * Genuinely server-only (like push/send.server.ts) — holds refresh-token
 * exchange logic and calls Google's API directly with a bearer token. Never
 * import this from client code; only from other server code (chat.ts injects
 * its output into context, the oauth status/disconnect functions in
 * google-oauth.ts check/clear it).
 */

interface StoredToken {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

async function getValidAccessToken(): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<StoredToken>`
    select "access_token", "refresh_token", "expires_at" from "oauth_tokens" where "provider" = 'google'
  `;
  const row = rows[0];
  if (!row) return null;

  // Refresh a little early (60s) rather than right at the edge of expiry.
  if (new Date(row.expires_at).getTime() - 60_000 > Date.now()) {
    return row.access_token;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) return null;

  const expiresAt = new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString();
  await sql`
    update "oauth_tokens"
    set "access_token" = ${body.access_token}, "expires_at" = ${expiresAt}
    where "provider" = 'google'
  `;
  return body.access_token;
}

export interface CalendarEvent {
  summary: string;
  start: string;
  end: string;
}

/** Upcoming events, or null if Google Calendar isn't connected / token refresh failed. */
export async function getUpcomingEvents(maxResults = 5): Promise<CalendarEvent[] | null> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: String(maxResults),
    singleEvents: "true",
    orderBy: "startTime",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;

  const body = (await res.json()) as {
    items?: Array<{
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };
  return (body.items ?? []).map((item) => ({
    summary: item.summary || "(untitled event)",
    start: item.start?.dateTime || item.start?.date || "",
    end: item.end?.dateTime || item.end?.date || "",
  }));
}
