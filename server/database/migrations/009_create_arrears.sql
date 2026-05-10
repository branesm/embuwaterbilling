-- Arrears actions table - Disconnection notices, reconnections
CREATE TABLE IF NOT EXISTS arrears_actions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    action_type ENUM('notice', 'disconnection', 'reconnection', 'penalty') NOT NULL,
    action_date DATE NOT NULL,
    amount DECIMAL(12, 2) DEFAULT 0.00,
    description TEXT,
    performed_by INT,
    notice_date DATE,
    disconnection_date DATE,
    reconnection_date DATE,
    reconnection_fee DECIMAL(12, 2) DEFAULT 0.00,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_customer (customer_id),
    INDEX idx_type (action_type),
    INDEX idx_date (action_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment plans table - Installment agreements for arrears
CREATE TABLE IF NOT EXISTS payment_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    installment_amount DECIMAL(12, 2) NOT NULL,
    number_of_installments INT NOT NULL,
    start_date DATE NOT NULL,
    frequency ENUM('weekly', 'monthly') DEFAULT 'monthly',
    status ENUM('active', 'completed', 'defaulted', 'cancelled') DEFAULT 'active',
    agreed_by INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (agreed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_customer (customer_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment plan installments table
CREATE TABLE IF NOT EXISTS payment_plan_installments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_plan_id INT NOT NULL,
    installment_number INT NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP NULL,
    payment_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_plan_id) REFERENCES payment_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
    INDEX idx_plan (payment_plan_id),
    INDEX idx_due_date (due_date),
    INDEX idx_paid (is_paid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
