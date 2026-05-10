-- Seed customers for EWASCO
INSERT INTO customers (
    account_number, first_name, last_name, id_number, phone, email,
    property_type, zone_id, route_id, address, connection_status
) VALUES
('EW-2024-0001', 'John', 'Kamau', '12345678', '254712345678', 'john.kamau@email.com', 'residential', 1, 1, '123 Main Street, Embu Town', 'active'),
('EW-2024-0002', 'Mary', 'Wanjiku', '23456789', '254723456789', 'mary.wanjiku@email.com', 'residential', 1, 1, '456 Market Road, Embu Town', 'active'),
('EW-2024-0003', 'Peter', 'Mwangi', '34567890', '254734567890', 'peter.mwangi@email.com', 'commercial', 1, 2, '789 Commercial Ave, Embu Town', 'active'),
('EW-2024-0004', 'Jane', 'Njeri', '45678901', '254745678901', 'jane.njeri@email.com', 'residential', 2, 3, '321 Kiritiri Road, Kiritiri', 'active'),
('EW-2024-0005', 'James', 'Ochieng', '56789012', '254756789012', 'james.ochieng@email.com', 'industrial', 3, 4, '654 Industrial Zone, Runyenjes', 'disconnected')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Seed meters for customers
INSERT INTO meters (
    serial_number, meter_type, customer_id, status, installation_date,
    current_reading, meter_size
) VALUES
('MTR-001-2024', 'digital', 1, 'active', '2024-01-15', 1250, '15mm'),
('MTR-002-2024', 'digital', 2, 'active', '2024-02-01', 890, '15mm'),
('MTR-003-2024', 'analog', 3, 'active', '2024-01-20', 2450, '20mm'),
('MTR-004-2024', 'digital', 4, 'active', '2024-03-01', 560, '15mm'),
('MTR-005-2024', 'digital', 5, 'inactive', '2024-02-15', 3200, '25mm')
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Note: Bills will be generated through the billing API
