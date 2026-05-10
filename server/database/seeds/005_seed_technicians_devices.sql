-- Insert sample technicians
INSERT INTO technicians (employee_id, first_name, last_name, email, phone, department, status, created_by) VALUES
('TECH001', 'John', 'Kamau', 'john.kamau@ewasco.co.ke', '+254712345001', 'meter_reading', 'active', 1),
('TECH002', 'Mary', 'Wanjiku', 'mary.wanjiku@ewasco.co.ke', '+254712345002', 'meter_reading', 'active', 1),
('TECH003', 'Peter', 'Ochieng', 'peter.ochieng@ewasco.co.ke', '+254712345003', 'connections', 'active', 1),
('TECH004', 'Jane', 'Akinyi', 'jane.akinyi@ewasco.co.ke', '+254712345004', 'maintenance', 'active', 1),
('TECH005', 'James', 'Mwangi', 'james.mwangi@ewasco.co.ke', '+254712345005', 'leak_repair', 'active', 1)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert sample meter reading devices
INSERT INTO meter_devices (device_name, serial_number, device_tag, imei, phone_number, device_type, status, assigned_to, created_by) VALUES
('Samsung Tablet A1', 'SN123456789', 'DEV001', '354601080768XXX', '+254712345001', 'android', 'active', 1, 1),
('Samsung Tablet A2', 'SN123456790', 'DEV002', '354601080769XXX', '+254712345002', 'android', 'active', 2, 1),
('Samsung Tablet A3', 'SN123456791', 'DEV003', '354601080770XXX', '+254712345003', 'android', 'active', 3, 1),
('Samsung Tablet A4', 'SN123456792', 'DEV004', '354601080771XXX', NULL, 'android', 'inactive', NULL, 1),
('Samsung Tablet A5', 'SN123456793', 'DEV005', '354601080772XXX', NULL, 'android', 'active', NULL, 1)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert sample work orders
INSERT INTO work_orders (
    work_order_number, work_order_type, priority, status, customer_id, customer_name, 
    customer_phone, account_number, meter_number, description, instructions, 
    estimated_cost, assigned_to, scheduled_date, created_by
) VALUES
('WO-2024-0001', 'new_connection', 'high', 'pending', 1, 'Test Customer', '+254712345678', 'EW2400001', 'MTR001', 
 'Install new water connection for residential customer', 'Bring 1/2 inch meter and fittings', 2500.00, NULL, '2024-04-25', 1),
('WO-2024-0002', 'meter_replacement', 'medium', 'assigned', 2, 'Test Customer 2', '+254712345679', 'EW2400002', 'MTR002',
 'Replace faulty meter showing incorrect readings', 'Check for leaks before replacement', 1500.00, 1, '2024-04-22', 1),
('WO-2024-0003', 'leak_repair', 'urgent', 'in_progress', 3, 'Test Customer 3', '+254712345680', 'EW2400003', 'MTR003',
 'Major leak reported on main line', 'Emergency repair required', 5000.00, 5, '2024-04-20', 1),
('WO-2024-0004', 'complaint', 'low', 'completed', 4, 'Test Customer 4', '+254712345681', 'EW2400004', 'MTR004',
 'Customer complaint about water quality', 'Test water samples', 0.00, 4, '2024-04-18', 1),
('WO-2024-0005', 'disconnection', 'medium', 'assigned', 5, 'Test Customer 5', '+254712345682', 'EW2400005', 'MTR005',
 'Disconnect service for non-payment', 'Verify outstanding balance before disconnection', 500.00, 3, '2024-04-23', 1)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert work order comments
INSERT INTO work_order_comments (work_order_id, comment, comment_type, created_by) VALUES
(3, 'Technician dispatched to site', 'update', 1),
(3, 'Leak located at junction box, parts ordered', 'update', 5),
(4, 'Water samples collected for lab testing', 'update', 4),
(4, 'Test results show normal chlorine levels', 'resolution', 4),
(5, 'Customer contacted and given 24hr notice', 'note', 3)
ON DUPLICATE KEY UPDATE created_at = created_at;
