# GawEEE | Complete UI/UX Design System
**Landing Page + Dashboards + Component Library**

---

## 1. DESIGN PHILOSOPHY & COLOR SYSTEM

### Principles
1. Simplicity for UMKM — clear, uncluttered, progressive disclosure
2. Speed & efficiency — minimal clicks, keyboard shortcuts, POS < 30s
3. Real-time feedback — instant inventory/sales updates, webhook-driven
4. Mobile-first — responsive, touch targets min 44x44px, PWA-ready (Phase 2)
5. Localization — Bahasa Indonesia primary, IDR currency (Rp 1.234.567), DD/MM/YYYY, 24h time
6. Accessibility — WCAG 2.1 AA (4.5:1 contrast, keyboard nav, screen reader, visible focus)

### Color Palette
```
PRIMARY:
- Primary: #1F2937 (Gray-900) — nav, headers, CTAs
- Primary Accent: #3B82F6 (Blue-500) — links, hover, highlights
- Secondary Accent: #10B981 (Emerald-500) — success states

SEMANTIC:
- Success: #10B981 | Warning: #F59E0B | Danger: #EF4444 | Info: #3B82F6 | Neutral: #6B7280

NEUTRAL:
- Gray-50 #F9FAFB, Gray-100 #F3F4F6, Gray-200 #E5E7EB, Gray-500 #6B7280,
  Gray-700 #374151, Gray-900 #111827, White #FFFFFF

CATEGORY (extended):
- Bakery/Frozen: #8B5CF6 | Beverages: #06B6D4 | Snacks: #EC4899 | Groceries: #84CC16 | Other: #6366F1
```

### Typography
Font stack: Inter (400/500/600/700), Fira Code (monospace for numbers), system fallback.
Scale: Display XL 48px, Display L 36px, H1 32px, H2 24px, H3 20px, Body L 18px, Body 16px,
Body Small 14px, Body XSmall 12px, Mono 14px.

### Spacing (8px base)
2xs 4px, xs 8px, sm 12px, base 16px, lg 20px, xl 24px, 2xl 32px, 3xl 40px, 4xl 48px, 5xl 56px, 6xl 64px.
Card padding 16/24px, button padding 8px/12px, form field gap 12px, section gap 32-40px.

### Border Radius
xs 2px, sm 4px (inputs), base 6px (buttons/cards), lg 8px (cards/modals), full 9999px (pills/avatars).

### Shadows
none / xs (0 1px 2px) / sm (default cards, inputs) / base (elevated cards, hover) /
lg (modals, dropdowns) / xl (overlays, focus) / 2xl (full-page modals, tooltips).

---

## 2. LANDING PAGE (Marketing Website)

Sections: Hero (headline + CTA "Coba Gratis 14 Hari" + trust badges) â Pain Points (2x2 grid) â
Features (3-col grid: Real-time POS, Inventory, Financial Reports, Multi-outlet, Payment Integration,
Compliance) â How It Works (4-step timeline) â Pricing (3 tiers: Starter Rp99K, Professional Rp199K
highlighted, Enterprise custom) â Testimonials (carousel/3-col) â FAQ (accordion) â Footer.

Built with Tailwind CSS utility classes; hero uses `grid md:grid-cols-2`, gradient background,
rounded-xl cards with hover:shadow-lg, blue-500 primary CTA buttons. Professional tier card is
highlighted (bg-blue-500, scale-105, "POPULER" badge).

---

## 3. AUTHENTICATION FLOWS

### Sign Up
Fields: Nama Perusahaan/Toko, Email, No. Telepon, Password (min 8 char), Confirm Password,
Tipe Bisnis (dropdown: Frozen Food/Minimarket/Bakery/Kelontong/Lainnya), Jumlah Outlet
(Satu toko / Multi-outlet), Terms checkbox. Validates email format, password strength
(8+ chars, 1 uppercase, 1 number), duplicate email â "Email sudah terdaftar". Success â
email verification â onboarding.

### Login
Fields: Email, Password, "Ingat saya" checkbox. On success: JWT + httpOnly cookie + localStorage
backup, fetch profile, route to dashboard. 3 failed attempts â lock 15 min + security email.
Remember me: refresh token 30d vs 7d; access token always 1h.

### Onboarding (first-time setup)
1. Outlet Information (name, address, phone, hours, opening cash)
2. Add Initial Products (optional, skippable)
3. Payment Methods Setup (cash default, e-wallet, bank transfer)
4. Invite Staff (optional)
5. Success â "Mulai Transaksi" â POS Dashboard

---

## 4. CASHIER POS DASHBOARD

Mobile (portrait): sticky header (store + cashier name) â barcode/search input â cart list
(item, qty stepper, remove) â summary (subtotal, diskon, PPN 10%, total) â payment method
tabs (Tunai/E-wallet/Transfer) â full-width "PROSES PEMBAYARAN" button â void/reprint actions.

Desktop (landscape): left panel 60% (search + product grid/list + quick categories),
right panel 40% (cart + summary + payment + actions).

### Payment Screens
- **Cash**: total, "Jumlah diterima" input (auto-focus), calculated "Kembalian", confirm/back.
- **E-wallet**: QR code placeholder, "Menunggu pembayaran..." auto-refresh every 3s, fallback
  payment link, cancel button.
- **Bank Transfer**: bank name, account number, account name, kode unik (total + Rp XXX),
  "Menunggu transfer..." polling every 10s, copy account / cancel.
