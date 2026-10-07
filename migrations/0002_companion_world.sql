-- Durable storage for the Chief companion world model (goals, projects,
-- decisions, memories, insights, drafts, etc.) — previously localStorage-only.
--
-- Single-user app, no accounts: one fixed row (id = 'chief'), not scoped to
-- any user table. If this ever needs real multi-user auth later, migrate to
-- a user_id-keyed table then (see git history for the auth-scoped version of
-- this migration, if reintroducing it).
create table if not exists "companion_world" (
  "id" text primary key,
  "world" jsonb not null,
  "updated_at" timestamptz not null default current_timestamp
);
