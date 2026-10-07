-- Durable storage for the Chief companion world model (goals, projects,
-- decisions, memories, insights, drafts, etc.) — previously localStorage-only.
--
-- One row per user, holding the whole world as JSONB. This mirrors the shape
-- already defined in src/lib/companion/types.ts (CompanionWorld) rather than
-- normalizing into per-entity tables: the schema is still evolving client-side
-- and a single document keeps client and server in lockstep without a second
-- migration for every new field. Revisit normalization only if/when a
-- background job needs to query into specific entities at scale (e.g. "all
-- overdue commitments across users") rather than just loading one user's
-- whole world and deriving from it in code, as insights.ts already does.
create table if not exists "companion_world" (
  "user_id" text not null primary key references "user" ("id") on delete cascade,
  "world" jsonb not null,
  "updated_at" timestamptz not null default current_timestamp
);
