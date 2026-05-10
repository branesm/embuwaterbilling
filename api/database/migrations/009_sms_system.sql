-- SMS templates table
CREATE TABLE IF NOT EXISTS sms_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    purpose VARCHAR(30) NOT NULL CHECK (purpose IN ('bill_notification', 'payment_confirmation', 'payment_reminder', 'disconnection_notice', 'welcome', 'custom')),
    template TEXT NOT NULL,
    variables JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sms_templates_purpose ON sms_templates(purpose);
CREATE INDEX IF NOT EXISTS idx_sms_templates_active ON sms_templates(is_active);

-- SMS logs table - SMS delivery tracking
CREATE TABLE IF NOT EXISTS sms_logs (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    phone_number VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    provider_response TEXT,
    sent_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    cost DECIMAL(10, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_customer ON sms_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_phone ON sms_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at ON sms_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON sms_logs(created_at);

-- Insert default SMS templates
INSERT INTO sms_templates (name, purpose, template, variables) VALUES
('Bill Notification', 'bill_notification', 'Dear {{name}}, your water bill for {{period}} is KES {{amount}}. Due date: {{due_date}}. Pay via M-Pesa Paybill {{paybill}} Acc: {{account_no}}. EWASCO.', '["name","period","amount","due_date","paybill","account_no"]'),
('Payment Confirmation', 'payment_confirmation', 'Dear {{name}}, we have received KES {{amount}} via {{method}}. Receipt: {{receipt}}. Balance: KES {{balance}}. Thank you. EWASCO.', '["name","amount","method","receipt","balance"]'),
('Payment Reminder', 'payment_reminder', 'Dear {{name}}, your water bill balance is KES {{balance}}. Please pay before {{due_date}} to avoid disconnection. Paybill {{paybill}} Acc: {{account_no}}. EWASCO.', '["name","balance","due_date","paybill","account_no"]'),
('Disconnection Notice', 'disconnection_notice', 'Dear {{name}}, your water supply will be disconnected on {{date}} due to unpaid balance of KES {{balance}}. Pay immediately to avoid reconnection fees. EWASCO.', '["name","date","balance"]'),
('Welcome Message', 'welcome', 'Welcome to EWASCO, {{name}}! Your account {{account_no}} is now active. For queries call {{support_phone}}. EWASCO.', '["name","account_no","support_phone"]')
ON CONFLICT (name) DO NOTHING;
