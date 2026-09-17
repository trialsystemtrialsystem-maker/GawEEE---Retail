-- 059_auto_post_journal_entries.sql
-- Auto-posts journal entries for real sales instead of requiring every one
-- to be entered by hand through JournalEntryManager. Closes the gap flagged
-- when Journal Entries/Tax Report were found already built (todo.md): the
-- ledger existed but nothing fed it from actual transactions except manual
-- entries and Petty Cash's "mark as paid" (036_petty_cash.sql).
--
-- Implemented entirely as triggers on `invoices`, NOT as changes to
-- create_invoice()/void_invoice() themselves — those two functions are the
-- highest-blast-radius code in the app (every POS transaction depends on
-- them) and stay untouched, matching the Petty Cash precedent ("additive
-- calls, not function changes").
--
-- Three triggers, one per invoice lifecycle event:
--   1. INSERT (a new sale) -> post a revenue entry (Dr Kas/Piutang Usaha,
--      Cr Pendapatan Penjualan [, Cr Utang Pajak]) and, if there's a COGS to
--      recognize, a separate HPP entry (Dr Harga Pokok Penjualan,
--      Cr Persediaan). Cash sales debit Kas directly (payment_status is
--      already 'paid'); e-wallet/bank sales debit Piutang Usaha instead,
--      since create_invoice() sets those to 'pending' until the (mock)
--      payment webhook confirms them — see #2.
--   2. UPDATE, payment_status pending -> paid (a pending e-wallet/bank sale
--      settles) -> reclassify Piutang Usaha into Bank (Dr Bank,
--      Cr Piutang Usaha), tagged with the SAME source_type/source_id as #1
--      so a later void (see #3) reverses it along with everything else.
--   3. UPDATE, order_status -> voided -> reverse every posted journal entry
--      tagged to this invoice (however many of #1/#2 actually posted) by
--      creating a mirrored entry with debit/credit swapped and marking the
--      originals 'reversed'.
--
-- The INSERT trigger is a DEFERRED CONSTRAINT TRIGGER (fires at COMMIT, not
-- immediately after the `insert into invoices` statement): create_invoice()
-- inserts the invoice row BEFORE its invoice_items rows (Pass 3), so an
-- ordinary AFTER INSERT trigger would fire before any items existed to
-- compute COGS from (invoice_items.cost_of_goods_sold is already computed
-- per line by create_invoice() — no need to re-derive it here). Deferring to
-- commit-time guarantees every invoice_items row for this sale already
-- exists when the trigger runs.
--
-- Every function is defensive: a missing chart-of-accounts entry (an outlet
-- whose default COA was never seeded, renamed, or deleted) just skips that
-- posting rather than raising, and the whole body is wrapped in an
-- exception handler that logs a WARNING and returns rather than propagating
-- — since the INSERT trigger fires at commit time, an unhandled exception
-- there would roll back the sale itself. A bookkeeping bug must never block
-- or undo an actual transaction.

create or replace function post_invoice_journal_entry() returns trigger
language plpgsql
as $$
declare
  v_debit_account uuid;
  v_revenue_account uuid;
  v_tax_account uuid;
  v_cogs_account uuid;
  v_inventory_account uuid;
  v_cogs_amount decimal;
  v_entry_id uuid;
  v_debit_code varchar(4);
  v_sales_lines jsonb;
begin
  if new.order_status = 'voided' then
    return new;
  end if;

  -- 'paid' (cash) settles immediately -> Kas; anything else create_invoice()
  -- leaves 'pending' until payment confirms -> Piutang Usaha until then.
  v_debit_code := case when new.payment_status = 'paid' then '1000' else '1100' end;
  select id into v_debit_account from chart_of_accounts where outlet_id = new.outlet_id and account_code = v_debit_code;
  select id into v_revenue_account from chart_of_accounts where outlet_id = new.outlet_id and account_code = '4000';
  select id into v_tax_account from chart_of_accounts where outlet_id = new.outlet_id and account_code = '2100';
  select id into v_cogs_account from chart_of_accounts where outlet_id = new.outlet_id and account_code = '5000';
  select id into v_inventory_account from chart_of_accounts where outlet_id = new.outlet_id and account_code = '1200';

  if v_debit_account is null or v_revenue_account is null then
    return new;
  end if;

  v_sales_lines := jsonb_build_array(
    jsonb_build_object('account_id', v_debit_account, 'debit', new.total, 'credit', 0, 'description', new.invoice_number),
    jsonb_build_object('account_id', v_revenue_account, 'debit', 0, 'credit', new.subtotal - new.discount_amount, 'description', new.invoice_number)
  );
  if new.tax_amount > 0 and v_tax_account is not null then
    v_sales_lines := v_sales_lines || jsonb_build_array(
      jsonb_build_object('account_id', v_tax_account, 'debit', 0, 'credit', new.tax_amount, 'description', 'PPN ' || new.invoice_number)
    );
  end if;

  select journal_entry_id into v_entry_id
  from create_journal_entry(new.outlet_id, new.cashier_id, new.created_at::date, 'Penjualan ' || new.invoice_number, v_sales_lines, 'sales', new.id);
  perform post_journal_entry(v_entry_id);

  select coalesce(sum(cost_of_goods_sold), 0) into v_cogs_amount from invoice_items where invoice_id = new.id;

  if v_cogs_amount > 0 and v_cogs_account is not null and v_inventory_account is not null then
    select journal_entry_id into v_entry_id
    from create_journal_entry(
      new.outlet_id, new.cashier_id, new.created_at::date, 'HPP ' || new.invoice_number,
      jsonb_build_array(
        jsonb_build_object('account_id', v_cogs_account, 'debit', v_cogs_amount, 'credit', 0, 'description', new.invoice_number),
        jsonb_build_object('account_id', v_inventory_account, 'debit', 0, 'credit', v_cogs_amount, 'description', new.invoice_number)
      ),
      'sales', new.id
    );
    perform post_journal_entry(v_entry_id);
  end if;

  return new;
exception when others then
  raise warning 'post_invoice_journal_entry failed for invoice %: %', new.id, sqlerrm;
  return new;
end;
$$;

create constraint trigger trg_post_invoice_journal_entry
  after insert on invoices
  deferrable initially deferred
  for each row
  execute function post_invoice_journal_entry();


create or replace function post_invoice_settlement_journal_entry() returns trigger
language plpgsql
as $$
declare
  v_bank_account uuid;
  v_receivable_account uuid;
  v_entry_id uuid;
begin
  if new.order_status = 'voided' or old.payment_status is distinct from 'pending' or new.payment_status is distinct from 'paid' then
    return new;
  end if;

  select id into v_bank_account from chart_of_accounts where outlet_id = new.outlet_id and account_code = '1010';
  select id into v_receivable_account from chart_of_accounts where outlet_id = new.outlet_id and account_code = '1100';
  if v_bank_account is null or v_receivable_account is null then
    return new;
  end if;

  select journal_entry_id into v_entry_id
  from create_journal_entry(
    new.outlet_id, new.cashier_id, current_date, 'Pelunasan ' || new.invoice_number,
    jsonb_build_array(
      jsonb_build_object('account_id', v_bank_account, 'debit', new.total, 'credit', 0, 'description', new.invoice_number),
      jsonb_build_object('account_id', v_receivable_account, 'debit', 0, 'credit', new.total, 'description', new.invoice_number)
    ),
    'sales', new.id
  );
  perform post_journal_entry(v_entry_id);

  return new;
exception when others then
  raise warning 'post_invoice_settlement_journal_entry failed for invoice %: %', new.id, sqlerrm;
  return new;
end;
$$;

create trigger trg_post_invoice_settlement_journal_entry
  after update on invoices
  for each row
  execute function post_invoice_settlement_journal_entry();


create or replace function reverse_invoice_journal_entries() returns trigger
language plpgsql
as $$
declare
  v_entry journal_entries%rowtype;
  v_line journal_entry_details%rowtype;
  v_reversal_lines jsonb;
  v_new_entry_id uuid;
begin
  if old.order_status = 'voided' or new.order_status is distinct from 'voided' then
    return new;
  end if;

  for v_entry in
    select * from journal_entries where source_type = 'sales' and source_id = new.id and status = 'posted'
  loop
    v_reversal_lines := '[]'::jsonb;
    for v_line in select * from journal_entry_details where journal_entry_id = v_entry.id loop
      v_reversal_lines := v_reversal_lines || jsonb_build_array(
        jsonb_build_object('account_id', v_line.account_id, 'debit', v_line.credit, 'credit', v_line.debit, 'description', v_line.description)
      );
    end loop;

    select journal_entry_id into v_new_entry_id
    from create_journal_entry(
      v_entry.outlet_id, new.voided_by, current_date, 'Pembatalan: ' || v_entry.description,
      v_reversal_lines, 'void', new.id
    );
    perform post_journal_entry(v_new_entry_id);

    update journal_entries set status = 'reversed', reversed_date = now(), reversal_reason = new.void_reason
    where id = v_entry.id;
  end loop;

  return new;
exception when others then
  raise warning 'reverse_invoice_journal_entries failed for invoice %: %', new.id, sqlerrm;
  return new;
end;
$$;

create trigger trg_reverse_invoice_journal_entries
  after update on invoices
  for each row
  execute function reverse_invoice_journal_entries();
