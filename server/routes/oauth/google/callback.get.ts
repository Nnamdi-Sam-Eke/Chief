import { defineHandler } from "nitro";
import { getSql } from "@/lib/db";

/**
 * GET /oauth/google/callback — Google redirects here with ?code=... after
 * the user approves the consent screen. Exchanges the code for tokens,
 * stores them, sends them back to Settings.
 */
export default defineHandler(async (event) => {
  const url = new URL(event.req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) {
    return Response.redirect(`/settings?google=error&reason=${encodeURIComponent(error)}`, 302);
  }
  if (!code) {
    return new Response("Missing authorization code.", { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return new Response("Google Calendar isn't configured yet.", { status: 500 });
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    return Response.redirect("/settings?google=error&reason=token_exchange_failed", 302);
  }

  const body = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!body.access_token || !body.refresh_token) {
    // No refresh_token usually means the account already granted access
    // before without `prompt=consent` taking effect — reconnecting from
    // Settings (which always sends prompt=consent) should fix it.
    return Response.redirect("/settings?google=error&reason=no_refresh_token", 302);
  }

  const expiresAt = new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString();
  const sql = await getSql();
  await sql`
    insert into "oauth_tokens" ("provider", "access_token", "refresh_token", "expires_at")
    values ('google', ${body.access_token}, ${body.refresh_token}, ${expiresAt})
    on conflict ("provider")
    do update set
      "access_token" = excluded."access_token",
      "refresh_token" = excluded."refresh_token",
      "expires_at" = excluded."expires_at"
  `;

  return Response.redirect("/settings?google=connected", 302);
});
