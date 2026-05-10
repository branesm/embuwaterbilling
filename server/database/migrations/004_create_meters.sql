-- Meters table - Water meters
CREATE TABLE IF NOT EXISTS meters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    serial_number VARCHAR(50) UNIQUE NOT NULL,
    meter_size VARCHAR(20) NOT NULL DEFAULT '15mm',
    meter_type ENUM('analog', 'digital', 'smart') DEFAULT 'analog',
    installation_date DATE NOT NULL,
    initial_reading DECIMAL(10, 2) DEFAULT 0.00,
    current_reading DECIMAL(10, 2) DEFAULT 0.00,
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(11, 8),
    status ENUM('active', 'inactive', 'faulty', 'removed') DEFAULT 'active',
    is_main_meter BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_serial (serial_number),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Meter replacements table - Track meter swap history
CREATE TABLE IF NOT EXISTS meter_replacements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    old_meter_id INT NOT NULL,
    new_meter_id INT NOT NULL,
    customer_id INT NOT NULL,
    replacement_date DATE NOT NULL,
    old_final_reading DECIMAL(10, 2) NOT NULL,
    new_initial_reading DECIMAL(10, 2) DEFAULT 0.00,
    reason TEXT,
    replaced_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (old_meter_id) REFERENCES meters(id) ON DELETE RESTRICT,
    FOREIGN KEY (new_meter_id) REFERENCES meters(id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (replaced_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_customer (customer_id),
    INDEX idx_date (replacement_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
