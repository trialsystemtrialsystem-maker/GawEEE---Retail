-- 036_petty_cash.sql
-- Petty Cash / Expense Ledger — extends expense_requests (018_employee_expansion.sql)
-- rather than a new system. An approved request gets a "mark as paid" action
-- (records when/how it was actually disbursed) which optionally posts a
-- journal entry via the existing create_journal_entry()/post_journal_entry()
-- (014_accounting_functions.sql, additive calls, not function changes)
-- debiting Beban Operasional (5200) and crediting Kas (1000) — both already
-- seeded into every outlet's default chart of accounts.

alter table expense_requests add column paid_at timestamptz;
alter table expense_requests add column payment_method varchar(50); -- 'cash', 'bank_transfer'
