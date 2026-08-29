# GawEEE | Implementation Roadmap & Code Architecture
**8-Week Phase 1 Development Plan**

---

## TABLE OF CONTENTS
1. Project Overview & Timeline
2. Development Environment Setup
3. Code Architecture & Project Structure
4. Sprint Breakdown (2-week sprints)
5. API Development Sequencing
6. Database Migration Strategy
7. Testing Strategy (Unit + Integration + E2E)
8. Deployment & Release Plan
9. Performance & Security Checkpoints
10. Team Structure & Responsibilities

---

## 1. PROJECT OVERVIEW & TIMELINE

### 1.1 Phase 1 Timeline (8 Weeks)

```
PHASE 1: Core Operational Excellence (MVP)
ââ Week 1-2: Foundation & Setup (Sprint 1)
ââ Week 3-4: Core POS & Inventory (Sprint 2)
ââ Week 5-6: Financial & Supplier Modules (Sprint 3)
ââ Week 7-8: Integration & Polish (Sprint 4)
ââ Week 9: QA & Launch Prep

DELIVERABLES:
ââ Landing page (marketing website)
ââ Authentication system (signup/login)
ââ POS module (cashier app)
ââ Inventory management
ââ Payment integration (e-wallet, bank VA)
ââ Financial reporting (daily P&L)
ââ Supplier management
ââ Master Admin Panel (multi-outlet)
ââ Sidebar navigation (complete UI)
ââ Database (Supabase-ready)

SUCCESS CRITERIA:
â 99.9% uptime (SLA)
â API response time < 200ms (p95)
â Zero data loss incidents
â 100+ beta customers onboarded
â 98% payment success rate
â <2% critical bugs in production
```

### 1.2 Team Structure

```
TEAM COMPOSITION (Recommended):

Frontend Team (4 people):
ââ Lead Frontend Engineer (architect, code review)
ââ Senior Frontend Developer (POS + Dashboard)
ââ Frontend Developer (Owner dashboard, reports)
ââ UI/UX Designer (design system, component library)

Backend Team (3 people):
ââ Lead Backend Engineer (architect, API design)
ââ Senior Backend Developer (POS + Payments)
ââ Backend Developer (Inventory + Financial)

DevOps & QA (2 people):
ââ DevOps Engineer (CI/CD, infrastructure)
ââ QA Engineer (testing, bug triage)

Product & Project Management (1-2 people):
ââ Product Manager (requirements, prioritization)
ââ Scrum Master (ceremonies, blocking issues)

Total: 10-11 people for 8-week sprint
```

### 1.3 Key Dependencies & Risks

```
CRITICAL DEPENDENCIES:
ââ Supabase project setup (Day 1)
ââ Payment gateway integration (Week 3)
ââ Staging environment (Week 2)
ââ Database schema finalization (Week 1)
ââ Design system approval (Week 1)

RISKS & MITIGATION:
âââââââââââââââââââââââââââââââââââââââââââââââââââ
â Risk: Payment gateway API delays                â
â Impact: Cannot test payment flows               â
â Mitigation: Use mock/sandbox from Day 1         â
â            Parallel development with mocks      â
âââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â Risk: Database performance issues               â
â Impact: Slow transactions, poor UX              â
â Mitigation: Weekly performance testing          â
â            Index optimization early            â
âââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â Risk: Scope creep (features beyond MVP)         â
â Impact: Delays, quality issues                  â
â Mitigation: Strict scope control                â
â            Defer Phase 2 features              â
âââââââââââââââââââââââââââââââââââââââââââââââââââ¤
â Risk: Key team member departure                 â
â Impact: Knowledge loss, schedule slip           â
â Mitigation: Pair programming                    â
â            Comprehensive documentation         â
âââââââââââââââââââââââââââââââââââââââââââââââââââ
```

---

## 2. DEVELOPMENT ENVIRONMENT SETUP

### 2.1 Local Development Stack

```
REQUIRED TOOLS & VERSIONS:

Core:
ââ Node.js: 18.x LTS
ââ npm: 9.x or yarn: 4.x
ââ Git: latest

Backend:
ââ Next.js: 14.x (App Router)
ââ TypeScript: 5.x
ââ PostgreSQL: 15.x (local via Docker)

Frontend:
ââ React: 18.x
ââ Tailwind CSS: 3.x
ââ Zustand (state management)
ââ React Query (data fetching)

Database & API:
ââ Supabase CLI: latest
ââ Supabase JS client: latest
ââ Postman/Insomnia (API testing)

Testing:
ââ Jest: 29.x
ââ Playwright: 1.40+
ââ MSW (Mock Service Worker)
ââ Vitest: 0.34+ (optional, faster tests)

DevOps:
ââ Docker: 24.x
ââ Docker Compose: 2.x
ââ GitHub: repository
ââ GitHub Actions: CI/CD
ââ Vercel: hosting

Monitoring:
ââ Sentry: error tracking
ââ DataDog: performance monitoring
ââ LogRocket: session replay
```

