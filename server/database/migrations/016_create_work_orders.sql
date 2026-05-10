-- Work orders table - Track field operations and maintenance tasks
CREATE TABLE IF NOT EXISTS work_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    work_order_number VARCHAR(20) UNIQUE NOT NULL,
    work_order_type ENUM(
        'new_connection',
        'disconnection',
        'reconnection',
        'meter_replacement',
        'meter_repair',
        'leak_repair',
        'pipe_repair',
        'valve_repair',
        'complaint',
        'inspection',
        'other'
    ) NOT NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    status ENUM(
        'pending',
        'assigned',
        'in_progress',
        'on_hold',
        'completed',
        'cancelled'
    ) DEFAULT 'pending',
    
    -- Customer/Location Information
    customer_id INT,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    customer_address TEXT,
    account_number VARCHAR(20),
    meter_number VARCHAR(20),
    zone_id INT,
    route_id INT,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    
    -- Work Details
    description TEXT NOT NULL,
    instructions TEXT,
    estimated_cost DECIMAL(10, 2),
    actual_cost DECIMAL(10, 2),
    materials_used TEXT,
    
    -- Assignment
    assigned_to INT,
    assigned_by INT,
    assigned_at TIMESTAMP NULL,
    
    -- Scheduling
    scheduled_date DATE,
    scheduled_time_from TIME,
    scheduled_time_to TIME,
    
    -- Timestamps
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Created by
    created_by INT,
    
    -- Foreign Keys
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES technicians(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_work_order_number (work_order_number),
    INDEX idx_type (work_order_type),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_scheduled_date (scheduled_date),
    INDEX idx_customer (customer_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Work order comments/updates table
CREATE TABLE IF NOT EXISTS work_order_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    work_order_id INT NOT NULL,
    comment TEXT NOT NULL,
    comment_type ENUM('update', 'note', 'issue', 'resolution') DEFAULT 'note',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_work_order (work_order_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Work order attachments table
CREATE TABLE IF NOT EXISTS work_order_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    work_order_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size INT,
    description VARCHAR(255),
    uploaded_by INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_work_order (work_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
