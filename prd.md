# GawEEE ERP System | Complete PRD & Technical Specification
**Version 1.0 | Strategic Blueprint for UMKM Retail Transformation**

---

## TABLE OF CONTENTS
1. Executive Summary
2. Business Model & Market Analysis
3. Complete Architecture
4. Database Schema (Supabase-Optimized)
5. Feature Specifications (Phase 1 & 2)
6. API Specification
7. Payment Gateway Integration
8. Security & Compliance
9. Technical Decisions & Trade-offs
10. Migration Strategy

---

## 1. EXECUTIVE SUMMARY

### 1.1 What is GawEEE?
**GawEEE** adalah SaaS ERP platform yang dirancang khusus untuk UMKM retail Indonesia:
- **Toko frozen food, minimarket, convenience store, bakery, toko kelontong**
- Solusi terintegrasi: POS â Inventory â Financial â Analytics â Multi-outlet Management
- SaaS subscription model (bukan perpetual license)
- Hybrid architecture: support single outlet & multi-outlet sejak Day 1

### 1.2 Core Value Proposition

| Aspek | Value | Business Impact |
|-------|-------|-----------------|
| **Inventory Visibility** | Real-time stok tracking per outlet | Prevent stockouts, reduce overstock |
| **POS Integration** | Cashier app yang simple tapi powerful | Faster transactions, accurate data |
| **Financial Clarity** | Daily P&L, cash position, margin tracking | Better decision-making |
| **Scalability** | From 1 outlet â 50+ outlets dengan same platform | No infrastructure investment |
| **Compliance** | Tax reporting, audit trail, invoice archiving | Reduce compliance risk |
| **Affordability** | Rp 99K-299K/month vs Rp 50M+ POS system | Accessible untuk UMKM |

### 1.3 Market Opportunity

**Current Market State:**
- ~5 million UMKM retail outlets di Indonesia
- 99% menggunakan: spreadsheet, POS lokal (tidak terintegrasi), atau manual
- Average monthly cash turnover: Rp 50M-200M per outlet
- Current pain points:
  - No visibility across outlets (if multi-outlet)
  - Inventory discrepancies (manual counting)
  - Delayed financial reporting (monthly atau tidak sama sekali)
  - No customer data, no trend analysis

**GawEEE TAM:**
- Addressable: ~500K profitable UMKM retail (yang sanggup Rp 99K/bulan)
- At 10% penetration: 50K customers
- At Rp 150K/month average: Rp 7.5B annual revenue
- At 70% gross margin: Rp 5.25B gross profit

### 1.4 Business Model & Pricing

**Revenue Streams:**

```
Tier 1: Starter (Single Outlet)
ââ Price: Rp 99,000/month
ââ Outlets: 1
ââ Users: 3 (2 cashier, 1 owner)
ââ Features: POS, Basic Inventory, Daily Report
ââ Payment: E-wallet, Bank transfer (via payment provider)

Tier 2: Professional (Multi-Outlet Ready)
ââ Price: Rp 199,000/month + Rp 49K per additional outlet
ââ Outlets: Up to 5
ââ Users: Unlimited (Master Admin + outlet managers)
ââ Features: All Tier 1 + Master Admin Panel + Bulk Operations
ââ Payment: Same + virtual account

Tier 3: Enterprise (Future - Phase 3)
ââ Price: Custom (Rp 499K+)
ââ Outlets: Unlimited
ââ Users: Unlimited
ââ Features: Custom integrations, API access, Priority support
ââ Payment: Invoice + bank transfer

Revenue Model:
â Subscription recurring (majority)
â Setup fee (Rp 499K) - one-time onboarding
â Transaction fee (OPTIONAL - future, 0.5% per transaction)
â Marketplace integration fee (Phase 3)
```

---

## 2. COMPLETE ARCHITECTURE

### 2.1 System Architecture Diagram

```
ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â                        GawEEE Platform Architecture                   â
ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â                                                                        â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ   â
â  â                    CLIENT LAYER (Frontend)                      â   â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤   â
â  â                                                                 â   â
â  â  ââââââââââââââââ  ââââââââââââââââ  ââââââââââââââââ          â   â
â  â  â   Landing    â  â   Cashier    â  â  Owner/     â          â   â
â  â  â   Page       â  â   POS        â  â Manager     â          â   â
â  â  â (Marketing)  â  â (Mobile/Tab) â  â Dashboard   â          â   â
â  â  ââââââââââââââââ  ââââââââââââââââ  ââââââââââââââââ          â   â
â  â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ  â   â
â  â  â          Master Admin Panel (Multi-outlet)             â  â   â
â  â  â  - Outlet performance dashboard                         â  â   â
â  â  â  - Bulk product/price management                        â  â   â
â  â  â  - User & role management                               â  â   â
â  â  â  - Consolidated reporting                               â  â   â
â  â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ  â   â
â  â                                                                 â   â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ   â
â                                 â HTTPS (REST + WebSocket)            â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ   â
â  â                  API GATEWAY & MIDDLEWARE                       â   â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤   â
â  â  - Request validation & rate limiting                          â   â
â  â  - JWT authentication & authorization                          â   â
â  â  - Request logging & monitoring                                â   â
â  â  - CORS handling                                               â   â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ   â
â                                 â                                      â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ   â
â  â              NEXT.JS BACKEND (API Routes)                       â   â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤   â
â  â                                                                 â   â
â  â  Core Business Logic:                                           â   â
â  â  ââ Authentication Service                                      â   â
â  â  â  ââ JWT token generation, validation, refresh               â   â
â  â  ââ Transaction Service                                        â   â
â  â  â  ââ Invoice creation, void, reconciliation                  â   â
â  â  ââ Inventory Service                                          â   â
â  â  â  ââ Real-time sync, low-stock alerts, reorder logic         â   â
â  â  ââ Payment Service                                            â   â
â  â  â  ââ Gateway integration, webhook handling, settlement       â   â
â  â  ââ Financial Service                                          â   â
â  â  â  ââ P&L calculation, cash position, reporting               â   â
â  â  ââ Supplier Service                                           â   â
â  â  â  ââ PO management, invoice reconciliation                   â   â
â  â  ââ Admin Service (Multi-outlet)                               â   â
â  â  â  ââ Bulk operations, audit logging, user management         â   â
â  â  ââ Notification Service                                       â   â
â  â  â  ââ Email, SMS, in-app alerts                               â   â
â  â  ââ Export Service                                             â   â
â  â     ââ PDF reports, Excel export, API webhooks                 â   â
â  â                                                                 â   â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ   â
â                                 â SQL (pg driver)                      â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ   â
â  â         SUPABASE (PostgreSQL + Auth + Storage)                 â   â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤   â
â  â                                                                 â   â
â  â  Database Layer:                                                â   â
â  â  ââ Core Tables (100+ tables, normalized)                      â   â
â  â  ââ Views & Materialized Views (reporting)                     â   â
â  â  ââ Stored Procedures (complex calculations)                   â   â
â  â  ââ Full-text search indexes                                   â   â
â  â                                                                 â   â
â  â  Auth & Access Control:                                         â   â
â  â  ââ Supabase Auth (JWT + OAuth)                                â   â
â  â  ââ Row-Level Security (RLS) policies                          â   â
â  â  â  ââ Tenant isolation (company_id, outlet_id)                â   â
â  â  ââ Role-based access control (RBAC)                           â   â
â  â     ââ Cashier, Manager, Admin, SuperAdmin                     â   â
â  â                                                                 â   â
â  â  Real-time Subscriptions:                                       â   â
â  â  ââ Inventory changes (low stock alerts)                       â   â
â  â  ââ Transaction updates (dashboard sync)                       â   â
â  â  ââ Payment status (settlement tracking)                       â   â
â  â                                                                 â   â
â  â  Storage:                                                       â   â
â  â  ââ Receipt PDFs                                                â   â
â  â  ââ Supplier documents                                          â   â
â  â  ââ Audit logs (long-term retention)                            â   â
â  â                                                                 â   â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ   â
â                                                                        â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ   â
â  â         EXTERNAL INTEGRATIONS (Third-party APIs)                â   â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ¤   â
â  â                                                                 â   â
â  â  Payment Gateways:                                              â   â
â  â  ââ Doku Pay (e-wallet aggregator)                              â   â
â  â  â  ââ OVO, Dana, Gopay, LinkAja integration                   â   â
â  â  ââ GCash (Southeast Asia e-wallet)                             â   â
â  â  ââ Bank APIs (Virtual Account)                                 â   â
â  â  â  ââ BCA, Mandiri, BRI transfers                              â   â
â  â  ââ Card processing (future)                                    â   â
â  â                                                                 â   â
â  â  Communication:                                                 â   â
â  â  ââ SendGrid (Email for receipts, invoices)                     â   â
â  â  ââ Twilio/Local SMS (SMS alerts)                               â   â
â  â                                                                 â   â
â  â  Compliance & Monitoring:                                       â   â
â  â  ââ Sentry (Error tracking)                                     â   â
â  â  ââ LogRocket (Session replay)                                  â   â
â  â  ââ DataDog (Performance monitoring)                            â   â
â  â                                                                 â   â
â  ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ   â
â                                                                        â
ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
```

