-- M-Pesa transactions table
CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id SERIAL PRIMARY KEY,
    transaction_type VARCHAR(20) NOT NULL,
    trans_id VARCHAR(50),
    merchant_request_id VARCHAR(100),
    checkout_request_id VARCHAR(100),
    trans_time VARCHAR(20),
    transaction_date TIMESTAMP,
    trans_amount DECIMAL(12, 2) DEFAULT 0,
    business_shortcode VARCHAR(20),
    bill_ref_number VARCHAR(50),
    msisdn VARCHAR(20),
    first_name VARCHAR(50),
    middle_name VARCHAR(50),
    last_name VARCHAR(50),
    mpesa_receipt_number VARCHAR(50),
    result_code VARCHAR(10),
    result_desc TEXT,
    raw_payload JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    is_reconciled BOOLEAN DEFAULT FALSE,
    payment_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mpesa_checkout ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_merchant ON mpesa_transactions(merchant_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_bill_ref ON mpesa_transactions(bill_ref_number);
CREATE INDEX IF NOT EXISTS idx_mpesa_status ON mpesa_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_msisdn ON mpesa_transactions(msisdn);
CREATE INDEX IF NOT EXISTS idx_mpesa_created ON mpesa_transactions(created_at);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_mpesa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mpesa_updated_at ON mpesa_transactions;
CREATE TRIGGER mpesa_updated_at
    BEFORE UPDATE ON mpesa_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_mpesa_updated_at();
