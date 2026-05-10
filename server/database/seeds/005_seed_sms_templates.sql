-- Insert SMS templates
INSERT INTO sms_templates (name, purpose, template, variables, is_active, created_by, created_at) VALUES
(
    'Bill Notification',
    'bill_notification',
    'Dear {{customer_name}}, your EWASCO water bill for {{billing_period}} is KES {{amount}}. Due date: {{due_date}}. Pay via M-Pesa Paybill {{paybill}} Account {{account_number}}.',
    '["customer_name", "billing_period", "amount", "due_date", "paybill", "account_number"]',
    TRUE,
    1,
    NOW()
),
(
    'Payment Confirmation',
    'payment_confirmation',
    'Dear {{customer_name}}, we have received your payment of KES {{amount}}. Your new balance is KES {{balance}}. Thank you for choosing EWASCO.',
    '["customer_name", "amount", "balance"]',
    TRUE,
    1,
    NOW()
),
(
    'Payment Reminder',
    'payment_reminder',
    'Dear {{customer_name}}, this is a friendly reminder that your EWASCO water bill of KES {{amount}} is due on {{due_date}}. Please pay promptly to avoid penalties.',
    '["customer_name", "amount", "due_date"]',
    TRUE,
    1,
    NOW()
),
(
    'Disconnection Notice',
    'disconnection_notice',
    'Dear {{customer_name}}, your water service is scheduled for disconnection due to an outstanding balance of KES {{balance}}. Please clear your bill immediately to avoid disconnection.',
    '["customer_name", "balance"]',
    TRUE,
    1,
    NOW()
),
(
    'Welcome Message',
    'welcome',
    'Welcome to EWASCO! Your account {{account_number}} has been created. Access our customer portal at portal.ewasco.co.ke or call {{phone}} for assistance.',
    '["account_number", "phone"]',
    TRUE,
    1,
    NOW()
)
ON DUPLICATE KEY UPDATE updated_at = NOW();
