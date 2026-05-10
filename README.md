# EWASCO Water Billing System

A full-stack web-based water billing system for Embu Water and Sanitation Company (EWASCO). Built with React + Tailwind CSS (frontend) and Node.js + Express + MySQL (backend).

## Features

- **Customer Management**: Register and manage customer accounts with unique account numbers
- **Meter Management**: Track water meters, installations, and replacements
- **Meter Reading Entry**: Mobile-optimized reading entry with anomaly detection
- **Billing Engine**: Tiered tariff calculation with automatic bill generation
- **Payment Processing**: FIFO payment allocation with cash, bank, and M-Pesa support
- **M-Pesa Integration**: Daraja API integration for C2B and STK Push payments
- **SMS Notifications**: Africa's Talking API for bill and payment notifications
- **Reporting**: Dashboard with KPIs, revenue reports, and analytics
- **Role-Based Access**: Admin, Manager, Clerk, Cashier, and Reader roles
- **Customer Portal**: Self-service portal for customers to view bills and payments

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + React Router v6 + React Query
- **Backend**: Node.js + Express + pg (raw SQL, no ORM)
- **Database**: PostgreSQL 16
- **Auth**: JWT (access token in memory, refresh token in httpOnly cookie)
- **PDF**: PDFKit (bills, receipts)
- **Excel**: ExcelJS (report exports)
- **M-Pesa**: Safaricom Daraja API (C2B + STK Push)
- **SMS**: Africa's Talking API

## Quick Start with Docker

### Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine + Docker Compose (Linux)
- Git (optional, for cloning)

### Installation

1. **Clone or download the project**:
   ```bash
   git clone <repository-url>
   cd embuwaterbilling
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your preferred settings or use the defaults.

3. **Start the application**:
   ```bash
   docker-compose up -d
   ```

4. **Wait for services to initialize** (about 30-60 seconds for first run)

5. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000
   - API Health Check: http://localhost:5000/health

### Default Login Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Administrator |
| manager | admin123 | Manager |
| clerk | admin123 | Clerk |
| cashier | admin123 | Cashier |
| reader | admin123 | Meter Reader |

## Docker Services

| Service | Container Name | Port | Description |
|---------|---------------|------|-------------|
| PostgreSQL | ewasco-postgres | 5432 | Database server |
| Backend API | ewasco-api | 5000 | Node.js API server |
| Frontend Web | ewasco-web | 5173 | React web app |

## Database Schema

The system includes the following main tables:
- `users` - Staff accounts with roles and credentials
- `zones` - Geographic zones
- `routes` - Meter reading routes
- `customers` - Customer accounts
- `meters` - Water meters with current readings
- `meter_readings` - Historical meter readings
- `tariff_configs` & `tariff_tiers` - Pricing structure and tiered rates
- `bills` & `bill_items` - Generated invoices
- `payments` & `payment_allocations` - Payment records and FIFO allocation
- `mpesa_transactions` - M-Pesa STK Push and C2B logs
- `sms_logs` & `sms_templates` - SMS notification history
- `audit_logs` - System audit trail
- `complaints` - Customer service complaints
- `disconnections` - Account disconnections for non-payment
- `workorders` - Maintenance and installation work orders

## Troubleshooting

### Port Already in Use
If ports 5173, 5000, or 5432 are already in use:
```bash
# Stop the containers
docker-compose down

# Edit docker-compose.yml to use different ports, then restart:
docker-compose up -d
```

### Database Not Initializing
The PostgreSQL database automatically runs migration scripts from `api/database/migrations/` on first startup. If migrations don't run:
```bash
# Check database logs
docker-compose logs postgres

# Verify container health
docker-compose ps
```

### API Connection Issues
Ensure the API container can reach PostgreSQL:
```bash
# Check logs
docker-compose logs api

# Verify connectivity from inside the container
docker-compose exec api sh -c "psql -h postgres -U ewasco_admin -d ewasco_billing -c 'SELECT version();'"
```

### Frontend Cannot Connect to API
If you see CORS or connection errors in the browser:
```bash
# Verify API is running and accessible
curl http://localhost:5000/health

# Check frontend logs
docker-compose logs web

# Ensure VITE_API_URL matches your API host
```

## Development

### Without Docker (Local Development)

**Backend**:
```bash
cd server
npm install
npm run dev
```

**Frontend**:
```bash
cd client
npm install
npm run dev
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_ROOT_PASSWORD` | ewasco_root_2024 | MySQL root password |
| `DB_NAME` | ewasco_billing | Database name |
| `DB_USER` | ewasco_user | Database user |
| `DB_PASSWORD` | ewasco_pass_2024 | Database password |
| `JWT_SECRET` | (see .env.example) | JWT signing secret |
| `SERVER_PORT` | 5000 | Backend port |
| `CLIENT_PORT` | 5173 | Frontend port |

### Useful Docker Commands

```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f mysql

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Stop and remove volumes (WARNING: deletes database data)
docker-compose down -v

# Rebuild containers
docker-compose up -d --build

# Access MySQL shell
docker exec -it ewasco-mysql mysql -u root -p

# Access backend container
docker exec -it ewasco-backend sh
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Customers
- `GET /api/customers` - List customers
- `GET /api/customers/:id` - Get customer details
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer

### Meters
- `GET /api/meters` - List meters
- `POST /api/meters` - Create meter

### Readings
- `GET /api/readings` - List readings
- `POST /api/readings` - Record reading

### Billing
- `GET /api/billing` - List bills
- `POST /api/billing/generate` - Generate bill

### Payments
- `GET /api/payments` - List payments
- `POST /api/payments` - Record payment

### Reports
- `GET /api/reports/dashboard` - Dashboard stats

## M-Pesa Integration Setup

1. Register at [Safaricom Developer Portal](https://developer.safaricom.co.ke/)
2. Create an app and get Consumer Key and Consumer Secret
3. Configure the Daraja API credentials in your `.env` file:
   ```
   MPESA_CONSUMER_KEY=your_consumer_key
   MPESA_CONSUMER_SECRET=your_consumer_secret
   MPESA_PASSKEY=your_passkey
   MPESA_SHORTCODE=174379
   MPESA_ENV=sandbox
   ```
4. Set up C2B URLs in the Daraja portal to point to your server's validation and confirmation endpoints

## Production Deployment

1. Update `.env` with production values
2. Change `NODE_ENV` to `production`
3. Use strong JWT secrets
4. Configure proper SSL/TLS certificates
5. Set up a reverse proxy (nginx/Apache)
6. Configure M-Pesa production credentials
7. Set up Africa's Talking production API key

## License

This project is proprietary software for Embu Water and Sanitation Company.

## Support

For support or inquiries, please contact EWASCO IT Department.
