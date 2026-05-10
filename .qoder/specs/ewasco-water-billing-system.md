# EWASCO Water Billing System - Implementation Plan

## Context

Embu Water and Sanitation Company (EWASCO) needs a full-stack web-based water billing system to manage customers, meter readings, billing, payments (including M-Pesa), arrears, SMS notifications, and reporting. This is a greenfield project built with React + Tailwind CSS (frontend) and Node.js + Express + MySQL (backend). The system serves staff (admin, clerks, meter readers, cashiers, managers) and customers (self-service portal).

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + React Router v6 + Recharts
- **Backend:** Node.js + Express + mysql2/promise (raw SQL, no ORM)
- **Database:** MySQL 8
- **Auth:** JWT (access token in memory, refresh token in httpOnly cookie)
- **PDF:** PDFKit (bills, receipts)
- **Excel:** ExcelJS (report exports)
- **M-Pesa:** Safaricom Daraja API (C2B + STK Push)
- **SMS:** Africa's Talking API
- **Scheduling:** node-cron

## Project Structure

```
embuwaterbilling/
├── client/                      # React + Vite frontend
│   ├── src/
│   │   ├── api/                 # Axios API service modules
│   │   ├── auth/                # AuthContext, ProtectedRoute
│   │   ├── layouts/             # DashboardLayout, AuthLayout, CustomerPortalLayout, MobileLayout
│   │   ├── components/          # Shared: DataTable, StatCard, ui/ primitives
│   │   ├── pages/               # auth/, dashboard/, customers/, meters/, readings/, billing/,
│   │   │                        # payments/, arrears/, sms/, reports/, users/, settings/, customer-portal/
│   │   ├── hooks/               # useDebounce, usePagination, usePermission
│   │   └── utils/               # constants, formatters (KES/dates), validators, permissions
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── server/                      # Node.js + Express backend
│   ├── src/
│   │   ├── config/              # database.js, mpesa.js, sms.js, jwt.js
│   │   ├── middleware/          # auth, authorize, validate, errorHandler, auditLog, rateLimiter
│   │   ├── routes/              # 13 route files (auth, customer, meter, reading, billing, payment,
│   │   │                        # mpesa, arrears, sms, report, user, settings + portal)
│   │   ├── controllers/         # 12 controllers matching routes
│   │   ├── services/            # Business logic: billing.service, mpesa.service, pdf.service, etc.
│   │   ├── models/              # Raw SQL query modules per entity
│   │   ├── validators/          # Joi schemas per entity
│   │   ├── utils/               # billingCalculator, accountNumberGenerator, phoneFormatter
│   │   └── jobs/                # node-cron: auto billing, arrears check, M-Pesa reconciliation
│   └── database/
│       ├── migrations/          # 14 numbered SQL migration files
│       ├── seeds/               # Default admin, tariffs, zones, company settings
│       └── migrate.js           # Migration runner
│
└── .gitignore
```

## Database Schema (17 tables)

| Table | Purpose |
|-------|---------|
| `users` | Staff accounts (admin, clerk, reader, cashier, manager) with bcrypt passwords |
| `zones` | Geographic zones (e.g., "Embu Town", "Manyatta") |
| `routes` | Meter reading routes within zones, assigned to readers |
| `customers` | Customer accounts with running balance, property type, connection status |
| `meters` | Meters linked to customers with serial, size, GPS, status |
| `meter_replacements` | Meter swap history |
| `meter_readings` | Readings with consumption calc, anomaly flags, photo URLs |
| `tariff_configs` | Tariff sets per property type with standing charge, sewerage rate |
| `tariff_tiers` | Tiered rate bands (0-6m3, 7-20m3, etc.) within each tariff config |
| `bills` | Generated bills with itemized charges, arrears b/f, balance |
| `bill_items` | Line items per bill (each water tier, sewerage, standing, etc.) |
| `payments` | All payments (cash, bank, M-Pesa) with FIFO bill application |
| `mpesa_transactions` | Raw M-Pesa callback data, reconciliation status |
| `arrears_actions` | Disconnection notices, reconnections, penalty history |
| `payment_plans` + `payment_plan_installments` | Installment agreements for arrears |
| `sms_logs` + `sms_templates` | SMS delivery tracking and configurable templates |
| `audit_logs` | Full audit trail (user, action, entity, old/new values) |
| `company_settings` | Key-value config (company details, paybill, penalty rates) |
| `financial_periods` | Billing periods with open/closed status |
| `customer_portal_tokens` | Separate auth tokens for customer self-service |

**Key relationships:**
- Customer -> Zone, Route, Meter(s), Bills, Payments
- Meter -> Readings -> Bills
- Bill -> Bill Items, Payments
- M-Pesa Transaction -> Payment (via reconciliation)

## Core Business Logic

### Tiered Tariff Calculation (`billingCalculator.js`)
- Fetch active tariff for customer's property type
- Walk through tiers ascending: allocate consumption units to each tier, multiply by rate
- Add sewerage surcharge (% of water charge), standing charge, meter rent
- Add arrears brought forward (customer.balance)
- All operations in MySQL transaction

### Payment Application (FIFO)
- Apply payment to oldest unpaid bill first
- Update bill.amount_paid and bill.status (partial/paid)
- Update customer.balance (decrease)
- Overpayment carries forward as credit (negative balance)

