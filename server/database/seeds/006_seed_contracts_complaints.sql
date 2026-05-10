-- Insert billing groups
INSERT INTO billing_groups (group_code, group_name, description, zone_id) VALUES
('BG001', 'Embu Town Central', 'Central business district and surrounding areas', 1),
('BG002', 'Embu Town East', 'Eastern residential areas', 1),
('BG003', 'Kiritiri', 'Kiritiri trading center and environs', 2),
('BG004', 'Runyenjes', 'Runyenjes town and surrounding areas', 3)
ON DUPLICATE KEY UPDATE group_name = VALUES(group_name);

-- Insert contracts for existing customers
INSERT INTO contracts (
    contract_number, customer_id, billing_group_id, tariff_category_id, tariff_config_id,
    connection_date, status, deposit_amount, zone_id, route_id, plot_number, 
    physical_address, meter_id, service_type, connection_size, created_by
) VALUES
('CNT-2024-0001', 1, 1, 1, 1, '2024-01-15', 'active', 2500.00, 1, 1, 'PLOT-001', 
 '123 Main Street, Embu Town', 1, 'water', '1/2 inch', 1),
('CNT-2024-0002', 2, 1, 1, 1, '2024-02-01', 'active', 2500.00, 1, 1, 'PLOT-002',
 '456 Market Road, Embu Town', 2, 'water', '1/2 inch', 1),
('CNT-2024-0003', 3, 2, 2, 2, '2024-01-20', 'active', 5000.00, 1, 2, 'PLOT-003',
 '789 Commercial Ave, Embu Town', 3, 'both', '1 inch', 1),
('CNT-2024-0004', 4, 3, 1, 1, '2024-03-01', 'active', 2500.00, 2, 3, 'PLOT-004',
 '321 Kiritiri Road, Kiritiri', 4, 'water', '1/2 inch', 1),
('CNT-2024-0005', 5, 4, 3, 3, '2024-02-15', 'suspended', 10000.00, 3, 4, 'PLOT-005',
 '654 Industrial Zone, Runyenjes', 5, 'both', '2 inch', 1)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert contract history
INSERT INTO contract_history (contract_id, change_type, old_values, new_values, changed_by, change_reason) VALUES
(1, 'created', NULL, '{"status": "active", "meter_id": 1}', 1, 'Initial contract creation'),
(2, 'created', NULL, '{"status": "active", "meter_id": 2}', 1, 'Initial contract creation'),
(5, 'suspended', '{"status": "active"}', '{"status": "suspended"}', 1, 'Non-payment for 3 months')
ON DUPLICATE KEY UPDATE created_at = created_at;

-- Insert sample complaints
INSERT INTO complaints (
    complaint_number, customer_id, contract_id, category, priority, status,
    subject, description, assigned_to, created_by
) VALUES
('COMP-2024-0001', 1, 1, 'billing', 'medium', 'resolved',
 'Incorrect bill amount', 'My bill shows consumption of 100 units but I was away for the month', 4, 1),
('COMP-2024-0002', 2, 2, 'leakage', 'high', 'in_progress',
 'Water leak at meter', 'There is a leak at the meter connection point', 5, 1),
('COMP-2024-0003', 3, 3, 'meter', 'urgent', 'open',
 'Meter not working', 'Meter stopped working 3 days ago, no water supply', NULL, 1),
('COMP-2024-0004', 4, 4, 'water_quality', 'medium', 'assigned',
 'Dirty water', 'Water coming out brown and dirty for the past week', 4, 1),
('COMP-2024-0005', 5, 5, 'billing', 'low', 'closed',
 'Request for statement', 'Need detailed statement for the last 6 months', 1, 1)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert sample disconnections
INSERT INTO disconnections (
    contract_id, customer_id, disconnection_type, reason, outstanding_amount,
    bill_ids, disconnection_date, disconnected_by, meter_reading_at_disconnection,
    is_reconnected, reconnection_date, reconnected_by, reconnection_fee, amount_paid,
    approved_by, approved_at, created_by
) VALUES
(5, 5, 'non_payment', 'Outstanding balance for 3 months', 15000.00,
 '[1, 2, 3]', '2024-03-15', 3, 1250.50, FALSE, NULL, NULL, 500.00, 0.00,
 1, NOW(), 1)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert sample bill adjustments
INSERT INTO bill_adjustments (
    bill_id, contract_id, adjustment_type, amount, reason_code, description,
    requested_by, approved_by, approval_date, status
) VALUES
(1, 1, 'billing_correction', -500.00, 'OVERCHARGE', 'Customer overcharged due to incorrect reading',
 2, 1, NOW(), 'approved'),
(2, 2, 'meter_adjustment', 300.00, 'METER_FAULT', 'Adjustment for faulty meter period',
 2, 1, NOW(), 'approved')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert sample installment plan
INSERT INTO installment_plans (
    contract_id, customer_id, total_amount, installment_amount, number_of_installments,
    frequency, start_date, end_date, status, paid_installments, remaining_amount,
    approved_by, approved_at, created_by
) VALUES
(4, 4, 12000.00, 2000.00, 6, 'monthly', '2024-01-01', '2024-06-30', 'active', 2, 8000.00,
 1, NOW(), 1)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert installment payments
INSERT INTO installment_payments (plan_id, installment_number, amount, due_date, paid_date, payment_id_ref, status) VALUES
(1, 1, 2000.00, '2024-01-31', '2024-01-28', 1, 'paid'),
(1, 2, 2000.00, '2024-02-29', '2024-02-25', 2, 'paid'),
(1, 3, 2000.00, '2024-03-31', NULL, NULL, 'pending'),
(1, 4, 2000.00, '2024-04-30', NULL, NULL, 'pending'),
(1, 5, 2000.00, '2024-05-31', NULL, NULL, 'pending'),
(1, 6, 2000.00, '2024-06-30', NULL, NULL, 'pending')
ON DUPLICATE KEY UPDATE status = VALUES(status);