- **Success**: checkmark, invoice number, timestamp, total, receipt preview, print / new
  transaction buttons.

---

## 5. OWNER/MANAGER DASHBOARD

Header: greeting + date. KPI cards row: Penjualan (Rp + Î%), Keuntungan (Rp + Î%), Transaksi
(count + Î%), Stok Habis (count + warning icon).

Tabs:
1. **Ringkasan** — revenue-by-hour chart, top products table, alerts list (critical/warning/info),
   financial snapshot (COGS, opex, net profit)
2. **Penjualan** — sales report with date range + filters (product/category/payment method),
   paginated invoice table, export
3. **Inventory** — stock table (product, category, on-hand, reorder, status), low-stock/overstock/
   expiring alerts, actions (Reorder/Adjust/Stocktake)
4. **Keuangan** — daily P&L, period selector, revenue trend / expense breakdown / cash position
   charts, PDF/Excel export
5. **Supplier** — PO table with status filter, unpaid invoices list, Create PO / Mark as Paid
6. **Staff** — staff list with today's attendance status, clock in/out, Add Staff / View Attendance

### Sidebar Navigation (full tree)
```
ð Dashboard â Ringkasan, Laporan Harian, Alerts
ð° Penjualan â Transaksi, Invoice, Laporan Penjualan
ð¦ Inventori â Stok Barang, Kategori Produk, Reorder Produk, Stocktake, Stock Adjustment
ðª Supplier â Daftar Supplier, Purchase Order, Received Items, Outstanding Invoices
ð Keuangan â Laporan Harian, P&L Statement, Cash Position, AP Aging, Tax Report
ð¥ Staff â Daftar Karyawan, Attendance, Gaji/Payroll
âï¸ Pengaturan â Outlet Info, Metode Pembayaran, Bank Account, User Management, Sistem Settings
â Help & Support â Dokumentasi, Tutorial Video, Hubungi Support
â  Profile | Settings | Logout (footer)
```

---

## 6. MASTER ADMIN PANEL (Multi-Outlet Only)

Dashboard: Company KPIs (Total Revenue MTD, Active Outlets, Total Transactions, Avg Margin),
Outlet Performance Leaderboard (ranked by revenue with Î% and manager), Bulk Operations quick
actions (Update Prices, Company-wide Promo, Schedule Product Launch, Manage Outlets & Staff),
Recent Operations Log.

### Sidebar
```
Dashboard (Company Overview)
Outlets Management â Outlet List, Add/Edit Outlet, Outlet Settings
Bulk Operations â Product Management, Price Updates, Promo Management, Inventory Pool
User Management â All Users, Add/Edit User, Reset Password
Consolidated Reports â Company P&L, Outlet Comparison, Tax Report, Performance Analytics
Compliance & Audit â Audit Log, Compliance Report, Data Reconciliation, Export for Accounting
Settings â Company Info, Billing & Subscription, Brand Customization, Master Data Config
```

---

## 7. RESPONSIVE DESIGN BREAKPOINTS

- **Mobile (xs/sm, 320-640px)**: single column, bottom nav / hamburger menu, 44x44px touch
  targets, stacked modals.
- **Tablet (md, 768-1024px)**: two-column (collapsible sidebar + content), larger cards.
- **Desktop (lg/xl, 1024px+)**: three-column (sidebar 20% + content 60% + side panel 20%),
  sticky sidebar, multi-column grids, centered modals.

---

## 8. ACCESSIBILITY STANDARDS (WCAG 2.1 AA)

- Color contrast: text 4.5:1 min, interactive elements 3:1 min, visible focus ring (2px blue)
- Keyboard nav: logical tab order, Enter activates, Space toggles, Arrow keys for selects,
  Escape closes modals/dropdowns, no keyboard traps
- Screen readers: descriptive alt text, `<label for>` associations, aria-labels on icon buttons,
  landmark roles (`main`/`nav`/`aside`), `aria-live="polite"` for alerts
- Focus management: modal focus trap + return-to-trigger on close, dropdown focus to first option
- Text: min 14px body, 1.5 line-height, max ~80 char line length, 200% zoom without breaking

---

## 9. COMPONENT LIBRARY

- **Buttons**: primary (bg-blue-500), secondary (border-2 blue-500), danger (bg-red-500),
  disabled (opacity-50); sizes sm/base/lg
- **Inputs**: border gray-200, focus:ring-2 blue-500, required asterisk, error (red border +
  message), success (green border + check), disabled (bg-gray-100)
- **Cards**: border gray-200, padding 16/24px, white bg, shadow-sm, hover shadow increase
- **Tables**: header bg-gray-50 semibold, alternating row bg, hover bg-gray-100, sortable
  headers, pagination footer
- **Modals**: 60% opacity backdrop, centered white rounded-lg box, header+body+footer, 300ms fade
- **Alerts**: success/warning/danger/info variants with colored left border + icon, dismissible

---

## 10. DARK MODE (Future — Phase 2)

Background #111827, Surface #1F2937, Text primary #F9FAFB, Text secondary #D1D5DB,
Border #374151, Accent #60A5FA. System-preference detection + manual toggle + localStorage
persistence + 300ms transition.

---

## END OF UI/UX DESIGN SYSTEM

Built with Tailwind CSS + React + TypeScript, mobile-first, WCAG 2.1 AA compliant.

*Companion to `prd.md` (product/technical spec) and `roadmap.md` (implementation plan).*
