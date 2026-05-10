-- Add KRA PIN to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS kra_pin VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_customers_kra_pin ON customers(kra_pin);
CREATE INDEX IF NOT EXISTS idx_customers_national_id ON customers(national_id);
CREATE INDEX IF NOT EXISTS idx_customers_plot_no ON customers(plot_no);

-- Customer documents table for attachments
CREATE TABLE IF NOT EXISTS customer_documents (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_documents_customer ON customer_documents(customer_id);
