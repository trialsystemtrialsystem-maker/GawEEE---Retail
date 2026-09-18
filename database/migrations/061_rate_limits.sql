-- 061_rate_limits.sql
-- No rate limiting exists anywhere in this app (grep confirms it) — every
-- API route, including public/unauthenticated ones (register, login before
-- lockout kicks in, the public demo seed endpoint), can be called without
-- limit. A DB-backed fixed-window counter, not in-memory: this app runs on
-- Vercel serverless functions, where in-memory state doesn't survive a cold
-- start or get shared across concurrent instances — a Postgres row is the
-- only thing guaranteed visible to every invocation. No RLS needed: this
-- table is only ever touched via the admin client from server-side rate
-- -limiting code, never exposed to a browser client directly.
create table api_rate_limits (
  key text primary key,
  count int not null default 1,
  window_start timestamptz not null default now()
);