### 2.2 Data Flow: Complete Transaction Journey

```
CASHIER TRANSACTION FLOW:
âââââââââââââââââââââââââ

1. CASHIER POS APP (Client)
   ââ Scan item â Add to cart (local state)
   ââ Apply discount
   ââ Select payment method
   ââ Click "Proceed to Payment"
         â
2. FRONTEND VALIDATION
   ââ Validate cart (items, qty, prices)
   ââ Check inventory sync (ensure items still available)
   ââ If OK, send to backend
         â
3. BACKEND - INVOICE SERVICE
   ââ Verify user authorization (is cashier?)
   ââ Lock inventory (pessimistic lock - 10 second window)
   ââ Create invoice record
   ââ Create invoice_items records
   ââ Update inventory_ledger (deduct stock)
   ââ Create revenue journal entry
   ââ Unlock inventory
         â
4. PAYMENT ROUTING (by payment method)
   â
   ââ CASH: 
   â  ââ Record payment_transaction (method=cash, status=completed)
   â  ââ Complete invoice (status=paid)
   â
   ââ E-WALLET (OVO, Dana, etc):
   â  ââ Call Doku Pay API â get payment URL/QR code
   â  ââ Return QR to cashier display
   â  ââ Record payment_transaction (status=pending)
   â  ââ Wait for webhook from Doku Pay
   â       â [Webhook on payment success]
   â       ââ Update payment_transaction (status=settled)
   â       ââ Update invoice (status=paid)
   â       ââ Send receipt to customer (email/SMS)
   â
   ââ BANK TRANSFER (Virtual Account):
   â  ââ Generate unique virtual account number
   â  ââ Record payment_transaction (status=pending_va)
   â  ââ Display VA to cashier, customer
   â  ââ Poll bank API every 10s (or webhook if supported)
   â       â [Customer transfers to VA]
   â       ââ Bank webhook fires â payment received
   â       ââ Update payment_transaction (status=settled)
   â       ââ Update invoice (status=paid)
   â       ââ Sweep VA balance â merchant settlement account
   â       ââ Record as cash in next cash reconciliation
   â
   ââ [All paths converge]
         â
5. INVENTORY SYNC (Real-time)
   ââ Publish to Supabase Real-time Channel
   ââ Cashier app receives update
   ââ Dashboard + inventory view sync automatically
   ââ Alerts fire if stock falls below reorder_level
         â
6. FINANCIAL SYNC (Real-time)
   ââ Publish revenue update
   ââ Dashboard recalculates daily totals
   ââ Update cash position
   ââ Update margin calculation
         â
7. AUDIT & COMPLIANCE
   ââ All actions logged in audit_log table
   ââ Invoice immutable (no editing after paid)
   ââ Receipt generated & stored in storage
   ââ Tax summary updated for tax authority
         â
8. COMPLETION
   ââ Print receipt (if thermal printer available)
   ââ Send receipt to customer email
   ââ Customer sees payment confirmation


MULTI-OUTLET MASTER ADMIN FLOW (Bulk Price Update):
âââââââââââââââââââââââââââââââââââââââââââââââââââââ

1. MASTER ADMIN APP
   ââ Navigate to "Bulk Operations"
   ââ Select: "Update Product Prices"
   ââ Input: +5% across all products
   ââ Select outlets: "All" or specific list
   ââ Click "Schedule Update for Tomorrow 6 AM"
         â
2. BACKEND - BULK OPERATION SERVICE
   ââ Verify master admin authorization
   ââ Create master_admin_actions record (status=scheduled)
   ââ Schedule async job (via cron/queue)
   ââ Send email to all affected outlet managers
         â
3. SCHEDULED JOB EXECUTION (6 AM next day)
   ââ Retrieve all products
   ââ For each product:
   â  ââ Calculate new price (old Ã 1.05)
   â  ââ Create journal entry (inventory revaluation)
   â  ââ Update selling_price in products table
   ââ For each affected outlet:
   â  ââ Publish update via Real-time
   â  ââ Update outlet_settings (price_effective_date)
   â  ââ Notify POS app to refresh cache
   ââ Update master_admin_actions (status=applied)
   ââ Send completion report to master admin
         â
4. REAL-TIME SYNC TO CASHIER APPS
   ââ Cashier app receives price update
   ââ Refresh local product cache
   ââ Next scan uses new price
   ââ Log in POS audit trail


PAYMENT SETTLEMENT & RECONCILIATION FLOW:
âââââââââââââââââââââââââââââââââââââââââ

Daily (Automatic):
  ââ Doku Pay settlement (e-wallet)
  â  ââ Aggregate all transactions for that outlet
  â  ââ Deduct Doku fee (typically 1-2%)
  â  ââ Queue transfer to merchant account
  â
  ââ Bank VA settlement
  â  ââ Sweep virtual account balance
  â  ââ Deduct bank fee (typically 0.5%)
  â  ââ Transfer to merchant account (T+1)
  â
  ââ Update cash_flow forecast
     ââ Outlet manager sees "Available for Withdrawal: Rp XYZ"

Weekly (Manual Reconciliation):
  ââ Outlet manager runs "Cash Reconciliation" report
  ââ Compare:
  â  ââ POS recorded transactions
  â  ââ Payment provider settlements
  â  ââ Bank account balance
  ââ Investigate variances
  ââ Mark as "Verified" in audit trail

Monthly (Financial Close):
  ââ Consolidated payment reconciliation
  ââ Tax calculation (PPN, PPh)
  ââ Export to accounting/tax authority
```

### 2.3 Multi-Tenancy & Security Model

```
MULTI-TENANCY ARCHITECTURE (Row-Level Security - RLS):
âââââââââââââââââââââââââââââââââââââââââââââââââââââ

Single Schema, Multiple Tenants:

users table:
ââ id (UUID)
ââ company_id (FOREIGN KEY â companies)
ââ outlet_id (FOREIGN KEY â outlets, nullable for multi-outlet view)
ââ email
ââ role (MASTER_ADMIN, OUTLET_MANAGER, CASHIER, STAFF)
ââ status (active, inactive, suspended)

companies table:
ââ id (UUID)
ââ name, tier, status
ââ subscription_id (Stripe/internal)
ââ billing_email, billing_address
ââ created_at, expires_at

outlets table:
ââ id (UUID)
ââ company_id
ââ name, address, phone
ââ tax_id (NPWP for compliance)
ââ settings (JSON: tax_rate, discount_policy, etc)

RLS POLICIES:
ââââââââââââ

Policy 1: Cashier Access
ââ Role: CASHIER
ââ Can SELECT/UPDATE: invoices, inventory WHERE outlet_id = auth.user.outlet_id
ââ Cannot SELECT: other outlets, company financial data
ââ Cannot DELETE: anything (immutability)

Policy 2: Outlet Manager Access
ââ Role: OUTLET_MANAGER
ââ Can: All operations for assigned outlet_id
ââ Cannot: See other outlets, cannot change company settings
ââ Can: View reports, manage staff

Policy 3: Master Admin Access (Multi-outlet only)
ââ Role: MASTER_ADMIN
ââ Can: All operations across all outlets in company_id
ââ Can: Bulk operations, user management, company settings
ââ Cannot: Modify subscription (requires portal access)
ââ Cannot: Access other companies

Policy 4: Super Admin Access (GawEEE internal)
ââ Role: SUPER_ADMIN (GawEEE staff)
ââ Can: Audit all data, suspend accounts, migrate data
ââ Cannot: Modify transaction data (compliance)
ââ Logged with double-authentication


ENCRYPTION STRATEGY:
âââââââââââââââââââ

At-Rest Encryption:
ââ Supabase handles automatically (AES-256)
ââ Sensitive fields encrypted:
â  ââ Supplier bank account numbers
â  ââ Payment gateway credentials
â  ââ Customer email (for marketing consent)
ââ PII retention policy: 2 years after account deletion

In-Transit Encryption:
ââ All APIs: HTTPS/TLS 1.3 required
ââ WebSocket subscriptions: WSS (secure WebSocket)
ââ Payment gateway calls: TLS 1.2+ minimum

API Key Management:
ââ Payment gateway keys: Stored in Supabase secrets
ââ Rotated every 90 days
ââ Audit log for all key usage
ââ Separate credentials per environment (dev/staging/prod)


AUDIT & COMPLIANCE:
ââââââââââââââââââ

audit_log table:
ââ id, timestamp, user_id
ââ action_type (CREATE, UPDATE, DELETE, VOID, REPORT_EXPORT)
ââ entity_type (invoice, product, user, settings)
ââ entity_id
ââ old_value, new_value (JSON)
ââ ip_address, user_agent
ââ reason (for sensitive operations)

Requirements:
ââ All transactions immutable after 24 hours
ââ Void operations require manager approval
ââ Invoice export requires audit trail entry
ââ Monthly audit summary for compliance
ââ 7-year retention for tax authority
```

