-- EWASCO Water Billing System - Complaints Module Enhancement
-- Run order: 003_complaints_enhance.sql

-- Complaint activities / notes table
CREATE TABLE IF NOT EXISTS complaint_activities (
    id SERIAL PRIMARY KEY,
    complaint_id INTEGER REFERENCES complaints(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'note', 'status_change', 'assignment', 'escalation'
    old_value TEXT,
    new_value TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_complaint_activities_complaint ON complaint_activities(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_activities_type ON complaint_activities(activity_type);
