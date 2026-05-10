-- Insert sample tariff configs
INSERT INTO tariff_configs (name, property_type, standing_charge, sewerage_rate, meter_rent, is_active, effective_from, created_by, created_at) VALUES
('Residential Standard', 'residential', 100.00, 15.00, 50.00, TRUE, '2024-01-01', 1, NOW()),
('Commercial Standard', 'commercial', 200.00, 15.00, 50.00, TRUE, '2024-01-01', 1, NOW()),
('Industrial Standard', 'industrial', 500.00, 15.00, 100.00, TRUE, '2024-01-01', 1, NOW()),
('Institutional Standard', 'institutional', 150.00, 15.00, 50.00, TRUE, '2024-01-01', 1, NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert residential tariff tiers (0-6m3 @ KES 35, 7-20m3 @ KES 50, 21-50m3 @ KES 65, 51+ @ KES 80)
INSERT INTO tariff_tiers (tariff_config_id, tier_order, min_consumption, max_consumption, rate_per_unit, created_at) VALUES
(1, 1, 0, 6, 35.0000, NOW()),
(1, 2, 6.01, 20, 50.0000, NOW()),
(1, 3, 20.01, 50, 65.0000, NOW()),
(1, 4, 50.01, 999999, 80.0000, NOW())
ON DUPLICATE KEY UPDATE rate_per_unit = VALUES(rate_per_unit);

-- Insert commercial tariff tiers (flat rate @ KES 75)
INSERT INTO tariff_tiers (tariff_config_id, tier_order, min_consumption, max_consumption, rate_per_unit, created_at) VALUES
(2, 1, 0, 999999, 75.0000, NOW())
ON DUPLICATE KEY UPDATE rate_per_unit = VALUES(rate_per_unit);

-- Insert industrial tariff tiers (flat rate @ KES 90)
INSERT INTO tariff_tiers (tariff_config_id, tier_order, min_consumption, max_consumption, rate_per_unit, created_at) VALUES
(3, 1, 0, 999999, 90.0000, NOW())
ON DUPLICATE KEY UPDATE rate_per_unit = VALUES(rate_per_unit);

-- Insert institutional tariff tiers (flat rate @ KES 60)
INSERT INTO tariff_tiers (tariff_config_id, tier_order, min_consumption, max_consumption, rate_per_unit, created_at) VALUES
(4, 1, 0, 999999, 60.0000, NOW())
ON DUPLICATE KEY UPDATE rate_per_unit = VALUES(rate_per_unit);