---

## 3. DETAILED DATABASE SCHEMA

### 3.1 Core Entity Tables

```sql
-- COMPANIES (Tenant Root)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  tier VARCHAR(50) NOT NULL, -- 'starter', 'professional', 'enterprise'
  subscription_status VARCHAR(50) NOT NULL, -- 'active', 'trial', 'suspended'
  subscription_start_date TIMESTAMP NOT NULL DEFAULT NOW(),
  subscription_end_date TIMESTAMP,
  billing_email VARCHAR(255) NOT NULL,
  billing_phone VARCHAR(20),
  industry VARCHAR(100), -- 'frozen_food', 'bakery', 'minimarket', etc
  country_code VARCHAR(2) DEFAULT 'ID',
  currency VARCHAR(3) DEFAULT 'IDR',
  tax_id VARCHAR(50), -- NPWP
  tax_rate DECIMAL(5,2) DEFAULT 10.0, -- PPN %
  logo_url TEXT,
  brand_color VARCHAR(7) DEFAULT '#1F2937', -- Tailwind gray-900
  brand_secondary_color VARCHAR(7) DEFAULT '#3B82F6',
  timezone VARCHAR(50) DEFAULT 'Asia/Jakarta',
  settings JSONB DEFAULT '{}', -- flexible config
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP -- soft delete
);

-- OUTLETS (Physical Locations)
CREATE TABLE outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(100),
  postal_code VARCHAR(10),
  phone VARCHAR(20),
  manager_id UUID, -- reference to users
  bank_account_name VARCHAR(255),
  bank_account_number VARCHAR(50), -- encrypted
  bank_name VARCHAR(100),
  tax_id VARCHAR(50), -- NPWP outlet-specific
  business_hours JSONB, -- {mon: {open: "06:00", close: "22:00"}, ...}
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'closed'
  opening_cash DECIMAL(15,2) DEFAULT 0, -- standard opening amount
  target_daily_revenue DECIMAL(15,2), -- forecast/target
  settings JSONB DEFAULT '{}', -- outlet-specific overrides
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- USERS (Access Control)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  outlet_id UUID REFERENCES outlets(id), -- NULL for multi-outlet access
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL, -- 'master_admin', 'outlet_manager', 'cashier', 'staff'
  permissions JSONB DEFAULT '[]', -- granular permissions (future)
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'suspended'
  last_login_at TIMESTAMP,
  password_changed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_outlet_id ON users(outlet_id);
```

### 3.2 Inventory & Product Tables

```sql
-- PRODUCT CATEGORIES
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PRODUCTS (Master Product List - Company Level)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  category_id UUID REFERENCES product_categories(id),
  sku VARCHAR(100) NOT NULL,
  barcode VARCHAR(100) UNIQUE, -- EAN/UPC
  name VARCHAR(255) NOT NULL,
  description TEXT,
  brand VARCHAR(100),
  manufacturer VARCHAR(100),
  purchase_price DECIMAL(15,2) NOT NULL, -- cost price
  selling_price DECIMAL(15,2) NOT NULL,
  unit_type VARCHAR(50) NOT NULL, -- 'pcs', 'box', 'kg', 'liter', etc
  conversion_factor INT DEFAULT 1, -- e.g., 1 box = 10 pcs
  base_unit VARCHAR(50), -- smallest unit for tracking
  markup_percentage DECIMAL(5,2), -- selling_price calculated from this
  tax_rate DECIMAL(5,2), -- product-specific tax (if different from default)
  reorder_level INT NOT NULL, -- low stock threshold
  reorder_quantity INT NOT NULL, -- standard PO qty
  shelf_life_days INT, -- for expiry tracking
  supplier_id UUID REFERENCES suppliers(id),
  is_active BOOLEAN DEFAULT TRUE,
  image_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- INVENTORY (Outlet-Level Stock)
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_on_hand INT NOT NULL DEFAULT 0,
  quantity_reserved INT DEFAULT 0, -- reserved for pending orders
  quantity_available INT GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  cost_value DECIMAL(15,2) GENERATED ALWAYS AS (quantity_on_hand * products.purchase_price) STORED,
  retail_value DECIMAL(15,2) GENERATED ALWAYS AS (quantity_on_hand * products.selling_price) STORED,
  last_count_date TIMESTAMP, -- last physical stocktake
  reorder_level INT, -- outlet-specific override
  alert_status VARCHAR(50) DEFAULT 'normal', -- 'low_stock', 'overstock', 'expired'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(outlet_id, product_id)
);

-- INVENTORY LEDGER (Audit Trail for Stock Movements)
CREATE TABLE inventory_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  product_id UUID NOT NULL REFERENCES products(id),
  movement_type VARCHAR(50) NOT NULL, -- 'purchase', 'sales', 'adjustment', 'transfer', 'return', 'write_off'
  quantity_change INT NOT NULL,
  unit_cost DECIMAL(15,2), -- for cost tracking
  reference_type VARCHAR(50), -- 'purchase_order', 'invoice', 'stocktake', 'manual'
  reference_id UUID, -- links to PO ID, invoice ID, etc
  recorded_by UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  batch_number VARCHAR(100), -- for traceability
  expiry_date DATE, -- if tracking expiry
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- STOCKTAKE (Physical Inventory Counts)
CREATE TABLE stocktakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  scheduled_date DATE NOT NULL,
  actual_start_date TIMESTAMP,
  actual_end_date TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'in_progress', 'completed', 'approved'
  variance_tolerance_percent DECIMAL(5,2) DEFAULT 2.0,
  total_variance_value DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- STOCKTAKE DETAILS (Individual Product Counts)
CREATE TABLE stocktake_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stocktake_id UUID NOT NULL REFERENCES stocktakes(id),
  product_id UUID NOT NULL REFERENCES products(id),
  expected_quantity INT NOT NULL,
  counted_quantity INT NOT NULL,
  variance INT GENERATED ALWAYS AS (counted_quantity - expected_quantity) STORED,
  variance_value DECIMAL(15,2) GENERATED ALWAYS AS (variance * products.purchase_price) STORED,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 3.3 Sales & Invoicing Tables

```sql
-- INVOICES (Core Sales Transaction)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  invoice_number VARCHAR(50) NOT NULL, -- e.g., "INV-2024-001234"
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  cashier_id UUID NOT NULL REFERENCES users(id),
  subtotal DECIMAL(15,2) NOT NULL, -- sum of line items
  discount_amount DECIMAL(15,2) DEFAULT 0,
  discount_type VARCHAR(50), -- 'fixed', 'percentage'
  discount_reason TEXT,
  discount_approved_by UUID REFERENCES users(id), -- manager approval for discounts
  tax_amount DECIMAL(15,2) NOT NULL,
  total DECIMAL(15,2) NOT NULL, -- subtotal - discount + tax
  payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'partial', 'paid'
  order_status VARCHAR(50) DEFAULT 'completed', -- 'draft', 'completed', 'voided'
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  voided_at TIMESTAMP,
  voided_by UUID REFERENCES users(id),
  void_reason TEXT
);

CREATE INDEX idx_invoices_outlet_id_created_at ON invoices(outlet_id, created_at);
CREATE INDEX idx_invoices_payment_status ON invoices(payment_status);

-- INVOICE ITEMS (Line Items)
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL, -- price at time of sale (snapshot)
  item_discount DECIMAL(15,2) DEFAULT 0, -- line-item level discount
  subtotal DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price - item_discount) STORED,
  cost_of_goods_sold DECIMAL(15,2), -- for margin calc
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PAYMENT TRANSACTIONS
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  payment_method VARCHAR(50) NOT NULL, -- 'cash', 'e_wallet', 'bank_transfer', 'card'
  payment_provider VARCHAR(100), -- 'doku_pay', 'ovo', 'bank_bca', etc
  amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'pending', 'processing', 'settled', 'failed', 'refunded'
  payment_gateway_reference_id VARCHAR(255), -- from payment provider
  payment_date TIMESTAMP,
  settlement_date TIMESTAMP, -- when funds actually received
  settlement_amount DECIMAL(15,2), -- amount after fees
  gateway_fee DECIMAL(15,2), -- platform/provider fee
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}' -- gateway-specific data
);

