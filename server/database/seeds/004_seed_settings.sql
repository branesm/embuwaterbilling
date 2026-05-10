-- Insert company settings
INSERT INTO company_settings (setting_key, setting_value, setting_type, description, is_editable, created_at) VALUES
('company_name', 'Embu Water and Sanitation Company', 'string', 'Official company name', TRUE, NOW()),
('company_short_name', 'EWASCO', 'string', 'Short name/acronym', TRUE, NOW()),
('company_address', 'P.O. Box 123, Embu', 'string', 'Postal address', TRUE, NOW()),
('company_phone', '+254 68 12345', 'string', 'Main phone number', TRUE, NOW()),
('company_email', 'info@ewasco.co.ke', 'string', 'Main email address', TRUE, NOW()),
('company_website', 'www.ewasco.co.ke', 'string', 'Company website', TRUE, NOW()),
('kra_pin', 'P051234567X', 'string', 'KRA PIN number', TRUE, NOW()),
('mpesa_paybill', '123456', 'string', 'M-Pesa paybill number', TRUE, NOW()),
('mpesa_account_prefix', 'EWASCO', 'string', 'M-Pesa account prefix', TRUE, NOW()),
('currency', 'KES', 'string', 'Currency code', FALSE, NOW()),
('currency_symbol', 'KSh', 'string', 'Currency symbol', FALSE, NOW()),
('bill_due_days', '14', 'number', 'Number of days until bill is due', TRUE, NOW()),
('penalty_rate', '2.5', 'number', 'Monthly penalty percentage for late payment', TRUE, NOW()),
('disconnection_threshold', '1000', 'number', 'Balance threshold for disconnection notice', TRUE, NOW()),
('reconnection_fee', '500', 'number', 'Fee for reconnection after disconnection', TRUE, NOW()),
('vat_rate', '0', 'number', 'VAT rate percentage (0 if exempt)', TRUE, NOW()),
('sms_enabled', 'false', 'boolean', 'Enable SMS notifications', TRUE, NOW()),
('auto_bill_generation', 'false', 'boolean', 'Automatically generate bills at period end', TRUE, NOW())
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Insert current financial period
INSERT INTO financial_periods (name, year, month, start_date, end_date, due_date, status, created_at) VALUES
('January 2024', 2024, 1, '2024-01-01', '2024-01-31', '2024-02-14', 'closed', NOW()),
('February 2024', 2024, 2, '2024-02-01', '2024-02-29', '2024-03-14', 'closed', NOW()),
('March 2024', 2024, 3, '2024-03-01', '2024-03-31', '2024-04-14', 'closed', NOW()),
('April 2024', 2024, 4, '2024-04-01', '2024-04-30', '2024-05-14', 'open', NOW())
ON DUPLICATE KEY UPDATE status = VALUES(status);
