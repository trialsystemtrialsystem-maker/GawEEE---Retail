-- 057_inventory_realtime.sql
-- Enables Supabase Realtime (logical replication) for the inventory table so
-- the inventory dashboard can push live stock updates instead of only
-- refetching on filter change. RLS already covers this table (the
-- OUTLET-SCOPED OPERATIONAL TABLES loop in 001_initial_schema.sql), and
-- Realtime enforces that same RLS for postgres_changes subscriptions, so no
-- policy changes are needed here — this just turns on replication.
alter publication supabase_realtime add table inventory;
