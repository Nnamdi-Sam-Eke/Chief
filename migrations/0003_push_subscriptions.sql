-- Web Push subscriptions. A person can have more than one (phone browser +
-- desktop browser both subscribed), so this is NOT a singleton like
-- companion_world — one row per subscribed browser/device.
create table if not exists "push_subscriptions" (
  "endpoint" text primary key,
  "keys" jsonb not null,
  "created_at" timestamptz not null default current_timestamp
);
