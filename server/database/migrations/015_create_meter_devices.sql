-- Meter reading devices table - Mobile devices for field operations
CREATE TABLE IF NOT EXISTS meter_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_name VARCHAR(50) NOT NULL,
    serial_number VARCHAR(30) UNIQUE NOT NULL,
    device_tag VARCHAR(50) UNIQUE NOT NULL,
    imei VARCHAR(20) UNIQUE,
    phone_number VARCHAR(20),
    device_type ENUM('android', 'ios', 'windows', 'other') DEFAULT 'android',
    status ENUM('active', 'inactive', 'lost', 'damaged', 'retired') DEFAULT 'active',
    assigned_to INT,
    last_sync_at TIMESTAMP NULL,
    last_location_lat DECIMAL(10, 8),
    last_location_lng DECIMAL(11, 8),
    last_location_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    FOREIGN KEY (assigned_to) REFERENCES technicians(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_serial (serial_number),
    INDEX idx_device_tag (device_tag),
    INDEX idx_status (status),
    INDEX idx_assigned (assigned_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key to technicians table after meter_devices is created
ALTER TABLE technicians 
ADD FOREIGN KEY (device_id) REFERENCES meter_devices(id) ON DELETE SET NULL;
