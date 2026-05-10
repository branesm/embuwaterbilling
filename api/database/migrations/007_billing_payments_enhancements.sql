-- =====================================================
-- PHASE 2: BILLING & PAYMENTS ENHANCEMENTS
-- =====================================================

-- Add penalty and interest tracking to bills
ALTER TABLE bills
    ADD COLUMN IF NOT EXISTS penalty_amount DECIMAL(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS interest_amount DECIMAL(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reprint_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_printed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS generated_by INTEGER REFERENCES users(id);

-- Bill reprints audit trail
CREATE TABLE IF NOT EXISTS bill_reprints (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
    reprint_reason TEXT,
    printed_by INTEGER REFERENCES users(id),
    printed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment plans (formal arrangements separate from debt schedules)
CREATE TABLE IF NOT EXISTS payment_plans (
    id SERIAL PRIMARY KEY,
    plan_no VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    total_amount DECIMAL(12,2) NOT NULL,
    down_payment DECIMAL(12,2) DEFAULT 0,
    installment_amount DECIMAL(12,2) NOT NULL,
    num_installments INTEGER NOT NULL,
    frequency VARCHAR(20) DEFAULT 'monthly',
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_plan_installments (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES payment_plans(id) ON DELETE CASCADE,
    installment_no INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    amount_paid DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    payment_id INTEGER REFERENCES payments(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Penalty rules configuration
CREATE TABLE IF NOT EXISTS penalty_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    days_overdue INTEGER NOT NULL,
    penalty_type VARCHAR(20) NOT NULL,
    penalty_value DECIMAL(12,2) NOT NULL,
    interest_rate DECIMAL(5,4) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default penalty rule
INSERT INTO penalty_rules (name, days_overdue, penalty_type, penalty_value, interest_rate)
VALUES ('Standard Late Payment', 14, 'fixed', 100.00, 0.0150)
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bills_penalty ON bills(penalty_amount) WHERE penalty_amount > 0;
CREATE INDEX IF NOT EXISTS idx_bill_reprints_bill ON bill_reprints(bill_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_customer ON payment_plans(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_status ON payment_plans(status);
CREATE INDEX IF NOT EXISTS idx_plan_installments_plan ON payment_plan_installments(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_installments_status ON payment_plan_installments(status);
