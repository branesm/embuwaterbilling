-- =====================================================
-- PHASE 1: CUSTOMER ACCOUNT LIFECYCLE
-- =====================================================

-- Add lifecycle tracking columns to customers
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS last_disconnection_date DATE,
    ADD COLUMN IF NOT EXISTS last_reconnection_date DATE,
    ADD COLUMN IF NOT EXISTS last_suspension_date DATE,
    ADD COLUMN IF NOT EXISTS terminate_date DATE,
    ADD COLUMN IF NOT EXISTS status_reason TEXT,
    ADD COLUMN IF NOT EXISTS status_reference VARCHAR(100),
    ADD COLUMN IF NOT EXISTS status_ledger_no VARCHAR(100),
    ADD COLUMN IF NOT EXISTS status_changed_by INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP;

-- Customer status history (tracks every status change)
CREATE TABLE IF NOT EXISTS customer_status_history (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    reason TEXT,
    reference VARCHAR(100),
    ledger_no VARCHAR(100),
    comments TEXT,
    changed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_status_history_customer ON customer_status_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_status_history_created ON customer_status_history(created_at);

-- Contract transfers (transfer account to new owner)
CREATE TABLE IF NOT EXISTS contract_transfers (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    old_account_no VARCHAR(50),
    old_name VARCHAR(200),
    old_national_id VARCHAR(50),
    new_name VARCHAR(200) NOT NULL,
    new_first_name VARCHAR(100),
    new_last_name VARCHAR(100),
    new_national_id VARCHAR(50),
    new_telephone VARCHAR(20),
    new_email VARCHAR(100),
    transfer_date DATE DEFAULT CURRENT_DATE,
    transfer_reason TEXT,
    reference_no VARCHAR(100),
    processed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contract_transfers_customer ON contract_transfers(customer_id);

-- Connection payments (activation fees, deposits)
CREATE TABLE IF NOT EXISTS connection_payments (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    payment_type VARCHAR(50) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    receipt_no VARCHAR(100),
    payment_date DATE DEFAULT CURRENT_DATE,
    fee_date DATE,
    deposit_date DATE,
    payment_mode VARCHAR(50),
    bank_account VARCHAR(100),
    reference VARCHAR(100),
    comments TEXT,
    processed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_connection_payments_customer ON connection_payments(customer_id);

-- Customer terminations
CREATE TABLE IF NOT EXISTS customer_terminations (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    reference VARCHAR(100),
    ledger_no VARCHAR(100),
    terminate_date DATE NOT NULL,
    termination_comments TEXT,
    outstanding_debt DECIMAL(12,2) DEFAULT 0,
    deposit_refunded DECIMAL(12,2) DEFAULT 0,
    processed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_terminations_customer ON customer_terminations(customer_id);
