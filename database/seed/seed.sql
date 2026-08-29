-- seed.sql — local/dev sample data (mirrors the FIXTURE_* constants in
-- roadmap.md §6.5, used by the test suite).
--
-- Note: `users` rows must reference a real auth.users(id), which only exists
-- after someone signs up via Supabase Auth (or `supabase auth admin create`).
-- So this seed stops at companies/outlets/products/inventory; create your
-- first user through the app's signup flow, then run the UPDATE at the
-- bottom to attach it to this seeded company/outlet as an owner.

insert into companies (id, name, tier, subscription_status, billing_email, industry)
values ('00000000-0000-0000-0000-000000000001', 'Test Store', 'starter', 'trial', 'owner@test.com', 'minimarket')
on conflict (id) do nothing;

insert into outlets (id, company_id, name, address, city)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Toko ABC - Jakarta',
  'Jl. Merdeka 123, Jakarta',
  'Jakarta'
)
on conflict (id) do nothing;

insert into product_categories (id, company_id, name)
values ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Groceries')
on conflict (id) do nothing;

insert into products (id, company_id, category_id, sku, barcode, name, purchase_price, selling_price, unit_type, reorder_level, reorder_quantity)
values
  (
    '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003', 'INDO001', '1234567890123',
    'Indomie Goreng', 2500, 3500, 'pcs', 50, 100
  ),
  (
    '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003', 'AQUA001', '0987654321098',
    'Aqua 600ml', 3000, 4500, 'pcs', 100, 200
  )
on conflict (id) do nothing;

insert into inventory (outlet_id, product_id, quantity_on_hand)
values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 200),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 150)
on conflict (outlet_id, product_id) do nothing;

-- After signing up through the app with e.g. owner@test.com, find the new
-- auth.users id (Supabase dashboard → Authentication → Users) and run:
--
-- update users set
--   company_id = '00000000-0000-0000-0000-000000000001',
--   outlet_id  = '00000000-0000-0000-0000-000000000002',
--   role       = 'master_admin'
-- where email = 'owner@test.com';
