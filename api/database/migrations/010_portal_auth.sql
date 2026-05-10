-- Add portal authentication fields to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_pin VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT TRUE;

-- Customer portal tokens table
CREATE TABLE IF NOT EXISTS customer_portal_tokens (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_tokens_customer ON customer_portal_tokens(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON customer_portal_tokens(token);

-- Update some existing customers with a default PIN for demo purposes
-- In production, customers would set their PIN via SMS or staff assistance
UPDATE customers SET portal_pin = RIGHT(telephone, 4) WHERE portal_pin IS NULL AND telephone IS NOT NULL;