-- PAYMENT GATEWAY RECONCILIATION
CREATE TABLE payment_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  reconciliation_date DATE NOT NULL,
  payment_provider VARCHAR(100),
  method VARCHAR(50), -- 'e_wallet', 'bank_va', 'card'
  gateway_total_amount DECIMAL(15,2), -- from provider
  gaweee_recorded_amount DECIMAL(15,2), -- from our system
  variance DECIMAL(15,2) GENERATED ALWAYS AS (gateway_total_amount - gaweee_recorded_amount) STORED,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'matched', 'variance_noted'
  variance_explanation TEXT,
  reconciled_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 3.4 Purchasing Tables

```sql
-- SUPPLIERS
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  payment_terms INT, -- days (e.g., 30 days)
  bank_account_name VARCHAR(255),
  bank_account_number VARCHAR(50), -- encrypted
  bank_name VARCHAR(100),
  tax_id VARCHAR(50), -- NPWP supplier
  status VARCHAR(50) DEFAULT 'active',
  rating DECIMAL(3,2), -- 1-5 stars
  is_preferred BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- PURCHASE ORDERS
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  po_number VARCHAR(50) NOT NULL, -- e.g., "PO-2024-00567"
  order_date DATE NOT NULL DEFAULT TODAY(),
  requested_delivery_date DATE,
  actual_delivery_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'ordered', 'partial_received', 'received', 'cancelled'
  subtotal DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  total DECIMAL(15,2),
  created_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PO ITEMS
CREATE TABLE po_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_ordered INT NOT NULL,
  quantity_received INT DEFAULT 0,
  quantity_remaining INT GENERATED ALWAYS AS (quantity_ordered - quantity_received) STORED,
  unit_cost DECIMAL(15,2) NOT NULL,
  subtotal DECIMAL(15,2) GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED,
  line_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PURCHASE INVOICES (From Supplier)
CREATE TABLE purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  invoice_number VARCHAR(50) NOT NULL, -- supplier invoice
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  total DECIMAL(15,2),
  payment_status VARCHAR(50) DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid'
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PURCHASE PAYMENTS
CREATE TABLE purchase_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id UUID NOT NULL REFERENCES purchase_invoices(id),
  payment_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_method VARCHAR(50), -- 'cash', 'bank_transfer', 'check'
  reference_number VARCHAR(100), -- bank transfer reference
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 3.5 Financial & Accounting Tables

```sql
-- CHART OF ACCOUNTS
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  account_code VARCHAR(20) NOT NULL, -- e.g., "1000", "2000", "3000"
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL, -- 'asset', 'liability', 'equity', 'income', 'expense'
  parent_account_id UUID REFERENCES chart_of_accounts(id),
  is_header BOOLEAN DEFAULT FALSE, -- is this a summary account?
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(outlet_id, account_code)
);

-- JOURNAL ENTRIES (Double-Entry Bookkeeping)
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  entry_date DATE NOT NULL,
  entry_number VARCHAR(50), -- e.g., "JE-2024-0001"
  description VARCHAR(255) NOT NULL,
  source_type VARCHAR(50), -- 'manual', 'sales', 'purchase', 'payment', 'adjustment'
  source_id UUID, -- links to invoice_id, po_id, etc
  created_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'posted', 'reversed'
  posted_date TIMESTAMP,
  reversed_date TIMESTAMP,
  reversal_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- JOURNAL ENTRY DETAILS (Line Items with Dr/Cr)
CREATE TABLE journal_entry_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id),
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  debit DECIMAL(15,2) DEFAULT 0,
  credit DECIMAL(15,2) DEFAULT 0,
  description TEXT,
  reference_id UUID -- links to invoice_item, po_item, etc
);

-- DAILY FINANCIAL SNAPSHOT
CREATE TABLE daily_financial_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  summary_date DATE NOT NULL,
  total_sales DECIMAL(15,2) NOT NULL,
  total_discount DECIMAL(15,2) DEFAULT 0,
  total_tax_collected DECIMAL(15,2),
  total_cash_received DECIMAL(15,2),
  total_e_wallet_received DECIMAL(15,2),
  total_bank_transfer_pending DECIMAL(15,2),
  total_invoices INT,
  total_items_sold INT,
  unique_customers INT,
  cash_on_hand_opening DECIMAL(15,2),
  cash_on_hand_closing DECIMAL(15,2),
  cash_variance DECIMAL(15,2),
  cost_of_goods_sold DECIMAL(15,2),
  gross_profit DECIMAL(15,2),
  gross_profit_margin DECIMAL(5,2),
  operating_expenses DECIMAL(15,2),
  net_profit DECIMAL(15,2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(outlet_id, summary_date)
);

-- ACCOUNTS RECEIVABLE (Customer Outstanding)
CREATE TABLE accounts_receivable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  total_invoices DECIMAL(15,2),
  total_paid DECIMAL(15,2),
  outstanding_amount DECIMAL(15,2) GENERATED ALWAYS AS (total_invoices - total_paid) STORED,
  last_transaction_date DATE,
  days_outstanding INT,
  aging_bucket VARCHAR(50), -- 'current', '30', '60', '90', '120+'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ACCOUNTS PAYABLE (Supplier Outstanding)
CREATE TABLE accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  total_invoices DECIMAL(15,2),
  total_paid DECIMAL(15,2),
  outstanding_amount DECIMAL(15,2) GENERATED ALWAYS AS (total_invoices - total_paid) STORED,
  due_date DATE,
  days_overdue INT,
  aging_bucket VARCHAR(50), -- 'current', '30', '60', '90', '120+'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(outlet_id, supplier_id)
);
```

### 3.6 HR & Operations Tables

```sql
-- STAFF MEMBERS
CREATE TABLE staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  position VARCHAR(100) NOT NULL, -- 'cashier', 'staff', 'supervisor'
  hire_date DATE NOT NULL,
  salary_amount DECIMAL(15,2), -- monthly salary
  salary_frequency VARCHAR(50), -- 'monthly', 'daily'
  bank_account_name VARCHAR(255),
  bank_account_number VARCHAR(50),
  tax_id VARCHAR(50), -- NPWP personal
  status VARCHAR(50) DEFAULT 'active',
  employment_status VARCHAR(50), -- 'permanent', 'contract', 'casual'
  contract_end_date DATE,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- ATTENDANCE
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff_members(id),
  attendance_date DATE NOT NULL,
  clock_in_time TIMESTAMP,
  clock_out_time TIMESTAMP,
  status VARCHAR(50) NOT NULL, -- 'present', 'absent', 'late', 'early_leave', 'half_day'
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(staff_id, attendance_date)
);

-- CASHIER SHIFTS & CASH RECONCILIATION
CREATE TABLE cashier_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  staff_id UUID REFERENCES staff_members(id),
  shift_date DATE NOT NULL,
  shift_start_time TIMESTAMP,
  shift_end_time TIMESTAMP,
  opening_cash DECIMAL(15,2) NOT NULL,
  closing_cash DECIMAL(15,2) NOT NULL,
  total_transactions DECIMAL(15,2),
  expected_closing_cash DECIMAL(15,2) GENERATED ALWAYS AS (opening_cash + total_transactions) STORED,
  cash_variance DECIMAL(15,2) GENERATED ALWAYS AS (closing_cash - expected_closing_cash) STORED,
  variance_percentage DECIMAL(5,2),
  reconciled BOOLEAN DEFAULT FALSE,
  reconciled_by UUID REFERENCES users(id),
  reconciliation_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 3.7 Audit & Compliance Tables

