-- 058_onboarding_wizard.sql
-- Backs the first-time onboarding wizard (design-system.md §3.3: outlet info
-- -> initial products -> payment methods -> invite staff -> success), which
-- register() currently skips straight past (it auto-creates one default
-- outlet with placeholder address/city and stops there).
--
-- onboarding_completed_at gates whether a master_admin gets redirected into
-- the wizard on login. Existing companies already set their outlet up by
-- hand before this wizard existed, so they're backfilled as already-done —
-- only companies created after this migration (which won't match this
-- backfill) start out with it null and see the wizard.
alter table companies add column onboarding_completed_at timestamptz;

update companies set onboarding_completed_at = created_at where onboarding_completed_at is null;

-- companies only ever had a select policy (010_rls_policies.sql) — nothing
-- could update it through the RLS-scoped client at all, which the wizard's
-- "mark onboarding complete" step needs. master_admin-only, own company.
create policy companies_master_admin_update on companies
  for update using (
    id = current_user_company_id()
    and current_user_role() = 'master_admin'
  );
