import { redirect } from 'next/navigation'

// Purchase Delivery — no separate feature needed: PO receiving already
// handles this from the Purchase Order page (Phase 13 Batch K). Redirect
// so the menu item isn't a dead end.
export default function PurchaseDeliveryPage() {
  redirect('/dashboard/suppliers/purchase-orders')
}