### 2.2 Docker Compose Setup

```yaml
# docker-compose.yml (for local development)

version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: gaweee_dev
      POSTGRES_PASSWORD: dev_password_123
      POSTGRES_DB: gaweee_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gaweee_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
    environment:
      MH_HOSTNAME: mailhog.local

volumes:
  postgres_data:

# Start: docker-compose up -d
# Stop: docker-compose down
# Logs: docker-compose logs -f postgres
```

### 2.3 Environment Variables

```bash
# .env.local (local development)

# Supabase (Local/Development)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database (for local testing)
DATABASE_URL=postgresql://gaweee_dev:dev_password_123@localhost:5432/gaweee_db

# Payment Gateways (Sandbox/Test)
DOKU_MERCHANT_ID=MERCHANT_SANDBOX_ID
DOKU_SECRET_KEY=sandbox_secret_key
DOKU_API_URL=https://api-sandbox.doku.com

# Bank Virtual Account (Sandbox)
BANK_VA_API_KEY=sandbox_api_key
BANK_VA_SECRET=sandbox_secret

# Email (MailHog for local testing)
SENDGRID_API_KEY=test_key_for_local_development
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_FROM=noreply@gaweee.local

# Authentication
JWT_SECRET=your_jwt_secret_key_min_32_chars
REFRESH_TOKEN_SECRET=your_refresh_token_secret

# API
API_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000

# Logging
LOG_LEVEL=debug
SENTRY_DSN=your_sentry_dsn_for_local

# Feature Flags
ENABLE_PAYMENT_GATEWAY=true
ENABLE_MULTI_OUTLET=true
ENABLE_MASTER_ADMIN=true
ENABLE_ANALYTICS=false (Phase 2)
```

### 2.4 Git Workflow & Branching

```
BRANCHING STRATEGY (Git Flow):

Main branches:
ââ main (production, protected)
â  ââ Only merge via PR after QA approval
ââ develop (staging, protected)
â  ââ Merge PRs from feature branches
ââ hotfix/* (emergency fixes)

Feature branches:
ââ feature/pos-module
ââ feature/inventory-management
ââ feature/payment-integration
ââ pattern: feature/[ticket-id]-[description]

PR Requirements:
ââ All tests passing (CI/CD)
ââ Code review approval (min 2 reviewers)
ââ No merge conflicts
ââ Squash & merge (keep history clean)
ââ Delete branch after merge

Commit messages:
ââ Format: [TYPE] description
ââ Types: feat (feature), fix (bug), refactor, docs, test, chore
ââ Example: feat: add barcode scanning to POS
ââ Use conventional commits (follow Commitizen)
```

---

## 3. CODE ARCHITECTURE & PROJECT STRUCTURE

### 3.1 Next.js Project Structure

