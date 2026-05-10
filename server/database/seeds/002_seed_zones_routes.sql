-- Insert sample zones
INSERT INTO zones (name, code, description, is_active, created_at) VALUES
('Embu Town', 'EMB01', 'Main town area including CBD', TRUE, NOW()),
('Manyatta', 'MAN01', 'Manyatta residential area', TRUE, NOW()),
('Kangaru', 'KAN01', 'Kangaru and surrounding areas', TRUE, NOW()),
('Blue Valley', 'BLU01', 'Blue Valley estate', TRUE, NOW()),
('Nembure', 'NEM01', 'Nembure trading center', TRUE, NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert sample routes
INSERT INTO routes (zone_id, name, code, description, reader_id, is_active, created_at) VALUES
(1, 'Town Centre A', 'TCA', 'Main street businesses', 5, TRUE, NOW()),
(1, 'Town Centre B', 'TCB', 'Residential blocks near CBD', 5, TRUE, NOW()),
(2, 'Manyatta North', 'MANN', 'Northern Manyatta area', 5, TRUE, NOW()),
(2, 'Manyatta South', 'MANS', 'Southern Manyatta area', 5, TRUE, NOW()),
(3, 'Kangaru East', 'KANE', 'Eastern Kangaru', 5, TRUE, NOW()),
(4, 'Blue Valley Phase 1', 'BVP1', 'First phase of Blue Valley', 5, TRUE, NOW()),
(5, 'Nembure Central', 'NEMC', 'Central Nembure', 5, TRUE, NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();
