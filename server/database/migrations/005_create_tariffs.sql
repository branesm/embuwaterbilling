-- Tariff configs table - Tariff sets per property type
CREATE TABLE IF NOT EXISTS tariff_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    property_type ENUM('residential', 'commercial', 'industrial', 'institutional') NOT NULL,
    standing_charge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    sewerage_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00 COMMENT 'Percentage of water charge',
    meter_rent DECIMAL(10, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_property_type (property_type),
    INDEX idx_active (is_active),
    INDEX idx_effective (effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tariff tiers table - Tiered rate bands
CREATE TABLE IF NOT EXISTS tariff_tiers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tariff_config_id INT NOT NULL,
    tier_order INT NOT NULL,
    min_consumption DECIMAL(10, 2) NOT NULL DEFAULT 0,
    max_consumption DECIMAL(10, 2) NOT NULL,
    rate_per_unit DECIMAL(10, 4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tariff_config_id) REFERENCES tariff_configs(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tier_order (tariff_config_id, tier_order),
    INDEX idx_tariff (tariff_config_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
