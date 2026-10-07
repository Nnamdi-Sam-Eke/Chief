-- OAuth tokens for third-party integrations (currently: Google Calendar,
-- read-only). One row per provider — fine for a single-user app; would need
-- a user_id column if this ever grows multi-user.
create table if not exists "oauth_tokens" (
  "provider" text primary key,
  "access_token" text not null,
  "refresh_token" text not null,
  "expires_at" timestamptz not null,
  "connected_at" timestamptz not null default current_timestamp
);
