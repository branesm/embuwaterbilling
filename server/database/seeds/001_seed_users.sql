-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, is_active, created_at) 
VALUES (
    'admin',
    'admin@ewasco.co.ke',
    '$2a$10$4PgxLpS1ikUoAOwr.sRMD.1PI7CxoVKStdqbD..PH7SVAhZWQyKmm',
    'System',
    'Administrator',
    '+254712345678',
    'admin',
    TRUE,
    NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert sample manager
INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, is_active, created_by, created_at) 
VALUES (
    'manager',
    'manager@ewasco.co.ke',
    '$2a$10$4PgxLpS1ikUoAOwr.sRMD.1PI7CxoVKStdqbD..PH7SVAhZWQyKmm',
    'John',
    'Manager',
    '+254712345679',
    'manager',
    TRUE,
    1,
    NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert sample clerk
INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, is_active, created_by, created_at) 
VALUES (
    'clerk',
    'clerk@ewasco.co.ke',
    '$2a$10$4PgxLpS1ikUoAOwr.sRMD.1PI7CxoVKStdqbD..PH7SVAhZWQyKmm',
    'Jane',
    'Clerk',
    '+254712345680',
    'clerk',
    TRUE,
    1,
    NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert sample cashier
INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, is_active, created_by, created_at) 
VALUES (
    'cashier',
    'cashier@ewasco.co.ke',
    '$2a$10$4PgxLpS1ikUoAOwr.sRMD.1PI7CxoVKStdqbD..PH7SVAhZWQyKmm',
    'Peter',
    'Cashier',
    '+254712345681',
    'cashier',
    TRUE,
    1,
    NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert sample meter reader
INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, is_active, created_by, created_at) 
VALUES (
    'reader',
    'reader@ewasco.co.ke',
    '$2a$10$4PgxLpS1ikUoAOwr.sRMD.1PI7CxoVKStdqbD..PH7SVAhZWQyKmm',
    'Mary',
    'Reader',
    '+254712345682',
    'reader',
    TRUE,
    1,
    NOW()
) ON DUPLICATE KEY UPDATE updated_at = NOW();