```
gaweee-app/
ââ .github/
â  ââ workflows/
â     ââ ci.yml (lint, test, build)
â     ââ deploy-staging.yml
â     ââ deploy-production.yml
â
ââ app/ (Next.js App Router)
â  ââ layout.tsx (root layout)
â  ââ page.tsx (home)
â  ââ auth/
â  â  ââ login/page.tsx
â  â  ââ signup/page.tsx
â  â  ââ reset-password/page.tsx
â  â  ââ verify-email/page.tsx
â  ââ dashboard/ (protected route)
â  â  ââ layout.tsx (dashboard layout with sidebar)
â  â  ââ page.tsx (dashboard overview)
â  â  ââ sales/
â  â  â  ââ page.tsx (sales overview)
â  â  â  ââ invoices/page.tsx (invoice list)
â  â  â  ââ [id]/page.tsx (invoice detail)
â  â  ââ inventory/
â  â  â  ââ page.tsx (inventory list)
â  â  â  ââ products/page.tsx (product management)
â  â  â  ââ stocktake/page.tsx
â  â  â  ââ low-stock/page.tsx
â  â  ââ suppliers/
â  â  â  ââ page.tsx (supplier list)
â  â  â  ââ purchase-orders/page.tsx
â  â  â  ââ invoices/page.tsx
â  â  ââ financial/
â  â  â  ââ page.tsx (financial overview)
â  â  â  ââ reports/page.tsx
â  â  â  ââ cash-position/page.tsx
â  â  â  ââ tax-report/page.tsx
â  â  ââ staff/
â  â  â  ââ page.tsx (staff list)
â  â  â  ââ attendance/page.tsx
â  â  ââ admin/ (multi-outlet only)
â  â  â  ââ page.tsx (master admin dashboard)
â  â  â  ââ outlets/page.tsx
â  â  â  ââ users/page.tsx
â  â  â  ââ bulk-operations/page.tsx
â  â  â  ââ audit-log/page.tsx
â  â  ââ settings/
â  â     ââ page.tsx (outlet settings)
â  â     ââ payment-methods/page.tsx
â  â     ââ bank-account/page.tsx
â  â
â  ââ pos/ (Cashier POS interface)
â  â  ââ layout.tsx (POS layout - minimal, optimized for mobile)
â  â  ââ page.tsx (main POS screen)
â  â  ââ checkout/page.tsx
â  â  ââ receipt/[invoiceId]/page.tsx
â  â
â  ââ api/ (Backend API routes)
â     ââ auth/
â     â  ââ register/route.ts
â     â  ââ login/route.ts
â     â  ââ logout/route.ts
â     â  ââ refresh/route.ts
â     â  ââ verify-email/route.ts
â     ââ invoices/
â     â  ââ route.ts (POST: create, GET: list)
â     â  ââ [id]/route.ts (GET: detail, POST: void)
â     ââ products/
â     â  ââ route.ts
â     â  ââ [id]/route.ts
â     ââ inventory/
â     â  ââ route.ts
â     â  ââ adjust/route.ts
â     â  ââ stocktake/route.ts
â     ââ payments/
â     â  ââ initiate/route.ts
â     â  ââ status/[paymentId]/route.ts
â     â  ââ webhook/
â     â  â  ââ doku/route.ts
â     â  â  ââ bank/route.ts
â     â  ââ reconciliation/route.ts
â     ââ suppliers/
â     â  ââ route.ts
â     â  ââ [id]/route.ts
â     ââ purchase-orders/
â     â  ââ route.ts
â     ââ reports/
â     â  ââ daily-summary/route.ts
â     â  ââ p-and-l/route.ts
â     â  ââ cash-position/route.ts
â     â  ââ tax-report/route.ts
â     ââ admin/ (multi-outlet)
â     â  ââ outlets/route.ts
â     â  ââ users/route.ts
â     â  ââ bulk-operations/route.ts
â     â  ââ audit-log/route.ts
â     ââ health/route.ts (monitoring)
â
ââ components/
â  ââ layout/
â  â  ââ Header.tsx
â  â  ââ Sidebar.tsx
â  â  ââ Dashboard Layout.tsx
â  â  ââ POSLayout.tsx
â  ââ auth/
â  â  ââ LoginForm.tsx
â  â  ââ SignUpForm.tsx
â  â  ââ ProtectedRoute.tsx
â  ââ pos/
â  â  ââ ProductSearch.tsx
â  â  ââ ShoppingCart.tsx
â  â  ââ PaymentMethod.tsx
â  â  ââ Receipt.tsx
â  ââ dashboard/
â  â  ââ KPICard.tsx
â  â  ââ SalesChart.tsx
â  â  ââ AlertsList.tsx
â  â  ââ InventoryStatus.tsx
â  ââ tables/
â  â  ââ InvoiceTable.tsx
â  â  ââ ProductTable.tsx
â  â  ââ InventoryTable.tsx
â  â  ââ PaginatedTable.tsx
â  ââ forms/
â  â  ââ ProductForm.tsx
â  â  ââ SupplierForm.tsx
â  â  ââ StaffForm.tsx
â  ââ modals/
â  â  ââ ConfirmModal.tsx
â  â  ââ VoidInvoiceModal.tsx
â  â  ââ StocktakeModal.tsx
â  ââ ui/ (Reusable UI components)
â  â  ââ Button.tsx
â  â  ââ Input.tsx
â  â  ââ Card.tsx
â  â  ââ Badge.tsx
â  â  ââ Alert.tsx
â  â  ââ Tabs.tsx
â  â  ââ Dropdown.tsx
â  â  ââ Loading Spinner.tsx
â  ââ common/
â     ââ ErrorBoundary.tsx
â     ââ Loading.tsx
â     ââ NotFound.tsx
â
ââ lib/
â  ââ supabase/
â  â  ââ client.ts (Supabase client initialization)
â  â  ââ auth.ts (auth helpers)
â  â  ââ database.ts (db queries)
â  â  ââ realtime.ts (WebSocket subscriptions)
â  ââ hooks/
â  â  ââ useAuth.ts
â  â  ââ useInvoices.ts
â  â  ââ useInventory.ts
â  â  ââ usePayments.ts
â  â  ââ usePOS.ts (shopping cart logic)
â  â  ââ useFetch.ts (generic fetching)
â  ââ api/
â  â  ââ auth.api.ts
â  â  ââ invoices.api.ts
â  â  ââ inventory.api.ts
â  â  ââ payments.api.ts
â  â  ââ suppliers.api.ts
â  â  ââ reports.api.ts
â  â  ââ admin.api.ts
â  ââ services/
â  â  ââ paymentGateway.service.ts
â  â  ââ dokuPay.service.ts
â  â  ââ bankVA.service.ts
â  â  ââ email.service.ts
â  â  ââ reporting.service.ts
â  ââ utils/
â  â  ââ formatting.ts (currency, date, etc)
â  â  ââ validation.ts (input validation)
â  â  ââ constants.ts (app constants)
â  â  ââ errors.ts (error handling)
â  â  ââ logger.ts (logging)
â  ââ types/
â  â  ââ index.ts (all TypeScript types/interfaces)
â  â  ââ database.types.ts (auto-generated from Supabase)
â  â  ââ api.types.ts
â  ââ middleware/
â     ââ auth.middleware.ts
â     ââ errorHandler.middleware.ts
â     ââ logging.middleware.ts
â
ââ store/ (Zustand state management)
â  ââ authStore.ts (user, company, outlet)
â  ââ posStore.ts (shopping cart, current invoice)
â  ââ uiStore.ts (modals, sidebar open/close)
â  ââ notificationStore.ts (alerts, toasts)
â
ââ styles/
â  ââ globals.css (Tailwind + custom styles)
â  ââ components.css (component-specific styles)
â  ââ tailwind.config.js (Tailwind configuration)
â
ââ public/
â  ââ images/
â  â  ââ logo.svg
â  â  ââ hero-image.png
â  â  ââ screenshots/
â  ââ icons/
â  â  ââ dashboard.svg
â  â  ââ inventory.svg
â  â  ââ ... (all sidebar icons)
â  ââ fonts/ (custom fonts if any)
â
ââ tests/
â  ââ unit/ (Jest tests)
â  â  ââ lib/
â  â  â  ââ formatting.test.ts
â  â  â  ââ validation.test.ts
â  â  â  ââ errors.test.ts
â  â  ââ components/
â  â  â  ââ Button.test.tsx
â  â  â  ââ LoginForm.test.tsx
â  â  â  ââ ShoppingCart.test.tsx
â  â  ââ hooks/
â  â     ââ useAuth.test.ts
â  â     ââ usePOS.test.ts
â  ââ integration/ (Jest + MSW)
â  â  ââ auth.test.ts (login, signup, token refresh)
â  â  ââ invoices.test.ts (create, void, get)
â  â  ââ payments.test.ts (payment flows)
â  â  ââ inventory.test.ts
â  ââ e2e/ (Playwright)
â  â  ââ auth.spec.ts (signup, login, logout)
â  â  ââ pos.spec.ts (POS transaction flow)
â  â  ââ dashboard.spec.ts (navigation, reports)
â  â  ââ inventory.spec.ts (stock management)
â  â  ââ multi-outlet.spec.ts (master admin)
â  ââ setup/
â     ââ handlers.ts (MSW request handlers)
â     ââ server.ts (MSW server setup)
â     ââ fixtures.ts (test data)
â
ââ database/
â  ââ migrations/
â  â  ââ 001_init_schema.sql
â  â  ââ 002_add_indexes.sql
â  â  ââ 003_add_rls_policies.sql
â  â  ââ ... (versioned migrations)
â  ââ seed/
â     ââ seed.ts (dev data seeding)
â     ââ fixtures.json (test data)
â
ââ docs/
â  ââ API.md (API documentation)
â  ââ DATABASE.md (schema documentation)
â  ââ SETUP.md (local development setup)
â  ââ DEPLOYMENT.md (deployment guide)
â  ââ CONTRIBUTING.md (code standards)
â
ââ .env.example (example env variables)
ââ .env.local (local only - never commit)
ââ .gitignore
ââ .eslintrc.json (code linting)
ââ .prettierrc (code formatting)
ââ tsconfig.json (TypeScript config)
ââ next.config.js
ââ package.json
ââ package-lock.json
ââ Dockerfile (production container)
ââ docker-compose.yml (local development)
ââ jest.config.js (unit test config)
ââ playwright.config.ts (E2E test config)
ââ vercel.json (Vercel deployment config)
ââ sentry.config.js (error tracking)
ââ README.md (project overview)
```

