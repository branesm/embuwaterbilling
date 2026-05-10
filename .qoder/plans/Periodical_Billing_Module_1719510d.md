# Periodical Billing Module

## Current State
- **Backend** (`server/src/routes/billing.routes.js`): Has `GET /` (list) and `POST /generate` (single bill from reading). Already has `calculateBill()` with tiered tariff logic.
- **Frontend**: `BillingPage.jsx` is a stub. `BillSimulationPage.jsx` exists with simulation UI.
- **Database**: `bills` and `bill_items` tables exist with all needed columns (status, penalties, adjustments, balance).
- **Tariffs**: `tariff_configs` and `tariff_tiers` tables exist with tiered rate bands.

## Task 1: Database Migration for Billing Periods and Penalty Rules

Create `server/database/migrations/019_create_billing_periods.sql`:
- `billing_periods` table: id, period_code (e.g. "2026-05"), period_name, start_date, end_date, due_date, status (open/closed/generating), created_by, created_at
- `penalty_rules` table: id, name, grace_days, penalty_type (fixed/percentage), penalty_rate, max_penalty, is_active, created_at
- `bill_adjustments` table: id, bill_id, adjustment_type (debit/credit), amount, reason, approved_by, created_by, created_at
- `mass_billing_runs` table: id, period_id, route_id, zone_id, status (pending/running/completed/failed), total_customers, bills_generated, errors, started_at, completed_at, created_by

## Task 2: Enhance Backend Billing Routes

Extend `server/src/routes/billing.routes.js` with:
- `GET /periods` - List billing periods with status
- `POST /periods` - Create new billing period
- `PUT /periods/:id` - Update period (close/open)
- `GET /:id` - Full bill detail with items and customer info
- `POST /:id/adjust` - Create debit/credit adjustment (updates bill balance)
- `POST /:id/cancel` - Cancel bill (sets status=cancelled, reverses balance)
- `POST /:id/apply-penalty` - Apply penalty based on penalty_rules (adds to bill)
- `POST /mass-generate` - Mass bill generation: accepts period_id + optional route_id/zone_id, iterates unbilled readings for that period, generates bills in batch, returns run summary
- `GET /mass-runs` - List mass billing run history
- `GET /penalty-rules` - List penalty rules
- `POST /penalty-rules` - Create penalty rule

## Task 3: Build Full BillingPage Frontend

Replace stub `client/src/pages/billing/BillingPage.jsx` with a full-featured page:

**Tab 1 - Bills List:**
- Search by account number, customer name, bill number
- Filter by status (unpaid/partial/paid/overdue/cancelled), billing period, route
- Table: bill number, customer, period, amount, balance, status, actions
- Row actions: View detail modal, Adjust, Cancel, Apply penalty
- Bill detail modal showing all line items (tier breakdown), payment history

**Tab 2 - Mass Billing:**
- Select billing period from dropdown
- Optional filter by route or zone
- "Preview" button showing count of unbilled readings
- "Generate Bills" button triggering mass-generate
- Progress/results display: total generated, errors, time taken
- History of previous mass billing runs

**Tab 3 - Billing Periods:**
- List of periods with status badges (open/closed)
- Create new period form (code, name, dates, due date)
- Close/reopen period actions

**Tab 4 - Penalty Rules:**
- List active rules with grace days, type, rate
- Create/edit rule form

## Task 4: Wire Routes and Navigation

- Update `client/src/App.jsx` to ensure billing route points to new BillingPage
- Add sub-routes if needed: `/billing`, `/billing/simulation`
- Ensure sidebar navigation links work correctly

## Dependencies
- Task 1 (migration) must complete first
- Tasks 2 and 3 can run in parallel after Task 1
- Task 4 depends on Task 3

## Key Implementation Notes
- Use react-query v3 syntax: `useQuery(key, fn, options)` and `useMutation(fn, options)`
- Import API from `../../api/axios`
- Use lucide-react icons (Banknote, FileText, Calendar, AlertTriangle, etc.)
- Backend uses `executeQuery` and `withTransaction` from `../config/database`
- Mass billing should process in batches of 50 to avoid timeouts
- All monetary values use DECIMAL(12,2) in MySQL
