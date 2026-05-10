-- Billing periods, penalty rules, bill adjustments, and mass billing runs tables

CREATE TABLE IF NOT EXISTS billing_periods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    period_code VARCHAR(10) NOT NULL UNIQUE COMMENT 'e.g. 2026-05',
    period_name VARCHAR(100) NOT NULL COMMENT 'e.g. May 2026',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('open', 'closed', 'generating') DEFAULT 'open',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_period_code (period_code),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS penalty_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    grace_days INT NOT NULL DEFAULT 14,
    penalty_type ENUM('fixed', 'percentage') NOT NULL DEFAULT 'percentage',
    penalty_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Fixed amount or percentage',
    max_penalty DECIMAL(12, 2) DEFAULT NULL COMMENT 'Maximum penalty cap',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bill_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    adjustment_type ENUM('debit', 'credit') NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    approved_by INT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_bill (bill_id),
    INDEX idx_type (adjustment_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mass_billing_runs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    period_id INT NOT NULL,
    route_id INT,
    zone_id INT,
    status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
    total_customers INT DEFAULT 0,
    bills_generated INT DEFAULT 0,
    errors INT DEFAULT 0,
    error_details JSON,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (period_id) REFERENCES billing_periods(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES billing_routes(id) ON DELETE SET NULL,
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_period (period_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default penalty rule
INSERT INTO penalty_rules (name, grace_days, penalty_type, penalty_rate, max_penalty, is_active) VALUES
('Standard Late Payment Penalty', 14, 'percentage', 5.00, 5000.00, TRUE);
