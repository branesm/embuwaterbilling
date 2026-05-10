-- Meter Reading Anomalies Table
CREATE TABLE IF NOT EXISTS meter_reading_anomalies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meter_id INT NOT NULL,
    reading_id INT,
    
    -- Anomaly Details
    anomaly_code VARCHAR(50) NOT NULL,
    anomaly_name VARCHAR(100) NOT NULL,
    description TEXT,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    
    -- Resolution
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    resolved_by INT,
    resolution_notes TEXT,
    resolution_type ENUM('manual_review', 're_reading', 'meter_replacement', 'billing_adjustment', 'other'),
    
    -- Timestamps
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    detected_by INT,
    
    -- Foreign Keys
    FOREIGN KEY (meter_id) REFERENCES meters(id) ON DELETE CASCADE,
    FOREIGN KEY (reading_id) REFERENCES meter_readings(id) ON DELETE SET NULL,
    FOREIGN KEY (detected_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_meter (meter_id),
    INDEX idx_reading (reading_id),
    INDEX idx_severity (severity),
    INDEX idx_resolved (is_resolved),
    INDEX idx_detected_at (detected_at),
    INDEX idx_anomaly_code (anomaly_code),
    UNIQUE KEY unique_reading_anomaly (reading_id, anomaly_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
