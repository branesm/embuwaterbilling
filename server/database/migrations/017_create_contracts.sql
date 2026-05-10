-- Contracts/Connections table - Links customers to meters and tariffs (WASREB compliant)
CREATE TABLE IF NOT EXISTS contracts (
    contract_id INT AUTO_INCREMENT PRIMARY KEY,
    contract_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    
    -- Billing & Tariff Information
    billing_group_id INT,
    tariff_category_id INT,
    tariff_config_id INT,
    
    -- Connection Details
    connection_date DATE NOT NULL,
    status ENUM('active', 'inactive', 'suspended', 'terminated') DEFAULT 'active',
    deposit_amount DECIMAL(10, 2) DEFAULT 0.00,
    
    -- Location
    zone_id INT,
    route_id INT,
    plot_number VARCHAR(50),
    physical_address TEXT,
    
    -- Meter Assignment
    meter_id INT,
    
    -- Service Type
    service_type ENUM('water', 'sewer', 'both') DEFAULT 'water',
    connection_size VARCHAR(20) DEFAULT '1/2 inch',
    
    -- Termination
    termination_date DATE NULL,
    termination_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    
    -- Foreign Keys
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (billing_group_id) REFERENCES zones(id) ON DELETE SET NULL,
    FOREIGN KEY (tariff_category_id) REFERENCES tariff_configs(id) ON DELETE SET NULL,
    FOREIGN KEY (tariff_config_id) REFERENCES tariff_configs(id) ON DELETE SET NULL,
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
    FOREIGN KEY (meter_id) REFERENCES meters(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_contract_number (contract_number),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_connection_date (connection_date),
    INDEX idx_meter (meter_id),
    INDEX idx_billing_group (billing_group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contract History Table - Track all changes to contracts (WASREB Audit Requirement)
CREATE TABLE IF NOT EXISTS contract_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    contract_id INT NOT NULL,
    change_type ENUM('created', 'updated', 'suspended', 'reactivated', 'terminated', 'meter_changed', 'tariff_changed') NOT NULL,
    old_values JSON,
    new_values JSON,
    changed_by INT,
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_contract (contract_id),
    INDEX idx_change_type (change_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Billing Groups Table (WASREB Requirement for zone-based billing)
CREATE TABLE IF NOT EXISTS billing_groups (
    billing_group_id INT AUTO_INCREMENT PRIMARY KEY,
    group_code VARCHAR(10) UNIQUE NOT NULL,
    group_name VARCHAR(100) NOT NULL,
    description TEXT,
    zone_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL,
    INDEX idx_group_code (group_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Complaints Table (WASREB Requirement)
CREATE TABLE IF NOT EXISTS complaints (
    complaint_id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    contract_id INT,
    
    -- Complaint Details
    category ENUM('billing', 'meter', 'leakage', 'water_quality', 'service_interruption', 'staff_conduct', 'other') NOT NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    status ENUM('open', 'assigned', 'in_progress', 'resolved', 'closed', 'escalated') DEFAULT 'open',
    
    -- Description
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    
    -- Assignment
    assigned_to INT,
    assigned_by INT,
    assigned_at TIMESTAMP NULL,
    
    -- Resolution
    resolution_notes TEXT,
    resolved_by INT,
    resolved_at TIMESTAMP NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    
    -- Foreign Keys
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_complaint_number (complaint_number),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_category (category),
    INDEX idx_priority (priority),
    INDEX idx_assigned (assigned_to),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Disconnections Table (WASREB Requirement)
CREATE TABLE IF NOT EXISTS disconnections (
    disconnection_id INT AUTO_INCREMENT PRIMARY KEY,
    contract_id INT NOT NULL,
    customer_id INT NOT NULL,
    
    -- Disconnection Details
    disconnection_type ENUM('non_payment', 'vacant_premises', 'illegal_connection', 'customer_request', 'other') NOT NULL,
    reason TEXT NOT NULL,
    
    -- Outstanding Balance
    outstanding_amount DECIMAL(10, 2) NOT NULL,
    bill_ids JSON,
    
    -- Disconnection Execution
    disconnection_date DATE NOT NULL,
    disconnected_by INT,
    meter_reading_at_disconnection DECIMAL(10, 2),
    
    -- Reconnection
    is_reconnected BOOLEAN DEFAULT FALSE,
    reconnection_date DATE NULL,
    reconnected_by INT,
    reconnection_fee DECIMAL(10, 2) DEFAULT 0.00,
    amount_paid DECIMAL(10, 2) DEFAULT 0.00,
    
    -- Approval
    approved_by INT,
    approved_at TIMESTAMP NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    
    -- Foreign Keys
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (disconnected_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reconnected_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_contract (contract_id),
    INDEX idx_customer (customer_id),
    INDEX idx_disconnection_date (disconnection_date),
    INDEX idx_is_reconnected (is_reconnected),
    INDEX idx_status (is_reconnected, disconnection_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Enhanced Audit Log Table (WASREB Requirement - All financial transactions)
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INT NOT NULL,
    action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    old_values JSON,
    new_values JSON,
    user_id INT NOT NULL,
    user_role VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- WASREB Specific
    transaction_type ENUM('billing', 'payment', 'adjustment', 'disconnection', 'reconnection', 'complaint', 'other'),
    amount DECIMAL(10, 2),
    customer_id INT,
    contract_id INT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE SET NULL,
    
    INDEX idx_table_record (table_name, record_id),
    INDEX idx_user (user_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_transaction (transaction_type),
    INDEX idx_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bill Adjustments Table (WASREB Requirement)
CREATE TABLE IF NOT EXISTS bill_adjustments (
    adjustment_id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    contract_id INT NOT NULL,
    
    -- Adjustment Details
    adjustment_type ENUM('billing_correction', 'meter_adjustment', 'payment_reversal', 'write_off', 'credit_note', 'debit_note') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    reason_code VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    
    -- Approval
    requested_by INT NOT NULL,
    approved_by INT,
    approval_date TIMESTAMP NULL,
    
    -- Status
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_bill (bill_id),
    INDEX idx_contract (contract_id),
    INDEX idx_status (status),
    INDEX idx_adjustment_type (adjustment_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Installment Plans Table (WASREB Debt Management)
CREATE TABLE IF NOT EXISTS installment_plans (
    plan_id INT AUTO_INCREMENT PRIMARY KEY,
    contract_id INT NOT NULL,
    customer_id INT NOT NULL,
    
    -- Plan Details
    total_amount DECIMAL(10, 2) NOT NULL,
    installment_amount DECIMAL(10, 2) NOT NULL,
    number_of_installments INT NOT NULL,
    frequency ENUM('weekly', 'biweekly', 'monthly') DEFAULT 'monthly',
    
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Status
    status ENUM('active', 'completed', 'defaulted', 'cancelled') DEFAULT 'active',
    paid_installments INT DEFAULT 0,
    remaining_amount DECIMAL(10, 2) NOT NULL,
    
    -- Approval
    approved_by INT,
    approved_at TIMESTAMP NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_contract (contract_id),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Installment Payments Table
CREATE TABLE IF NOT EXISTS installment_payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    plan_id INT NOT NULL,
    installment_number INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE NULL,
    payment_id_ref INT,
    status ENUM('pending', 'paid', 'overdue', 'waived') DEFAULT 'pending',
    
    FOREIGN KEY (plan_id) REFERENCES installment_plans(plan_id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id_ref) REFERENCES payments(id) ON DELETE SET NULL,
    
    INDEX idx_plan (plan_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
