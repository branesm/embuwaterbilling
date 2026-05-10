-- EWASCO Water Billing System - PostgreSQL Schema
-- Run order: 001_init_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- LOOKUP / PARAMETERS TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    is_editable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_groups (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    area_code VARCHAR(10),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_routes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    billing_group_id INTEGER REFERENCES billing_groups(id),
    walk_no VARCHAR(20),
    reader_id INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS zones (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_id INTEGER REFERENCES zones(id),
    level INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_typologies (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tariff_categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tariff_lines (
    id SERIAL PRIMARY KEY,
    tariff_category_id INTEGER REFERENCES tariff_categories(id) ON DELETE CASCADE,
    min_units DECIMAL(12,2) NOT NULL,
    max_units DECIMAL(12,2) NOT NULL,
    rate DECIMAL(12,4) NOT NULL,
    fixed_charge DECIMAL(12,2) DEFAULT 0,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reading_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    affects_billing BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_modes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS disconnection_profiles (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    min_balance DECIMAL(12,2) NOT NULL,
    min_months_unpaid INTEGER NOT NULL,
    auto_disconnect BOOLEAN DEFAULT FALSE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS disconnection_modes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS non_disconnection_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS misc_bill_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    default_amount DECIMAL(12,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SECURITY & USERS
-- =====================================================

CREATE TABLE IF NOT EXISTS user_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    other_names VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    group_id INTEGER REFERENCES user_groups(id),
    status VARCHAR(20) DEFAULT 'active',
    last_login TIMESTAMP,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CUSTOMERS & CONTRACTS
-- =====================================================

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    account_no VARCHAR(50) UNIQUE NOT NULL,
    contract_no VARCHAR(50) UNIQUE,
    conn_no VARCHAR(50),
    name VARCHAR(200) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    national_id VARCHAR(50),
    category_id INTEGER REFERENCES customer_categories(id),
    typology_id INTEGER REFERENCES customer_typologies(id),
    billing_group_id INTEGER REFERENCES billing_groups(id),
    route_id INTEGER REFERENCES billing_routes(id),
    walk_no VARCHAR(20),
    zone_id INTEGER REFERENCES zones(id),
    address TEXT,
    town VARCHAR(100),
    po_box VARCHAR(50),
    plot_no VARCHAR(50),
    telephone VARCHAR(20),
    email VARCHAR(100),
    dma_id INTEGER,
    account_status VARCHAR(20) DEFAULT 'active',
    balance DECIMAL(12,2) DEFAULT 0,
    deposit_amount DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contract_history (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by INTEGER REFERENCES users(id),
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- METER MANAGEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS meter_types (
    id SERIAL PRIMARY KEY,
    type_id VARCHAR(20) UNIQUE NOT NULL,
    manufacturer VARCHAR(100),
    category VARCHAR(50),
    model VARCHAR(100),
    meter_size VARCHAR(20),
    normal_consumption DECIMAL(10,2),
    number_of_digits INTEGER DEFAULT 6,
    tariff_for_rent DECIMAL(12,2),
    rent_value DECIMAL(12,2) DEFAULT 0,
    expected_years INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meters (
    id SERIAL PRIMARY KEY,
    meter_no VARCHAR(50) UNIQUE NOT NULL,
    meter_type_id INTEGER REFERENCES meter_types(id),
    meter_status VARCHAR(20) DEFAULT 'in_store',
    meter_location VARCHAR(100),
    customer_id INTEGER REFERENCES customers(id),
    install_date DATE,
    barcode_no VARCHAR(100),
    digits INTEGER DEFAULT 6,
    max_reading DECIMAL(12,2),
    current_reading DECIMAL(12,2) DEFAULT 0,
    dma_id INTEGER,
    condition VARCHAR(50) DEFAULT 'new',
    supplier VARCHAR(100),
    manufacture_date DATE,
    expected_years INTEGER,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meter_movements (
    id SERIAL PRIMARY KEY,
    meter_id INTEGER REFERENCES meters(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL,
    from_customer_id INTEGER REFERENCES customers(id),
    to_customer_id INTEGER REFERENCES customers(id),
    from_status VARCHAR(20),
    to_status VARCHAR(20),
    performed_by INTEGER REFERENCES users(id),
    movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reference_no VARCHAR(50),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meter_replacements (
    id SERIAL PRIMARY KEY,
    old_meter_id INTEGER REFERENCES meters(id),
    new_meter_id INTEGER REFERENCES meters(id),
    customer_id INTEGER REFERENCES customers(id),
    replacement_date DATE NOT NULL,
    old_final_reading DECIMAL(12,2) NOT NULL,
    new_initial_reading DECIMAL(12,2) DEFAULT 0,
    reason TEXT,
    performed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meter_servicing (
    id SERIAL PRIMARY KEY,
    meter_id INTEGER REFERENCES meters(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id),
    serviced_by INTEGER REFERENCES users(id),
    reading DECIMAL(12,2),
    service_date DATE,
    meter_status VARCHAR(20),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- MASTER METERS (NRW)
-- =====================================================

CREATE TABLE IF NOT EXISTS dma_regions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_id INTEGER REFERENCES dma_regions(id),
    region_type VARCHAR(20) DEFAULT 'dma',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS master_meters (
    id SERIAL PRIMARY KEY,
    serial_no VARCHAR(50) UNIQUE NOT NULL,
    location VARCHAR(200),
    meter_size VARCHAR(20),
    meter_status VARCHAR(20) DEFAULT 'active',
    install_date DATE,
    northings DECIMAL(12,6),
    eastings DECIMAL(12,6),
    height DECIMAL(10,2),
    inflow_dma_id INTEGER REFERENCES dma_regions(id),
    outflow_dma_id INTEGER REFERENCES dma_regions(id),
    current_reading DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- BILLING
-- =====================================================

CREATE TABLE IF NOT EXISTS financial_periods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meter_readings (
    id SERIAL PRIMARY KEY,
    meter_id INTEGER REFERENCES meters(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id),
    reading_date DATE NOT NULL,
    previous_reading DECIMAL(12,2) NOT NULL,
    current_reading DECIMAL(12,2) NOT NULL,
    consumption DECIMAL(12,2) NOT NULL,
    reading_code_id INTEGER REFERENCES reading_codes(id),
    reader_id INTEGER REFERENCES users(id),
    billing_period_id INTEGER REFERENCES financial_periods(id),
    is_estimated BOOLEAN DEFAULT FALSE,
    anomaly_flag BOOLEAN DEFAULT FALSE,
    photo_url VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bills (
    id SERIAL PRIMARY KEY,
    bill_no VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    billing_period_id INTEGER REFERENCES financial_periods(id),
    meter_reading_id INTEGER REFERENCES meter_readings(id),
    bill_date DATE NOT NULL,
    due_date DATE,
    prev_reading DECIMAL(12,2),
    curr_reading DECIMAL(12,2),
    consumption DECIMAL(12,2),
    water_charge DECIMAL(12,2) DEFAULT 0,
    sewer_charge DECIMAL(12,2) DEFAULT 0,
    rent_charge DECIMAL(12,2) DEFAULT 0,
    misc_charge DECIMAL(12,2) DEFAULT 0,
    fixed_charge DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    amount_paid DECIMAL(12,2) DEFAULT 0,
    balance DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'unpaid',
    bill_type VARCHAR(20) DEFAULT 'auto',
    is_cancelled BOOLEAN DEFAULT FALSE,
    cancel_reason TEXT,
    cancelled_by INTEGER REFERENCES users(id),
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bill_adjustments (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
    adjustment_type VARCHAR(20) NOT NULL,
    original_amount DECIMAL(12,2),
    adjusted_amount DECIMAL(12,2),
    difference DECIMAL(12,2),
    reason TEXT,
    adjusted_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PAYMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    receipt_no VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    bill_id INTEGER REFERENCES bills(id),
    amount DECIMAL(12,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_mode_id INTEGER REFERENCES payment_modes(id),
    payment_category_id INTEGER REFERENCES payment_categories(id),
    reference VARCHAR(100),
    cashier_id INTEGER REFERENCES users(id),
    notes TEXT,
    is_cancelled BOOLEAN DEFAULT FALSE,
    cancel_reason TEXT,
    cancelled_by INTEGER REFERENCES users(id),
    cancelled_at TIMESTAMP,
    is_reconciled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_allocations (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
    bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
    amount_allocated DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- DEBT MANAGEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS payment_schedules (
    id SERIAL PRIMARY KEY,
    schedule_no VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    total_debt DECIMAL(12,2) NOT NULL,
    first_installment DECIMAL(12,2),
    num_installments INTEGER NOT NULL,
    engagement_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_installments (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES payment_schedules(id) ON DELETE CASCADE,
    installment_no INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    paid_date DATE,
    paid_amount DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- DISCONNECTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS disconnections (
    id SERIAL PRIMARY KEY,
    disc_no VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    disc_date DATE NOT NULL,
    disc_profile_id INTEGER REFERENCES disconnection_profiles(id),
    disc_mode_id INTEGER REFERENCES disconnection_modes(id),
    reason TEXT,
    outstanding_balance DECIMAL(12,2),
    bill_count INTEGER,
    meter_reading DECIMAL(12,2),
    disconnecter_id INTEGER,
    is_reconnected BOOLEAN DEFAULT FALSE,
    reconnected_at TIMESTAMP,
    reconnection_fee_paid DECIMAL(12,2) DEFAULT 0,
    ref_no VARCHAR(50),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS disconnecters (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    other_names VARCHAR(100),
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reconnecters (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    other_names VARCHAR(100),
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- COMPLAINTS
-- =====================================================

CREATE TABLE IF NOT EXISTS complaint_categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaint_types (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES complaint_categories(id),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaint_sources (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_no VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    other_names VARCHAR(100),
    department_id INTEGER REFERENCES departments(id),
    post_title VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    complaint_no VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    category_id INTEGER REFERENCES complaint_categories(id),
    type_id INTEGER REFERENCES complaint_types(id),
    source_id INTEGER REFERENCES complaint_sources(id),
    department_id INTEGER REFERENCES departments(id),
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'open',
    assigned_to INTEGER REFERENCES employees(id),
    description TEXT NOT NULL,
    resolution_notes TEXT,
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- AUDIT & EVENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS events_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logins_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    username VARCHAR(50),
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'success'
);

CREATE TABLE IF NOT EXISTS failed_logins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50),
    password_attempt TEXT,
    ip_address INET,
    user_agent TEXT,
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_customers_account_no ON customers(account_no);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(account_status);
CREATE INDEX IF NOT EXISTS idx_customers_billing_group ON customers(billing_group_id);
CREATE INDEX IF NOT EXISTS idx_customers_zone ON customers(zone_id);

CREATE INDEX IF NOT EXISTS idx_meters_meter_no ON meters(meter_no);
CREATE INDEX IF NOT EXISTS idx_meters_customer ON meters(customer_id);
CREATE INDEX IF NOT EXISTS idx_meters_status ON meters(meter_status);

CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_period ON bills(billing_period_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_bill_no ON bills(bill_no);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_receipt ON payments(receipt_no);
CREATE INDEX IF NOT EXISTS idx_payments_cashier ON payments(cashier_id);

CREATE INDEX IF NOT EXISTS idx_meter_readings_meter ON meter_readings(meter_id);
CREATE INDEX IF NOT EXISTS idx_meter_readings_date ON meter_readings(reading_date);
CREATE INDEX IF NOT EXISTS idx_meter_readings_period ON meter_readings(billing_period_id);

CREATE INDEX IF NOT EXISTS idx_complaints_customer ON complaints(customer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned ON complaints(assigned_to);

CREATE INDEX IF NOT EXISTS idx_events_log_user ON events_log(user_id);
CREATE INDEX IF NOT EXISTS idx_events_log_entity ON events_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_events_log_timestamp ON events_log(timestamp);

CREATE INDEX IF NOT EXISTS idx_disconnections_customer ON disconnections(customer_id);
CREATE INDEX IF NOT EXISTS idx_disconnections_date ON disconnections(disc_date);

-- =====================================================
-- SEED DATA
-- =====================================================

INSERT INTO user_groups (name, description, permissions) VALUES
('System Administrator', 'Full system access', '{"customers": ["view", "create", "edit", "delete"], "billing": ["view", "create", "edit", "delete"], "payments": ["view", "create", "edit", "delete"], "reports": ["view", "export"], "admin": ["view", "create", "edit", "delete"]}'),
('Billing Officer', 'Manage billing and meter readings', '{"customers": ["view", "create", "edit"], "billing": ["view", "create", "edit"], "payments": ["view"], "reports": ["view", "export"]}'),
('Cashier', 'Process payments', '{"customers": ["view"], "billing": ["view"], "payments": ["view", "create"], "reports": ["view"]}'),
('Customer Care', 'Handle complaints and customer queries', '{"customers": ["view", "edit"], "complaints": ["view", "create", "edit"], "reports": ["view"]}'),
('Meter Reader', 'Record meter readings', '{"customers": ["view"], "meters": ["view", "edit"], "readings": ["view", "create"]}')
ON CONFLICT DO NOTHING;

INSERT INTO users (username, password_hash, first_name, other_names, email, group_id, status) VALUES
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System', 'Administrator', 'admin@ewasco.co.ke', 1, 'active')
ON CONFLICT (username) DO NOTHING;

INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('company_name', 'Embu Water and Sanitation Company', 'string', 'Company name displayed on bills and reports'),
('company_address', 'P.O. Box 123, Embu', 'string', 'Company address'),
('company_phone', '+254 712 345678', 'string', 'Company phone number'),
('company_email', 'info@ewasco.co.ke', 'string', 'Company email'),
('vat_rate', '0', 'number', 'VAT rate percentage (0 if exempt)'),
('sewer_charge_rate', '0', 'number', 'Sewer charge as percentage of water charge'),
('meter_rent_default', '0', 'number', 'Default meter rent value'),
('currency_symbol', 'KES', 'string', 'Currency symbol for display'),
('reconnection_fee', '500', 'number', 'Standard reconnection fee')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO customer_categories (code, name) VALUES
('RES', 'RESIDENTIAL'),
('COM-HB', 'COMMERCIAL HOTEL/BAR'),
('COM-CW', 'COMMERCIAL CARWASH'),
('COM-OT', 'COMMERCIAL OTHERS'),
('IND', 'INDUSTRIAL'),
('GOV', 'GOVERNMENT')
ON CONFLICT DO NOTHING;

INSERT INTO payment_modes (code, name) VALUES
('CASH', 'Cash'),
('BANK', 'Bank Transfer'),
('MPESA', 'M-Pesa'),
('CHEQUE', 'Cheque'),
('CARD', 'Card')
ON CONFLICT DO NOTHING;

INSERT INTO reading_codes (code, name, description, affects_billing) VALUES
('NORMAL', 'Normal Reading', 'Regular meter reading', TRUE),
('VACANT', 'Vacant Premises', 'No one at premises', FALSE),
('LOCKED', 'Locked Gate', 'Unable to access meter', FALSE),
('NOACCESS', 'No Access', 'Meter not accessible', FALSE),
('FAULTY', 'Faulty Meter', 'Meter is faulty', FALSE),
('ESTIMATED', 'Estimated', 'Reading was estimated', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO billing_groups (code, name, area_code) VALUES
('S001', 'Section 001', 'EMB'),
('S002', 'Section 002', 'EMB'),
('S003', 'Section 003', 'GKA'),
('S004', 'Section 004', 'KRT'),
('S005', 'Section 005', 'KTH')
ON CONFLICT DO NOTHING;
