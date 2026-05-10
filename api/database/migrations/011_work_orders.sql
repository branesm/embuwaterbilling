-- Technicians table - Field staff and work order assignees
CREATE TABLE IF NOT EXISTS technicians (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    department VARCHAR(20) DEFAULT 'general' CHECK (department IN ('meter_reading', 'maintenance', 'connections', 'leak_repair', 'general')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_technicians_employee_id ON technicians(employee_id);
CREATE INDEX IF NOT EXISTS idx_technicians_department ON technicians(department);
CREATE INDEX IF NOT EXISTS idx_technicians_status ON technicians(status);

-- Work orders table - Track field operations and maintenance tasks
CREATE TABLE IF NOT EXISTS work_orders (
    id SERIAL PRIMARY KEY,
    work_order_number VARCHAR(20) UNIQUE NOT NULL,
    work_order_type VARCHAR(30) NOT NULL CHECK (work_order_type IN (
        'new_connection', 'disconnection', 'reconnection', 'meter_replacement',
        'meter_repair', 'leak_repair', 'pipe_repair', 'valve_repair',
        'complaint', 'inspection', 'other'
    )),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled'
    )),

    -- Customer/Location Information
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    customer_address TEXT,
    account_number VARCHAR(20),
    meter_number VARCHAR(20),
    zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
    route_id INTEGER REFERENCES billing_routes(id) ON DELETE SET NULL,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),

    -- Work Details
    description TEXT NOT NULL,
    instructions TEXT,
    estimated_cost DECIMAL(10, 2),
    actual_cost DECIMAL(10, 2),
    materials_used TEXT,

    -- Assignment
    assigned_to INTEGER REFERENCES technicians(id) ON DELETE SET NULL,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP NULL,

    -- Scheduling
    scheduled_date DATE,
    scheduled_time_from TIME,
    scheduled_time_to TIME,

    -- Timestamps
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Created by
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_work_orders_number ON work_orders(work_order_number);
CREATE INDEX IF NOT EXISTS idx_work_orders_type ON work_orders(work_order_type);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_to ON work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_date ON work_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_created_at ON work_orders(created_at);

-- Work order comments/updates table
CREATE TABLE IF NOT EXISTS work_order_comments (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    comment_type VARCHAR(10) DEFAULT 'note' CHECK (comment_type IN ('update', 'note', 'issue', 'resolution')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_order_comments_work_order ON work_order_comments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_comments_created_at ON work_order_comments(created_at);

-- Work order attachments table
CREATE TABLE IF NOT EXISTS work_order_attachments (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    description VARCHAR(255),
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_order_attachments_work_order ON work_order_attachments(work_order_id);
