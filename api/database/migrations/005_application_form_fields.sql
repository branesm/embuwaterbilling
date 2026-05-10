-- Lookup table for customer types
CREATE TABLE IF NOT EXISTS customer_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lookup table for companies
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE,
    address TEXT,
    telephone VARCHAR(20),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lookup table for bill dispatch methods
CREATE TABLE IF NOT EXISTS bill_dispatch_methods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns to customers table for application form
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS customer_type_id INTEGER REFERENCES customer_types(id),
    ADD COLUMN IF NOT EXISTS landlord_name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS house_no VARCHAR(50),
    ADD COLUMN IF NOT EXISTS estate VARCHAR(100),
    ADD COLUMN IF NOT EXISTS application_date DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS employer_cert VARCHAR(200),
    ADD COLUMN IF NOT EXISTS comments TEXT,
    ADD COLUMN IF NOT EXISTS charge_refuse BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id),
    ADD COLUMN IF NOT EXISTS connected_to_sewer BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS managed_by_ewasco BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS latitude DECIMAL(12, 8),
    ADD COLUMN IF NOT EXISTS longitude DECIMAL(12, 8),
    ADD COLUMN IF NOT EXISTS bill_dispatch_method_id INTEGER REFERENCES bill_dispatch_methods(id),
    ADD COLUMN IF NOT EXISTS disconnection_profile_id INTEGER REFERENCES disconnection_profiles(id);

-- Seed default customer types
INSERT INTO customer_types (name, description) VALUES
('Individual', 'Residential individual customer'),
('Company', 'Corporate or business customer'),
('Institution', 'School, hospital, or government institution'),
('NGO', 'Non-governmental organization')
ON CONFLICT DO NOTHING;

-- Seed default bill dispatch methods
INSERT INTO bill_dispatch_methods (name, description) VALUES
('SMS', 'Bill notification via SMS'),
('Email', 'Bill notification via Email'),
('Post', 'Bill sent via postal mail'),
('Pickup', 'Customer picks up bill at office')
ON CONFLICT DO NOTHING;

-- Seed default company (EWASCO)
INSERT INTO companies (name, code, address, telephone, email) VALUES
('Embu Water and Sanitation Company', 'EWASCO', 'P.O. Box 123, Embu', '+254 712 345678', 'info@ewasco.co.ke')
ON CONFLICT DO NOTHING;
