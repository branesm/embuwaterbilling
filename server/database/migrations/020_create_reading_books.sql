-- Reading books for route-based meter reading management
CREATE TABLE IF NOT EXISTS reading_books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT NOT NULL,
    period_code VARCHAR(10) NOT NULL,
    status ENUM('open', 'in_progress', 'completed', 'closed') DEFAULT 'open',
    meter_count INT DEFAULT 0,
    readings_done INT DEFAULT 0,
    assigned_to INT,
    generated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES billing_routes(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_route_period (route_id, period_code),
    INDEX idx_period (period_code),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reading_book_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    meter_id INT NOT NULL,
    customer_id INT NOT NULL,
    previous_reading DECIMAL(10, 2) DEFAULT 0,
    current_reading DECIMAL(10, 2),
    consumption DECIMAL(10, 2),
    reading_date DATE,
    status ENUM('pending', 'read', 'skipped', 'estimated') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES reading_books(id) ON DELETE CASCADE,
    FOREIGN KEY (meter_id) REFERENCES meters(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    INDEX idx_book (book_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