### M-Pesa Integration
- **C2B flow:** Customer pays via Paybill -> Safaricom calls validation endpoint (verify account exists) -> confirmation endpoint (save transaction, auto-reconcile by matching BillRefNumber to customer account_number, create payment, apply FIFO, send SMS)
- **STK Push:** Staff/customer initiates from UI -> server calls Daraja STK Push API -> customer gets PIN prompt on phone -> callback processes same as C2B
- Unmatched transactions appear on reconciliation dashboard for manual matching

### Anomaly Detection (on reading entry)
- Negative consumption -> flag (possible tampering)
- Zero consumption -> flag (faulty meter)
- >3x average of last 3 months -> flag (possible leak)
- <0.3x average -> flag (possible bypass)

## User Roles & Access

| Module | Admin | Manager | Clerk | Cashier | Reader | Customer |
|--------|-------|---------|-------|---------|--------|----------|
| User management | Full | - | - | - | - | - |
| Settings/Tariffs | Full | - | - | - | - | - |
| Customers | Full | View | Full | Search | - | Own profile |
| Meters | Full | View | Full | - | - | - |
| Readings | Full | - | Full | - | Own routes | - |
| Billing | Full | View | Generate | - | - | Own bills |
| Payments | Full | View | Record | Record+Reconcile | - | Own payments |
| Reports | Full | Full | - | Own daily | - | Own consumption |
| SMS | Full | - | Send | - | - | - |
| Arrears | Full | View | View | - | - | - |
| Audit logs | Full | - | - | - | - | - |

## Implementation Order

### Phase 1: Foundation
1. Scaffold Vite + React client with Tailwind
2. Scaffold Express server with mysql2 pool
3. Run all 14 database migrations + seed data
4. Build auth module (login, JWT, refresh, middleware, role authorization)
5. Build DashboardLayout (sidebar, topbar, routing skeleton)
6. Build user management CRUD (admin-only)

### Phase 2: Core Data
7. Zones and routes management (settings pages)
8. Customer management (registration form, list/search/filter, detail page, account number generation)
9. Meter management (register to customer, list, detail, replacement flow)
10. Shared components: DataTable, StatCard, SearchableSelect, PhoneInput, ConfirmDialog

### Phase 3: Billing Engine
11. Tariff configuration CRUD (configs + tiers)
12. Financial period management
13. Meter reading entry (mobile-optimized, route-based, camera capture, anomaly detection)
14. Billing calculator (tiered tariff algorithm)
15. Bill generation (batch + single), bill list/detail
16. Bill PDF generation (EWASCO letterhead, itemized charges, M-Pesa payment instructions)

### Phase 4: Payments
17. Cash/bank payment recording with FIFO application
18. Receipt PDF generation (KRA-compliant)
19. M-Pesa STK Push (Daraja API client, initiate + callback)
20. M-Pesa C2B (register URLs, validation + confirmation callbacks)
21. Auto-reconciliation + manual reconciliation dashboard

### Phase 5: Arrears & Notifications
22. Arrears tracking + aging report (30/60/90+ days)
23. Disconnection/reconnection workflow
24. Payment plans (installment management)
25. SMS integration (Africa's Talking: bill notifications, payment confirmations, warnings)
26. Scheduled jobs (auto billing, arrears check, disconnection notices, M-Pesa reconciliation)

### Phase 6: Reports & Analytics
27. Role-specific dashboards with KPI stat cards and charts (Recharts)
28. Revenue, collection efficiency, NRW, consumption trend, zone reports
29. Excel/PDF export for all reports

### Phase 7: Customer Portal
30. Customer portal auth (separate login flow with account_number + password)
31. Portal pages: dashboard, bills, payments, consumption chart, profile
32. STK Push from portal (customer-initiated payment)
33. Audit trail middleware + audit log viewer
34. Final polish: error states, loading states, empty states, responsive testing

## Key Files

| File | Purpose |
|------|---------|
| `server/src/utils/billingCalculator.js` | Core tiered tariff calculation algorithm |
| `server/src/services/billing.service.js` | Bill generation orchestrator (reading -> calc -> bill -> PDF -> SMS) |
| `server/src/services/mpesa.service.js` | Daraja API client (OAuth, STK Push, C2B, reconciliation) |
| `server/src/services/payment.service.js` | FIFO payment application + balance management |
| `server/src/middleware/auth.js` | JWT verification for staff + customer portal |
| `server/src/middleware/authorize.js` | Role-based access control factory |
| `server/database/migrations/*` | All 14 schema migration files |
| `client/src/pages/readings/ReadingEntryPage.jsx` | Mobile-first meter reading UI (most field-critical) |
| `client/src/layouts/DashboardLayout.jsx` | Main app shell (sidebar, topbar, breadcrumbs) |

## Verification Plan

1. **Database:** Run migrations, verify all 17 tables created with correct relationships
2. **Auth:** Test staff login, role-based route protection, token refresh, customer portal login
3. **Customer flow:** Register customer -> assign meter -> enter reading -> generate bill -> verify PDF
4. **Payment flow:** Record cash payment -> verify FIFO application -> check balance update -> verify receipt PDF
5. **M-Pesa:** Test STK Push in Daraja sandbox -> verify callback processing -> check auto-reconciliation
6. **Billing calc:** Unit test tiered tariff calculator with known inputs/outputs for each property type
7. **Anomaly detection:** Submit readings with extreme values -> verify flags appear
8. **Reports:** Generate bills + payments -> verify dashboard KPIs and report data accuracy
9. **Customer portal:** Login as customer -> view bills, payments, consumption chart
10. **Responsive:** Test meter reading entry page on mobile viewport (375px)
