-- 069_whatsapp_broadcast_update_policies.sql
-- whatsapp_broadcasts (013) only had SELECT and INSERT policies, so the send
-- queue could not update its progress (sent_count / status) or clean up a failed
-- creation — RLS silently turned those into no-ops. Run in the Supabase SQL Editor (after 068).

create policy whatsapp_broadcasts_update on whatsapp_broadcasts
  for update using (user_can_access_outlet(outlet_id));
create policy whatsapp_broadcasts_delete on whatsapp_broadcasts
  for delete using (user_can_access_outlet(outlet_id));