```sql
-- AUDIT LOG
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  outlet_id UUID REFERENCES outlets(id),
  action_type VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'VOID', 'EXPORT'
  entity_type VARCHAR(50) NOT NULL, -- 'invoice', 'product', 'user', 'settings'
  entity_id UUID NOT NULL,
  old_values JSONB, -- what changed
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  reason_for_action TEXT,
  status VARCHAR(50), -- 'success', 'failed'
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id_created_at ON audit_log(user_id, created_at);
CREATE INDEX idx_audit_log_entity_type_entity_id ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_company_id ON audit_log(company_id);

-- SYSTEM ALERTS (Low Stock, Pending Payments, etc)
CREATE TABLE system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  alert_type VARCHAR(50) NOT NULL, -- 'low_stock', 'overstock', 'payment_pending', 'cash_variance', 'payment_failed'
  severity VARCHAR(50) DEFAULT 'info', -- 'info', 'warning', 'critical'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  reference_entity_type VARCHAR(50), -- 'product', 'invoice', 'payment'
  reference_entity_id UUID,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- BULK ADMIN OPERATIONS (Multi-outlet)
CREATE TABLE bulk_admin_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  admin_id UUID NOT NULL REFERENCES users(id),
  operation_type VARCHAR(50) NOT NULL, -- 'price_update', 'product_add', 'promo_creation'
  outlets_affected JSONB NOT NULL, -- array of outlet_ids or 'all'
  operation_description TEXT,
  parameters JSONB, -- operation-specific params
  scheduled_for TIMESTAMP,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'scheduled', 'executing', 'completed', 'failed', 'rolled_back'
  execution_start_time TIMESTAMP,
  execution_end_time TIMESTAMP,
  success_count INT,
  failed_count INT,
  error_log JSONB,
  rollback_available BOOLEAN DEFAULT TRUE,
  rolled_back_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 3.8 Database Views for Reporting

```sql
-- Daily Sales Report View
CREATE VIEW v_daily_sales_summary AS
SELECT
  i.outlet_id,
  DATE(i.created_at) AS sale_date,
  COUNT(DISTINCT i.id) AS transaction_count,
  COUNT(DISTINCT i.customer_phone) AS unique_customers,
  SUM(ii.quantity) AS items_sold,
  SUM(i.subtotal) AS sales_before_discount,
  SUM(i.discount_amount) AS total_discounts,
  SUM(i.tax_amount) AS tax_collected,
  SUM(i.total) AS total_sales,
  SUM(ii.cost_of_goods_sold) AS cogs,
  (SUM(i.total) - SUM(ii.cost_of_goods_sold)) AS gross_profit,
  ROUND(100 * (SUM(i.total) - SUM(ii.cost_of_goods_sold)) / SUM(i.total), 2) AS gross_margin_percent
FROM invoices i
LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
WHERE i.order_status != 'voided'
GROUP BY i.outlet_id, DATE(i.created_at);

-- Inventory Valuation View
CREATE VIEW v_inventory_valuation AS
SELECT
  inv.outlet_id,
  inv.product_id,
  p.name,
  p.sku,
  inv.quantity_on_hand,
  inv.quantity_reserved,
  inv.quantity_available,
  p.purchase_price,
  p.selling_price,
  (inv.quantity_on_hand * p.purchase_price) AS cost_value,
  (inv.quantity_on_hand * p.selling_price) AS retail_value,
  (inv.quantity_on_hand * (p.selling_price - p.purchase_price)) AS potential_profit
FROM inventory inv
JOIN products p ON inv.product_id = p.id
WHERE inv.quantity_on_hand > 0;

-- Accounts Payable Aging
CREATE VIEW v_ap_aging AS
SELECT
  ap.outlet_id,
  ap.supplier_id,
  s.name AS supplier_name,
  ap.outstanding_amount,
  CASE
    WHEN ap.days_overdue <= 0 THEN 'Current'
    WHEN ap.days_overdue <= 30 THEN '1-30 days'
    WHEN ap.days_overdue <= 60 THEN '31-60 days'
    WHEN ap.days_overdue <= 90 THEN '61-90 days'
    ELSE '90+ days'
  END AS aging_bucket,
  ap.due_date
FROM accounts_payable ap
JOIN suppliers s ON ap.supplier_id = s.id
WHERE ap.outstanding_amount > 0;

-- Low Stock Alert View
CREATE VIEW v_low_stock_alerts AS
SELECT
  inv.outlet_id,
  inv.product_id,
  p.name,
  p.sku,
  inv.quantity_on_hand,
  p.reorder_level,
  p.reorder_quantity,
  (p.reorder_level - inv.quantity_on_hand) AS shortage_qty,
  inv.alert_status
FROM inventory inv
JOIN products p ON inv.product_id = p.id
WHERE inv.quantity_available <= p.reorder_level
ORDER BY shortage_qty DESC;
```

---

## 4. API SPECIFICATION (Next.js API Routes)

### 4.1 Authentication Endpoints

```
BASE_URL: https://api.gaweee.com/api

POST /auth/register
  Description: Register new company account
  Body: {
    company_name: string,
    email: string,
    password: string,
    tier: 'starter' | 'professional',
    industry: string,
    country_code: string
  }
  Response: {
    company_id: UUID,
    user_id: UUID,
    access_token: JWT,
    refresh_token: string,
    expires_in: 3600
  }
  Errors: 400 (validation), 409 (email exists), 500 (server)

POST /auth/login
  Description: Login with email/password
  Body: {
    email: string,
    password: string
  }
  Response: {
    access_token: JWT,
    refresh_token: string,
    user: { id, email, role, company_id, outlet_id },
    expires_in: 3600
  }
  Errors: 401 (invalid credentials), 403 (account suspended)

POST /auth/refresh
  Description: Refresh expired access token
  Body: { refresh_token: string }
  Response: { access_token: JWT, expires_in: 3600 }
  Errors: 401 (invalid refresh token)

POST /auth/logout
  Description: Revoke tokens
  Headers: Authorization: Bearer {access_token}
  Response: { status: 'logged_out' }

POST /auth/password-reset
  Description: Request password reset email
  Body: { email: string }
  Response: { status: 'email_sent' }

POST /auth/password-reset-confirm
  Description: Confirm password reset with token
  Body: { token: string, new_password: string }
  Response: { status: 'password_updated' }

GET /auth/me
  Description: Get current user profile
  Headers: Authorization: Bearer {access_token}
  Response: {
    user: { id, email, role, company_id, outlet_id },
    company: { id, name, tier },
    outlet: { id, name, address } (if applicable)
  }

POST /auth/verify-email
  Description: Verify email address
  Body: { token: string }
  Response: { status: 'email_verified' }
```

### 4.2 Product & Inventory Endpoints

```
GET /products
  Description: List all products (pagination)
  Query: {
    page: number (default: 1),
    limit: number (default: 50),
    category_id?: UUID,
    search?: string,
    status?: 'active' | 'inactive'
  }
  Response: {
    data: Product[],
    pagination: { page, limit, total, pages }
  }

GET /products/:id
  Description: Get product detail with current stock
  Response: {
    product: Product,
    inventory_by_outlet: [{ outlet_id, outlet_name, quantity }],
    purchase_history: [...], (last 5 purchases)
    sales_history: {...}, (last 30 days analytics)
  }

POST /products
  Description: Create new product (owner/admin only)
  Body: {
    sku: string,
    name: string,
    category_id: UUID,
    purchase_price: decimal,
    selling_price: decimal,
    unit_type: string,
    reorder_level: integer,
    reorder_quantity: integer,
    supplier_id?: UUID
  }
  Response: { product: Product, created_at: timestamp }
  Auth: Requires OUTLET_MANAGER or MASTER_ADMIN

PUT /products/:id
  Description: Update product (manager+ only)
  Body: { [fields to update] }
  Response: { product: Product, updated_at: timestamp }

DELETE /products/:id
  Description: Soft-delete product (manager+ only)
  Response: { status: 'product_deleted' }

GET /inventory/:outlet_id
  Description: Get outlet inventory snapshot
  Query: {
    search?: string,
    status?: 'low_stock' | 'normal' | 'overstock',
    category_id?: UUID
  }
  Response: {
    outlet: Outlet,
    inventory: [
      {
        product_id, sku, name,
        quantity_on_hand, quantity_reserved, quantity_available,
        cost_value, retail_value,
        status: 'normal' | 'low_stock' | 'overstock'
      }
    ],
    total_value_on_hand: decimal,
    total_retail_value: decimal
  }

POST /inventory/adjust
  Description: Manual inventory adjustment (manager+ only)
  Body: {
    outlet_id: UUID,
    product_id: UUID,
    quantity_change: integer, (positive or negative)
    reason: string,
    reference?: string
  }
  Response: {
    adjustment_id: UUID,
    new_quantity: integer,
    audit_log_id: UUID
  }

POST /inventory/stocktake/start
  Description: Start physical stocktake
  Body: {
    outlet_id: UUID,
    scheduled_date: date
  }
  Response: {
    stocktake_id: UUID,
    products: [ { product_id, name, expected_qty } ],
    status: 'in_progress'
  }

POST /inventory/stocktake/:id/record
  Description: Record stocktake count for a product
  Body: {
    product_id: UUID,
    counted_quantity: integer
  }
  Response: { recorded: true, variance: integer }

POST /inventory/stocktake/:id/complete
  Description: Complete stocktake and calculate variances
  Response: {
    stocktake_id: UUID,
    total_variance_value: decimal,
    variance_percent: decimal,
    high_variance_items: [...],
    status: 'completed'
  }
