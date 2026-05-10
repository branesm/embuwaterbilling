-- EWASCO Water Billing System - Schema Updates for Disconnections Module
-- Run order: 002_alter_disconnections.sql

-- Add missing columns to disconnections table
ALTER TABLE disconnections 
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ordered',
  ADD COLUMN IF NOT EXISTS disc_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reconnected_by VARCHAR(100);

-- Add disconnection_profile_id to customers (for profile assignment)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS disconnection_profile_id INTEGER REFERENCES disconnection_profiles(id);

-- Create customer_non_disconnections table
CREATE TABLE IF NOT EXISTS customer_non_disconnections (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    code_id INTEGER REFERENCES non_disconnection_codes(id),
    reason TEXT,
    valid_until DATE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_customer_non_disc_customer ON customer_non_disconnections(customer_id);
CREATE INDEX IF NOT EXISTS idx_disconnections_status ON disconnections(status);
CREATE INDEX IF NOT EXISTS idx_disconnections_date ON disconnections(disc_date);
