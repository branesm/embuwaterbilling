-- Per-year counter table for atomic work order number generation
-- Prevents race conditions when multiple concurrent requests create work orders
CREATE TABLE IF NOT EXISTS work_order_counters (
    year INTEGER PRIMARY KEY,
    last_sequence INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backfill counter from existing work orders so new numbers continue the sequence
INSERT INTO work_order_counters (year, last_sequence)
SELECT EXTRACT(YEAR FROM created_at)::INTEGER AS year, COUNT(*)::INTEGER AS last_sequence
FROM work_orders
GROUP BY EXTRACT(YEAR FROM created_at)
ON CONFLICT (year) DO UPDATE
    SET last_sequence = GREATEST(work_order_counters.last_sequence, EXCLUDED.last_sequence);