```

### 4.3 Invoicing & POS Endpoints

```
POST /invoices
  Description: Create new invoice (cashier+)
  Body: {
    outlet_id: UUID,
    customer_name?: string,
    customer_phone?: string,
    items: [
      { product_id: UUID, quantity: integer, discount?: decimal }
    ],
    discount_amount?: decimal,
    discount_reason?: string,
    payment_method: 'cash' | 'e_wallet' | 'bank_transfer' | 'card'
  }
  Process:
    1. Validate cashier authorization
    2. Lock inventory (pessimistic lock)
    3. Verify prices & stock available
    4. Create invoice record
    5. Create invoice_items
    6. Deduct inventory
    7. Create journal entries
    8. Route to payment processor (if digital)
    9. Unlock inventory
    10. Publish real-time update
  Response: {
    invoice_id: UUID,
    invoice_number: string,
    total: decimal,
    payment_status: string,
    next_step: {
      if cash: "receipt_ready",
      if e_wallet: "show_qr_code",
      if bank_transfer: "show_virtual_account"
    }
  }
  Errors: 400 (invalid items), 409 (out of stock), 403 (unauthorized)

GET /invoices/:id
  Description: Get invoice detail
  Response: {
    invoice: Invoice,
    items: InvoiceItem[],
    payments: PaymentTransaction[],
    audit_trail: [...],
    receipt_pdf_url: string
  }

POST /invoices/:id/void
  Description: Void invoice (manager+ only, within 24 hours)
  Body: { reason: string }
  Process:
    1. Verify authorization (manager+)
    2. Verify time window (must be within 24h)
    3. Reverse journal entries
    4. Return stock to inventory
    5. Reverse payment records
    6. Mark invoice as voided
    7. Audit trail entry
  Response: {
    status: 'voided',
    voided_at: timestamp,
    stock_returned: integer,
    payment_refund_initiated: boolean
  }

GET /invoices/daily-summary
  Description: Get today's summary
  Response: {
    date: date,
    total_sales: decimal,
    cash_sales: decimal,
    e_wallet_sales: decimal,
    bank_transfer_pending: decimal,
    total_discount: decimal,
    transaction_count: integer,
    items_sold: integer,
    unique_customers: integer,
    pending_payments: [...],
    top_sellers: [...],
    voided_transactions: [...]
  }

GET /invoices
  Description: List invoices with filters
  Query: {
    from_date: date,
    to_date: date,
    payment_status?: string,
    outlet_id?: UUID,
    page: number,
    limit: number
  }
  Response: {
    invoices: Invoice[],
    pagination: {...},
    summary: { total_revenue, total_discounts, avg_transaction }
  }
```

### 4.4 Payment Processing Endpoints

```
POST /payments/initiate
  Description: Start payment processing
  Body: {
    invoice_id: UUID,
    payment_method: 'cash' | 'e_wallet' | 'bank_transfer' | 'card',
    amount: decimal,
    payment_provider?: string (for e_wallet: 'doku_pay', 'ovo', etc)
  }
  Response (for e_wallet): {
    payment_id: UUID,
    qr_code_data: string,
    qr_code_image_url: string,
    payment_url: string,
    expires_in: 300 (seconds)
  }
  Response (for bank transfer): {
    payment_id: UUID,
    virtual_account_number: string,
    account_name: string,
    bank_code: string,
    expires_in: 86400
  }
  Response (for cash): {
    payment_id: UUID,
    status: 'completed',
    cash_received: decimal,
    change: decimal
  }

GET /payments/:payment_id/status
  Description: Check payment status
  Response: {
    payment_id: UUID,
    status: 'pending' | 'processing' | 'settled' | 'failed',
    amount: decimal,
    settlement_amount?: decimal,
    gateway_fee?: decimal,
    settled_at?: timestamp
  }

POST /payments/webhook/doku
  Description: Webhook from Doku Pay (server-to-server)
  Headers: X-Signature: HMAC-SHA256
  Body: {
    order_id: string,
    status: 'COMPLETED' | 'FAILED',
    amount: decimal,
    payment_method: string,
    timestamp: unix_timestamp
  }
  Process:
    1. Verify signature with Doku secret key
    2. Find payment record
    3. If COMPLETED:
       a. Update payment_transaction (status=settled)
       b. Update invoice (payment_status=paid)
       c. Update cash_flow
       d. Send receipt to customer
       e. Publish real-time update
    4. If FAILED:
       a. Update payment_transaction (status=failed)
       b. Notify customer
  Response: { status: 'received' }

POST /payments/webhook/bank
  Description: Webhook from bank API (virtual account transfer)
  Headers: X-Bank-Signature: signature
  Body: {
    virtual_account: string,
    amount_received: decimal,
    timestamp: unix_timestamp
  }
  Process: Similar to Doku webhook
  Response: { status: 'received' }

GET /payments/settlement-history
  Description: Payment settlement history
  Query: {
    from_date: date,
    to_date: date,
    payment_provider?: string,
    page: number,
    limit: number
  }
  Response: {
    settlements: [
      {
        settlement_date: date,
        payment_provider: string,
        total_amount: decimal,
        total_fees: decimal,
        settlement_amount: decimal,
        transaction_count: integer
      }
    ]
  }
```

### 4.5 Supplier & Purchasing Endpoints

```
GET /suppliers
  Description: List suppliers
  Query: { page, limit, search?, status? }
  Response: { suppliers: Supplier[], pagination }

POST /suppliers
  Description: Create new supplier (manager+)
  Body: {
    name: string,
    contact_person: string,
    phone: string,
    email: string,
    address: string,
    payment_terms: integer,
    bank_account_name: string,
    bank_account_number: string (will be encrypted)
  }
  Response: { supplier: Supplier }

PUT /suppliers/:id
  Description: Update supplier info
  Body: { [fields to update] }
  Response: { supplier: Supplier }

POST /purchase-orders
  Description: Create purchase order (manager+)
  Body: {
    outlet_id: UUID,
    supplier_id: UUID,
    items: [
      { product_id: UUID, quantity: integer, unit_cost: decimal }
    ],
    requested_delivery_date: date,
    notes: string
  }
  Response: {
    po_id: UUID,
    po_number: string,
    total: decimal,
    status: 'draft'
  }

PUT /purchase-orders/:id
  Description: Update draft PO
  Body: { items: [...], requested_delivery_date: date, notes: string }
  Response: { po: PurchaseOrder }

POST /purchase-orders/:id/submit
  Description: Submit PO for approval
  Response: { status: 'submitted', approved_by: null }

POST /purchase-orders/:id/approve
  Description: Approve PO (manager+)
  Response: { status: 'approved', approved_at: timestamp }

POST /purchase-orders/:id/receive
  Description: Receive PO (create receiving report)
  Body: {
    items: [
      { po_item_id: UUID, quantity_received: integer }
    ],
    delivery_date: date,
    received_by: string,
    notes: string
  }
  Process:
    1. Update PO status (received or partial_received)
    2. Increase inventory
    3. Create inventory ledger entries
    4. Create journal entry (asset increase)
    5. Alert if variances exist
  Response: {
    receiving_id: UUID,
    inventory_updated: true,
    total_received_amount: decimal,
    po_status: 'received' | 'partial_received'
  }

GET /purchase-invoices
  Description: List supplier invoices
  Query: { supplier_id?, payment_status?, from_date, to_date, page, limit }
  Response: { invoices: PurchaseInvoice[], pagination }

POST /purchase-invoices
  Description: Record supplier invoice
  Body: {
    po_id: UUID,
    invoice_number: string,
    invoice_date: date,
    subtotal: decimal,
    tax_amount: decimal,
    due_date: date
  }
  Response: { invoice: PurchaseInvoice }

POST /purchase-invoices/:id/pay
  Description: Record payment for supplier invoice
  Body: {
    amount: decimal,
    payment_date: date,
    payment_method: string,
    reference_number: string,
    notes: string
  }
  Process:
    1. Update purchase_invoice (payment_status)
    2. Create journal entry (expense/cash)
    3. Update accounts_payable
    4. Log audit trail
  Response: {
    payment_id: UUID,
    remaining_balance: decimal,
    fully_paid: boolean
  }
```

### 4.6 Financial Reporting Endpoints

```
GET /reports/daily-summary
  Description: Today's financial summary
  Response: {
    date: date,
    sales: {
      total_sales: decimal,
      cash: decimal,
      e_wallet: decimal,
      bank_transfer: decimal,
      total_discount: decimal,
      tax_collected: decimal
    },
    inventory: {
      cost_of_goods_sold: decimal,
      gross_profit: decimal,
      gross_profit_margin: percent
    },
    cash_position: {
      opening_cash: decimal,
      cash_received: decimal,
      cash_paid_out: decimal,
      closing_cash: decimal,
      expected_closing: decimal,
      variance: decimal
    },
    operations: {
      transaction_count: integer,
      items_sold: integer,
      unique_customers: integer,
      avg_transaction_value: decimal
    },
    alerts: [
      { type: string, severity: string, message: string }
    ]
  }