### 3.2 API Route Example

```typescript
// app/api/invoices/route.ts
// POST /api/invoices - Create new invoice

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Database } from '@/lib/types/database.types'
import { validateInvoiceInput } from '@/lib/validation'
import { handleDatabaseError } from '@/lib/errors'

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user (JWT from header or cookie)
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) { /* ... */ }
        }
      }
    )
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // 2. Parse request body
    const body = await request.json()
    const { outlet_id, items, discount_amount, payment_method } = body
    
    // 3. Validate input
    const validation = validateInvoiceInput({ outlet_id, items, payment_method })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors }, { status: 400 })
    }
    
    // 4. Check authorization (user can only create invoices for their outlets)
    const { data: userOutlet } = await supabase
      .from('users')
      .select('outlet_id, company_id')
      .eq('id', user.id)
      .single()
    
    if (userOutlet?.outlet_id !== outlet_id && userOutlet?.role !== 'MASTER_ADMIN') {
      return NextResponse.json(
        { error: 'No permission to create invoice for this outlet' },
        { status: 403 }
      )
    }
    
    // 5. Fetch product prices & inventory (lock for 10 seconds)
    const productIds = items.map(item => item.product_id)
    const { data: products } = await supabase
      .from('products')
      .select('id, selling_price, purchase_price')
      .in('id', productIds)
    
    // 6. Check inventory availability
    const { data: inventory } = await supabase
      .from('inventory')
      .select('product_id, quantity_available')
      .eq('outlet_id', outlet_id)
      .in('product_id', productIds)
    
    for (const item of items) {
      const inv = inventory?.find(i => i.product_id === item.product_id)
      if (!inv || inv.quantity_available < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for product ${item.product_id}` },
          { status: 409 }
        )
      }
    }
    
    // 7. Calculate totals & tax
    let subtotal = 0
    const invoiceItems = items.map(item => {
      const product = products?.find(p => p.id === item.product_id)
      const itemSubtotal = product!.selling_price * item.quantity
      subtotal += itemSubtotal
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product!.selling_price,
        subtotal: itemSubtotal,
        cost_of_goods_sold: product!.purchase_price * item.quantity
      }
    })
    
    const taxAmount = (subtotal - discount_amount) * 0.1 // 10% tax
    const total = subtotal - discount_amount + taxAmount
    
    // 8. Database transaction: Create invoice + update inventory + journal entries
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        outlet_id,
        invoice_number: `INV-${Date.now()}`,
        cashier_id: user.id,
        subtotal,
        discount_amount,
        tax_amount: taxAmount,
        total,
        payment_status: 'pending',
        order_status: 'completed'
      })
      .select('id')
      .single()
    
    if (invoiceError) throw invoiceError
    
    // Insert invoice items
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(
        invoiceItems.map(item => ({
          invoice_id: invoice.id,
          ...item
        }))
      )
    
    if (itemsError) throw itemsError
    
    // Update inventory
    for (const item of items) {
      await supabase.rpc('update_inventory', {
        p_outlet_id: outlet_id,
        p_product_id: item.product_id,
        p_quantity_change: -item.quantity, // negative = deduct
        p_movement_type: 'sales',
        p_reference_id: invoice.id,
        p_recorded_by: user.id
      })
    }
    
    // Create journal entries (if needed for accounting)
    // [JE creation logic]
    
    // 9. Publish real-time updates (inventory sync)
    supabase.channel(`inventory:${outlet_id}`).send('broadcast', {
      event: 'inventory_updated',
      inventory_items: invoiceItems.map(i => ({
        product_id: i.product_id,
        quantity_change: -i.quantity
      }))
    })
    
    // 10. Response
    return NextResponse.json({
      invoice_id: invoice.id,
      invoice_number: `INV-${Date.now()}`,
      total,
      payment_status: 'pending'
    }, { status: 201 })
    
  } catch (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function GET(request: NextRequest) {
  // Implement GET /api/invoices (list invoices)
  // [Implementation similar to POST]
}
```

---

## 4. SPRINT BREAKDOWN (2-Week Sprints)

### Sprint 1 (Week 1-2): Foundation & Setup

**Sprint Goal:** Setup infrastructure, authentication, landing page

| Day | Task | Owner | Priority | Status |
|-----|------|-------|----------|--------|
| **Day 1** |  |  |  |  |
|  | Project setup (repos, CI/CD, monitoring) | DevOps | Critical | |
|  | Database schema review & finalization | Backend Lead | Critical | |
|  | Design system finalization & Figma | Designer | Critical | |
| **Day 2-3** |  |  |  |  |
|  | Supabase project setup (prod + staging) | DevOps | Critical | |
|  | Auth API endpoints (register, login, logout) | Backend | Critical | |
|  | Auth UI components (forms, validation) | Frontend | Critical | |
| **Day 4-5** |  |  |  |  |
|  | JWT token implementation & refresh | Backend | Critical | |
|  | Protected routes middleware | Frontend | Critical | |
|  | Onboarding flow (first-time setup) | Frontend | High | |
| **Day 6-7** |  |  |  |  |
|  | Landing page (hero + features + pricing) | Frontend | High | |
|  | Email verification (SendGrid integration) | Backend | High | |
|  | User profile & company setup | Frontend | Medium | |
| **Day 8-9** |  |  |  |  |
|  | Sidebar navigation component | Frontend | Medium | |
|  | Dashboard layout (header + sidebar) | Frontend | Medium | |
|  | Database migrations setup (Supabase) | DevOps | Critical | |
| **Day 10** |  |  |  |  |
|  | Sprint review & retrospective | PM | - | |
|  | Testing: unit tests for auth | QA | High | |
|  | Staging environment first deploy | DevOps | Critical | |

**Sprint 1 Deliverables:**
- â Working authentication system
- â Landing page (live)
- â Dashboard layout & sidebar
- â Supabase production + staging ready
- â CI/CD pipeline functional

**Testing Checklist:**
- Unit tests for auth service (90%+ coverage)
- Integration tests for login/signup
- Manual testing: signup â email verification â dashboard access
- Performance: Auth API < 200ms

---

### Sprint 2 (Week 3-4): Core POS & Inventory

**Sprint Goal:** Functional POS, inventory tracking, payment integration (mock)

| Day | Task | Owner | Priority | Status |
|-----|------|-------|----------|--------|
| **Day 1-2** |  |  |  |  |
|  | POS layout (cashier interface) | Frontend | Critical | |
|  | Product search & barcode scanning | Frontend | Critical | |
|  | Shopping cart logic (state management) | Frontend | Critical | |
| **Day 3-4** |  |  |  |  |
|  | Invoice creation API | Backend | Critical | |
|  | Inventory deduction (transaction) | Backend | Critical | |
|  | Payment gateway mock setup | Backend | Critical | |
| **Day 5** |  |  |  |  |
|  | Payment method selection UI | Frontend | Critical | |
|  | Cash payment flow | Frontend | High | |
|  | E-wallet payment mock (QR display) | Frontend | High | |
| **Day 6-7** |  |  |  |  |
|  | Receipt generation & printing | Backend | High | |
|  | Inventory API (list, get, adjust) | Backend | Critical | |
|  | Inventory dashboard view | Frontend | Critical | |
| **Day 8-9** |  |  |  |  |
|  | Low-stock alerts & notifications | Backend | Medium | |
|  | Payment reconciliation (mock) | Backend | Medium | |
|  | Real-time inventory sync (WebSocket) | Backend | Medium | |
| **Day 10** |  |  |  |  |
|  | Sprint review & demo | PM | - | |
|  | E2E tests: Full POS transaction | QA | Critical | |
|  | Performance: POS API < 200ms | QA | High | |

**Sprint 2 Deliverables:**
- â Working POS (scan â checkout â receipt)
- â Inventory management (list, adjust, low-stock alerts)
- â Payment flow (cash + mock e-wallet)
- â Real-time inventory sync

**Testing Checklist:**
- E2E: Complete POS transaction (5+ scenarios)
- Unit tests for cart logic
- Integration: Invoice creation + inventory deduction
- Performance: Transaction completion < 30s

---

### Sprint 3 (Week 5-6): Financial & Supplier Modules

**Sprint Goal:** P&L reporting, supplier management, cash position

| Day | Task | Owner | Priority | Status |
|-----|------|-------|----------|--------|
| **Day 1-3** |  |  |  |  |
|  | Chart of Accounts setup | Backend | Critical | |
|  | Journal entries API | Backend | Critical | |
|  | P&L report calculation | Backend | Critical | |
| **Day 4-5** |  |  |  |  |
|  | Financial dashboard view | Frontend | High | |
|  | Daily summary report | Backend | High | |
|  | Cash position tracking | Backend | High | |
| **Day 6-7** |  |  |  |  |
|  | Supplier management API | Backend | Medium | |
|  | Purchase order creation & receiving | Backend | Medium | |
|  | Supplier invoice tracking | Backend | Medium | |
| **Day 8-9** |  |  |  |  |
|  | Financial reports UI (P&L, cash, tax) | Frontend | Medium | |
|  | Tax calculation & reporting | Backend | Medium | |
|  | Supplier invoices & payments UI | Frontend | Medium | |
| **Day 10** |  |  |  |  |
|  | Sprint review & testing | PM/QA | - | |
|  | Integration: Full transaction â P&L | QA | Critical | |
|  | Tax report accuracy testing | QA | High | |

**Sprint 3 Deliverables:**
- â P&L reports (daily, weekly, monthly)
- â Supplier management (POs, receiving, invoices)
- â Financial dashboard
- â Tax calculation & reporting

**Testing Checklist:**
- Integration: Transaction â Journal entry â P&L
- Unit: P&L calculations
- Tax report accuracy (sample data)

---

### Sprint 4 (Week 7-8): Integration & Polish

**Sprint Goal:** Real payment gateway integration, Master Admin, polish & optimization

| Day | Task | Owner | Priority | Status |
|-----|------|-------|----------|--------|
| **Day 1-3** |  |  |  |  |
|  | Doku Pay integration (real API) | Backend | Critical | |
|  | Bank VA integration (real API) | Backend | Critical | |
|  | Webhook handling for payment callbacks | Backend | Critical | |
| **Day 4-5** |  |  |  |  |
|  | Multi-outlet support (company level) | Backend | High | |
|  | Master Admin dashboard | Frontend | High | |
|  | Bulk operations (price update, etc) | Backend | High | |
| **Day 6-7** |  |  |  |  |
|  | UI polish & animations | Frontend | Medium | |
|  | Error handling & user feedback | Frontend | Medium | |
|  | Performance optimization (caching) | DevOps | Medium | |
| **Day 8-9** |  |  |  |  |
|  | Load testing (1000 concurrent users) | QA | High | |
|  | Security audit (OWASP top 10) | QA | Critical | |
|  | Bug fixes from testing | Dev | High | |
| **Day 10** |  |  |  |  |
|  | Final Sprint review & release prep | PM | - | |
|  | Staging â Production deployment | DevOps | Critical | |
|  | Beta customer onboarding | PM | Critical | |

**Sprint 4 Deliverables:**
- â Real payment gateway integration
- â Multi-outlet management
- â Master Admin Panel
- â Production deployment
- â 100+ beta customers onboarded

**Testing Checklist:**
- E2E: Full payment flows (Doku + Bank VA)
- Load test: 1000 concurrent users
- Security: Penetration testing
- UAT: Beta customers sign-off

---

## 5. API DEVELOPMENT SEQUENCING

### Priority Order (Parallel Development)

```
PARALLEL TRACKS:

Track 1: Authentication (Week 1)
ââ POST /auth/register
ââ POST /auth/login
ââ POST /auth/logout
ââ POST /auth/refresh
ââ POST /auth/verify-email

Track 2: Invoicing & POS (Week 3-4, then ongoing)
ââ POST /invoices (create)
ââ GET /invoices (list, paginated)
ââ GET /invoices/:id (detail)
ââ POST /invoices/:id/void (void transaction)
ââ GET /invoices/daily-summary

Track 3: Inventory (Week 3-4, parallel)
ââ GET /products (list)
ââ GET /products/:id (detail)
ââ GET /inventory/:outlet_id (outlet stok)
ââ POST /inventory/adjust (manual adjustment)
ââ POST /inventory/stocktake/start
ââ POST /inventory/stocktake/:id/complete

Track 4: Payments (Week 3-4 mock, Week 7-8 real)
ââ POST /payments/initiate
ââ GET /payments/:id/status
ââ POST /payments/webhook/doku
ââ POST /payments/webhook/bank
ââ GET /payments/reconciliation

Track 5: Financial (Week 5-6)
ââ GET /reports/daily-summary
ââ GET /reports/p-and-l
ââ GET /reports/cash-position
ââ GET /reports/tax-report
ââ GET /reports/accounts-payable-aging

Track 6: Admin (Week 7-8)
ââ GET /admin/outlets (performance)
ââ POST /admin/bulk-operation/products
ââ GET /admin/users
ââ POST /admin/users
ââ GET /admin/audit-log
```

### Database Query Optimization

```
INDEXING STRATEGY:

Critical Indexes (Week 1):
ââ invoices(outlet_id, created_at) - revenue queries
ââ invoice_items(invoice_id) - detail fetching
ââ inventory(outlet_id, product_id) - stock lookup
ââ products(company_id, sku) - product search
ââ payment_transactions(invoice_id, status) - payment status

Secondary Indexes (Week 2-3):
ââ users(company_id, outlet_id) - user queries
ââ suppliers(company_id) - supplier list
ââ purchase_orders(outlet_id, status) - PO search
ââ audit_log(company_id, created_at) - compliance audit
ââ daily_financial_summary(outlet_id, summary_date) - reporting

Full-Text Search Indexes (Week 4):
ââ products.name, products.sku - product search
ââ suppliers.name - supplier search
ââ TSVECTOR for fast searching

Materialized Views (Week 6):
ââ v_daily_sales_summary - pre-calculated daily totals
ââ v_inventory_valuation - stok value calc
ââ v_low_stock_alerts - products below reorder level
```

---

## 6. TESTING STRATEGY

(See prd.md and design-system.md for related schema/UI context.)

### 6.1 Testing Pyramid

```
Target Coverage:
ââ Statements: 80%+
ââ Branches: 75%+
ââ Functions: 80%+
ââ Lines: 80%+
```

### 6.2-6.5 Examples

Unit tests (Jest), Integration tests (Jest + MSW), E2E tests (Playwright), and fixtures for
FIXTURE_USER_CASHIER, FIXTURE_USER_MANAGER, FIXTURE_COMPANY, FIXTURE_OUTLET, FIXTURE_PRODUCTS,
FIXTURE_INVENTORY — see original test suite under /tests once scaffolded.

---

## 7. DEPLOYMENT & RELEASE PLAN

### 7.1 Environment Strategy

Three environments: Development (local Docker), Staging (staging.gaweee.com via Vercel + Supabase staging),
Production (gaweee.com via Vercel + Supabase production, blue-green deploys, 99.9% SLA).

### 7.2 Deployment Pipeline (GitHub Actions)

CI/CD via `.github/workflows/deploy-staging.yml` (on push to `develop`) and
`.github/workflows/deploy-production.yml` (on tag `v*.*.*`): lint â unit tests â build â
integration tests â deploy (Vercel) â E2E/smoke tests â Slack notification.

### 7.3 Release Checklist

Pre-release: code review, full test suite green, staging verification, DB migration dry-run + backup,
docs updated, monitoring/alerting configured.
Release day: stakeholder notice, tag & deploy, health check, smoke tests, 30-min post-deploy monitoring,
rollback plan ready.

---

## 8. MONITORING & PERFORMANCE TARGETS

```
API PERFORMANCE:
ââ Response time (p50): < 100ms
ââ Response time (p95): < 200ms
ââ Response time (p99): < 500ms
ââ Error rate: < 0.1%
ââ Uptime: 99.9%
ââ Throughput: > 1000 req/sec

APPLICATION PERFORMANCE:
ââ Page load time: < 2 seconds
ââ First Contentful Paint: < 1 second
ââ Time to Interactive: < 3 seconds
ââ Largest Contentful Paint: < 2.5 seconds
ââ Cumulative Layout Shift: < 0.1

BUSINESS METRICS:
ââ Transaction success rate: > 98%
ââ Payment success rate: > 98%
ââ Customer onboarding time: < 15 min
ââ Support ticket resolution: < 24h
ââ User satisfaction (NPS): > 40
```

Monitoring stack: Sentry (errors), DataDog (APM), LogRocket (session replay), Uptime Robot
(external uptime checks every 5 min), centralized logging (Vercel + Supabase + Winston/Pino â DataDog).

---

## 9. GO-LIVE STRATEGY

### 9.1 Beta Launch Plan (Week 9-10)
20-30 trusted customers across business types; daily check-ins, weekly surveys, bug bounty Rp 100K/critical bug.
Success: 95%+ uptime, zero data loss, NPS > 30, <5 critical bugs, 10+ feature ideas.

### 9.2 Gradual Rollout (Public Launch)
Wave 1: Jakarta Metro (100 customers, Week 11-12) â Wave 2: Major cities (500 customers, Week 13-16) â
Wave 3: National (2,000+ customers by month 6).

---

## 10. TEAM COMMUNICATION & GOVERNANCE

Daily standup (09:30), engineering sync, close-out; weekly sprint planning/mid-check/review/retro;
bi-weekly design & performance review; monthly steering committee.

Documentation standards: inline comments for "why" not "what", JSDoc on exports, Postman/OpenAPI specs,
ERD + RLS policy docs, runbooks (deploy, incident response, backup/recovery, onboarding).

---

## 11. SUCCESS METRICS & GO/NO-GO DECISION

**GO** requires: 99.9% staging uptime, API p95 < 200ms, all critical E2E green, zero data loss,
payment gateways working, OWASP audit passed, 1000-user load test passed, team ready, beta customers ready.

**NO-GO** triggers: unresolved critical bugs, payment gateway <95% success, security vulnerabilities,
API > 500ms, data integrity issues â fix + 1-2 week delay.

---

## END OF IMPLEMENTATION ROADMAP

*Companion to `prd.md` (product/technical spec) and `design-system.md` (UI/UX system).*
