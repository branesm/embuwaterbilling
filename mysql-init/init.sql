-- MySQL initialization script for EWASCO Water Billing System
-- This script runs automatically when the MySQL container starts for the first time

-- Ensure proper charset
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Source all migration files in order
SOURCE /docker-entrypoint-initdb.d/migrations/001_create_users.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/002_create_zones_routes.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/003_create_customers.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/004_create_meters.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/005_create_tariffs.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/006_create_readings.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/007_create_bills.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/008_create_payments.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/009_create_arrears.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/010_create_sms.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/011_create_audit_logs.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/012_create_settings.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/013_create_portal_tokens.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/014_create_technicians.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/015_create_meter_devices.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/016_create_work_orders.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/017_create_contracts.sql;
SOURCE /docker-entrypoint-initdb.d/migrations/018_create_anomalies.sql;

-- Source seed files
SOURCE /docker-entrypoint-initdb.d/seeds/000_seed_customers.sql;
SOURCE /docker-entrypoint-initdb.d/seeds/001_seed_users.sql;
SOURCE /docker-entrypoint-initdb.d/seeds/002_seed_zones_routes.sql;
SOURCE /docker-entrypoint-initdb.d/seeds/003_seed_tariffs.sql;
SOURCE /docker-entrypoint-initdb.d/seeds/004_seed_settings.sql;
SOURCE /docker-entrypoint-initdb.d/seeds/005_seed_sms_templates.sql;
SOURCE /docker-entrypoint-initdb.d/seeds/005_seed_technicians_devices.sql;
SOURCE /docker-entrypoint-initdb.d/seeds/006_seed_contracts_complaints.sql;

-- Note: DB user is created automatically by MYSQL_USER / MYSQL_PASSWORD env vars
-- in the docker-compose MySQL service configuration.

-- Log completion
SELECT 'EWASCO Water Billing System database initialized successfully' AS status;