GET /reports/p-and-l
  Description: Profit & Loss report
  Query: { from_date: date, to_date: date, by_outlet?: boolean }
  Response: {
    period: { from_date, to_date },
    revenue: decimal,
    cost_of_goods_sold: decimal,
    gross_profit: decimal,
    gross_profit_margin: percent,
    operating_expenses: {
      salaries: decimal,
      rent: decimal,
      utilities: decimal,
      other: decimal,
      total: decimal
    },
    operating_profit: decimal,
    other_income_expenses: decimal,
    net_profit: decimal,
    net_profit_margin: percent,
    trend_comparison: { previous_period: {...} }
  }

GET /reports/cash-position
  Description: Current cash position
  Response: {
    as_of: timestamp,
    cash_on_hand: decimal,
    pending_e_wallet_settlement: decimal,
    pending_bank_transfer: decimal,
    total_available_cash: decimal,
    recent_transactions: [
      { type: string, amount: decimal, timestamp: timestamp }
    ],
    cash_flow_forecast_30_days: decimal
  }

GET /reports/inventory-valuation
  Description: Inventory value report
  Query: { as_of_date?: date }
  Response: {
    date: date,
    total_items_count: integer,
    total_units_on_hand: integer,
    total_cost_value: decimal,
    total_retail_value: decimal,
    potential_profit: decimal,
    low_stock_items: [...],
    overstock_items: [...],
    expired_items: [...],
    valuation_method: 'FIFO' | 'LIFO' | 'WAC'
  }

GET /reports/tax-report
  Description: Monthly tax summary (for tax authority)
  Query: { month: integer, year: integer }
  Response: {
    period: 'MM/YYYY',
    gross_sales: decimal,
    ppn_10_percent: decimal,
    ppn_collected: decimal,
    pph_21_withheld: decimal,
    pph_23_withheld: decimal,
    tax_summary: {
      ppn_payable: decimal,
      pph_payable: decimal,
      total_tax_payable: decimal
    },
    payment_status: 'not_paid' | 'partial' | 'paid',
    export_format: 'PDF' | 'CSV' | 'XML'
  }

GET /reports/accounts-payable-aging
  Description: Supplier outstanding aging report
  Response: {
    total_outstanding: decimal,
    aging_summary: {
      current: decimal,
      30_days: decimal,
      60_days: decimal,
      90_days: decimal,
      120plus_days: decimal
    },
    suppliers: [
      {
        supplier_name: string,
        outstanding_amount: decimal,
        due_date: date,
        days_overdue: integer
      }
    ]
  }

GET /reports/sales-by-category
  Description: Sales breakdown by product category
  Query: { from_date: date, to_date: date, by_outlet?: boolean }
  Response: {
    period: { from_date, to_date },
    categories: [
      {
        category_name: string,
        units_sold: integer,
        revenue: decimal,
        cogs: decimal,
        gross_profit: decimal,
        margin_percent: percent,
        top_products: [...]
      }
    ],
    total_revenue: decimal
  }
```

### 4.7 Master Admin Endpoints (Multi-outlet)

```
GET /admin/outlets
  Description: Performance dashboard for all outlets (master admin only)
  Query: { sort_by?: 'revenue' | 'profit_margin' | 'transaction_count' }
  Response: {
    total_outlets: integer,
    active_outlets: integer,
    suspended_outlets: integer,
    outlets: [
      {
        outlet_id: UUID,
        outlet_name: string,
        revenue_mtd: decimal,
        revenue_change_percent: percent,
        profit_margin_percent: percent,
        transaction_count: integer,
        last_transaction: timestamp,
        staff_count: integer,
        status: string,
        alerts: [...]
      }
    ],
    company_totals: {
      total_revenue_mtd: decimal,
      total_profit_margin: percent,
      total_transactions: integer,
      total_staff: integer,
      avg_outlet_revenue: decimal
    }
  }

POST /admin/bulk-operation/products
  Description: Bulk product operation (price update, add, etc)
  Body: {
    operation_type: 'price_increase' | 'price_decrease' | 'add_product' | 'update_tax',
    outlets: ['all'] | [outlet_ids],
    parameters: {
      if price_increase: { percentage: decimal, effective_date: date },
      if add_product: { product_data: {...} },
      ...
    },
    scheduled_for?: timestamp,
    notification_message?: string
  }
  Process:
    1. Validate master admin authorization
    2. Create bulk_admin_operations record
    3. Schedule execution (immediate or future)
    4. Generate preview report
    5. Execute operation
    6. Publish real-time updates to affected outlets
    7. Send notification to outlet managers
  Response: {
    operation_id: UUID,
    status: 'scheduled' | 'executing' | 'completed',
    preview: { outlets_affected: integer, products_affected: integer },
    execution_time?: timestamp
  }

POST /admin/bulk-operation/:id/rollback
  Description: Rollback a completed bulk operation
  Body: { reason: string }
  Response: { status: 'rollback_initiated', completion_time: timestamp }

GET /admin/users
  Description: All users across company (master admin only)
  Query: {
    outlet_id?: UUID,
    role?: string,
    status?: string,
    search?: string,
    page: number,
    limit: number
  }
  Response: {
    users: [
      {
        user_id: UUID,
        email: string,
        full_name: string,
        role: string,
        outlet_name: string,
        status: string,
        last_login: timestamp
      }
    ],
    pagination: {...}
  }

POST /admin/users
  Description: Add new user to company
  Body: {
    email: string,
    full_name: string,
    phone: string,
    role: 'outlet_manager' | 'cashier' | 'staff',
    outlet_id?: UUID (required if not MASTER_ADMIN),
    send_invite_email: boolean
  }
  Response: {
    user_id: UUID,
    email: string,
    temp_password?: string (if auto-generated)
  }

PUT /admin/users/:id
  Description: Update user details
  Body: { full_name?, phone?, role?, outlet_id?, status? }
  Response: { user: User }

POST /admin/users/:id/reset-password
  Description: Admin reset user password
  Body: { send_reset_email: boolean }
  Response: {
    temp_password?: string,
    reset_link?: string,
    email_sent: boolean
  }

DELETE /admin/users/:id
  Description: Deactivate/delete user
  Response: { status: 'user_deactivated' }

GET /admin/audit-log
  Description: Company-wide audit log (master admin)
  Query: {
    from_date: date,
    to_date: date,
    action_type?: string,
    entity_type?: string,
    user_id?: UUID,
    outlet_id?: UUID,
    page: number,
    limit: number
  }
  Response: {
    logs: AuditLogEntry[],
    pagination: {...},
    summary: {
      total_actions: integer,
      actions_by_type: {...},
      users_active: integer
    }
  }

GET /admin/compliance-report
  Description: Compliance & audit readiness report
  Query: { from_date: date, to_date: date }
  Response: {
    period: { from_date, to_date },
    audit_readiness: {
      all_transactions_recorded: boolean,
      all_cash_movements_logged: boolean,
      no_invoices_modified_post_payment: boolean
    },
    data_integrity: {
      invoice_count: integer,
      total_amount: decimal,
      voided_transactions: integer,
      void_approvals_count: integer
    },
    user_access: {
      authorized_users: integer,
      suspended_users: integer,
      last_access_audit: timestamp
    },
    payment_reconciliation: {
      reconciled_transactions: percent,
      pending_reconciliation: integer,
      variance_total: decimal
    }
  }
```

---

## 5. PAYMENT GATEWAY INTEGRATION DETAIL

### 5.1 Doku Pay Integration (e-wallet aggregator)

```
Provider: Doku Pay (Indonesia)
Integrates: OVO, Dana, Gopay, LinkAja, etc

Setup:
ââ Merchant Registration â Get Merchant ID & Secret Key
ââ PGN (Paytren Gateway Number) â For settlement
ââ API Keys in Supabase secrets

Transaction Flow:
1. POS creates invoice
2. Cashier selects "E-wallet" payment method
3. Backend calls Doku Pay API:
   POST https://api.doku.com/charge
   {
     order_id: "INV-2024-001234",
     amount: 50000,
     invoice_amount: 50000,
     callback_url: "https://gaweee.com/api/payments/webhook/doku",
     return_url: "https://gaweee.com/payment-status",
     customer: { email, name, phone },
     item: { name, price, quantity }
   }

4. Doku returns:
   {
     status: "PENDING",
     qr_code_string: "...",
     qr_code_url: "...",
     payment_url: "https://pay.doku.com/...",
     channel: "QRIS" | "OVO" | "DANA",
     expires_at: "2024-XX-XX 10:05:00"
   }

5. Frontend displays QR code to customer
6. Customer scans & pays via their e-wallet app
7. Payment processed by wallet provider
8. Doku sends webhook to GawEEE:
   POST https://gaweee.com/api/payments/webhook/doku
   {
     order_id: "INV-2024-001234",
     status: "COMPLETED",
     amount: 50000,
     channel: "OVO",
     timestamp: 1704067500,
     signature: "HMAC-SHA256 signature"
   }

