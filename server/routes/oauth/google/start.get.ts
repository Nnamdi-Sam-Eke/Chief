import { defineHandler } from "nitro";

/**
 * GET /oauth/google/start — redirects to Google's consent screen.
 * Linked from Settings ("Connect Google Calendar"). See callback.get.ts for
 * the other half of this flow, and google-calendar.server.ts for how the
 * resulting token gets used.
 */
export default defineHandler(() => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return new Response(
      "Google Calendar isn't configured yet — GOOGLE_CLIENT_ID / GOOGLE_REDIRECT_URI missing.",
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    // Forces Google to hand back a refresh_token even on a reconnect, where
    // it would otherwise assume you already have one from the first grant.
    prompt: "consent",
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302);
});