9. GawEEE verifies signature & updates payment status
10. Funds settle to merchant account (T+1)

Settlement:
ââ Daily: Doku aggregates all transactions
ââ Fee: 1-2% depending on volume/channel
ââ Net amount: Transferred to merchant bank account
ââ Reconciliation: Daily settlement report available via API
```

### 5.2 Bank Virtual Account Integration (T.Bank, BCA, etc)

```
Provider: Indonesia Bank VAs
Setup: Integrate with bank APIs (e.g., BCA, Mandiri, BRI via t.bank)

Transaction Flow:
1. Invoice created, customer chooses "Bank Transfer"
2. Backend generates unique VA:
   ââ Format: {outlet_code}{invoice_number}{random_check_digit}
   ââ Example: 01012400001234
   ââ Expires in 24 hours (configurable)

3. Display to customer:
   Bank Name: BCA
   Account: 12345678901234
   Amount: Rp 150,000
   Description: INV-2024-001234

4. Customer transfers via mobile banking
5. Bank immediately sends webhook:
   POST https://gaweee.com/api/payments/webhook/bank
   {
     virtual_account: "12345678901234",
     amount_received: 150000,
     timestamp: 1704067500,
     transfer_id: "TRX-12345678"
   }

6. GawEEE updates payment status
7. Funds swept to merchant account (T+1)
```

---

## 6. SECURITY & COMPLIANCE

### 6.1 Authentication & Authorization

**JWT Implementation:**
```
Token Structure:
{
  sub: user_id (UUID),
  company_id: UUID,
  outlet_id?: UUID,
  role: string,
  permissions: string[],
  iat: 1704067500,
  exp: 1704071100 (1 hour),
  refresh_exp: 1704153900 (24 hours)
}

Algorithms: RS256 (asymmetric, secure)
Key Rotation: Every 90 days
Token Storage: httpOnly cookie (secure) + localStorage backup
Refresh Flow: Silent refresh via refresh_token endpoint
Logout: Revoke refresh_token in DB
```

**Row-Level Security (RLS) Policies:**
```sql
-- Cashier can only access their outlet
CREATE POLICY cashier_outlet_access ON invoices
  FOR ALL
  USING (
    outlet_id = (SELECT outlet_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'CASHIER'
  );

-- Outlet Manager can manage 1 outlet
CREATE POLICY outlet_manager_access ON invoices
  FOR ALL
  USING (
    outlet_id = (SELECT outlet_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'OUTLET_MANAGER'
  );

-- Master Admin can access all outlets in company
CREATE POLICY master_admin_access ON invoices
  FOR ALL
  USING (
    outlet_id IN (
      SELECT id FROM outlets 
      WHERE company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    )
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'MASTER_ADMIN'
  );
```

### 6.2 Data Encryption

**At-Rest:**
- Supabase default: AES-256 encryption
- Sensitive fields (bank accounts, payment credentials): Column-level encryption using PGCrypto
- PII retention: 2 years after account deletion (auto-purge)

**In-Transit:**
- All APIs: HTTPS/TLS 1.3 mandatory
- WebSocket: WSS (secure)
- Payment gateway calls: TLS 1.2+
- Certificate pinning: For payment gateway communications

**Secrets Management:**
- Supabase Vault: Payment gateway API keys, secret keys
- Rotation: Every 90 days with zero-downtime switching
- Environment-specific: dev/staging/prod keys isolated

### 6.3 PCI-DSS Compliance (Payment Processing)

**No Direct Card Processing:**
- GawEEE does NOT store credit card numbers
- All card transactions routed through payment gateways (Doku Pay)
- Webhook-based payment notifications only
- No sensitive payment data in logs

### 6.4 Audit & Compliance

**Immutable Audit Trail:**
```sql
-- All changes logged
- CREATE invoices â logged with timestamp, user, IP
- UPDATE products â old/new values stored
- DELETE users â soft-delete, logged
- VOID invoices â requires approval + reason

-- 7-year retention (Indonesia tax requirement)
- Invoices: immutable after 24 hours
- Audit log: 7-year retention minimum
- Exports: tracked with user, timestamp
- Tax reports: monthly snapshots retained
```

### 6.5 Fraud Prevention

**Mechanisms:**
- Duplicate invoice prevention (same items, same time)
- Void transaction limit (require manager approval)
- Discount threshold (auto-flag large discounts for review)
- Cash reconciliation (alert on variance > 5%)
- Anomaly detection (unusual spike in sales/returns)
- IP geolocation (alert on login from unusual location)

---

## 7. TECHNICAL DECISIONS & TRADE-OFFS

### Decision 1: Row-Level Security vs Schema Separation
**Chosen:** RLS (Row-Level Security) — simpler, faster to market, adequate performance with proper indexing.

### Decision 2: SaaS Model vs Internal Tool
**Chosen:** SaaS — recurring revenue, self-serve acquisition, scalable unit economics.

### Decision 3: Payment Settlement Model
**Chosen:** Passthrough (Phase 1) â Escrow (Phase 3+) — faster time to market, simpler reconciliation, lower regulatory risk initially.

### Decision 4: Offline-First vs Online-Only
**Chosen:** Online-only (Phase 1) â Offline-capable (Phase 2) — simpler architecture initially, PWA + SQLite sync added later.

### Decision 5: Real-Time Data Sync
**Chosen:** Supabase Realtime (WebSocket subscriptions) — built-in, no extra infra, fallback to polling.

---

## 8. MIGRATION STRATEGY (From Development to Supabase)

### Phase 1 Development (Local Database)
- Week 1-4: Build on local PostgreSQL (docker-compose)
- Sample products, test invoices
- Fully normalized schema (100+ tables)
- Migrations tracked in /database/migrations

### Phase 1 â Supabase Migration
1. Supabase Project Setup (Singapore region, PITR, daily backups)
2. Schema Migration (export/import, RLS policies, indexes)
3. Sample Data Migration (verify row counts, FK constraints)
4. Authentication Setup (SendGrid, JWT secrets, multi-provider auth)
5. Environment Configuration (.env.local, key rotation every 90 days)
6. Verification (integration tests, WebSocket, webhooks, load test 1000 users)
7. Production Deployment (Vercel + Supabase, monitoring, beta launch)
8. Post-Migration (monitor performance, optimize queries, runbooks)

### Backup & Disaster Recovery
- Backups: Supabase automatic (daily, 30-day retention) + weekly full dumps (S3)
- RTO: 4 hours, RPO: 1 hour, SLA: 99.9% uptime

---

## 9. PHASE 1 vs PHASE 2 FEATURE BREAKDOWN

### PHASE 1 (Months 1-4): Core Operational Excellence
Must-Have: Multi-tenant architecture, POS module, Inventory management, Supplier management, Payment integration (e-wallet, bank VA, cash), Basic financial reports, User management, Audit trail, Landing page, Sidebar navigation, Master Admin Panel.

Nice-to-Have: Advanced discounting, Staff attendance, Basic expense tracking, Automated tax calculation, SMS alerts.

Not in Phase 1: Offline-first, Advanced analytics, Third-party API, Mobile app, Marketplace features.

### PHASE 2 (Months 5-8): Analytics & Automation
Advanced reporting, Predictive inventory, Offline-first (PWA+SQLite), Staff payroll/scheduling, Expense tracking, Custom reporting builder, Email/SMS integration, Mobile app, Third-party API, Marketplace features, Performance optimization.

### PHASE 3 (Months 9+): Advanced Features & Marketplace
Supplier marketplace, Customer loyalty, Advanced promotions, Multi-currency, International payment gateways, Accounting integrations, White-label, API marketplace.

---

## 10. SUCCESS METRICS & KPIs

### Phase 1 Success Criteria
- 99.9% uptime, API response < 200ms (p95), DB query < 100ms (p95), zero unplanned downtime
- POS transaction < 30s, inventory sync < 5s, report generation < 10s, zero data loss
- 100+ beta customers, 50+ invoices/day/outlet, 98% payment success rate, 85% retention, <2% churn

### Post-Phase 1 Expansion Targets
- Month 4-6: 500 customers, Rp 75M ARR, 99.95% uptime
- Month 6-12: 2,000 customers, Rp 360M ARR, 99.99% uptime, 80% of Phase 2 roadmap complete

---

## END OF COMPREHENSIVE PRD

*Document prepared for: CEO, PT Berkah Purnama Sewu*
*Purpose: Strategic blueprint for GawEEE ERP system development*
*Audience: Development team, stakeholders, compliance review*

**Companion documents saved alongside this PRD:**
- `roadmap.md` — 8-week implementation roadmap, sprint breakdown, code architecture, testing/deployment strategy
- `design-system.md` — UI/UX design system: color palette, typography, landing page, POS/dashboard layouts, component library
