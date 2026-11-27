# Hotel Management System - Backend Foundation

A professional, production-ready REST API backend for a comprehensive Hotel Management System built with **Node.js**, **Express.js**, and **PostgreSQL** (via `pg`).

---

## 🛠️ Technology Stack

- **Runtime:** Node.js (CommonJS)
- **Framework:** Express.js 5
- **Database:** PostgreSQL 18
- **Database Client:** `pg` (node-postgres connection pool)
- **Authentication:** JWT (`jsonwebtoken`)
- **Password Hashing:** `bcryptjs`
- **Environment Management:** `dotenv`
- **CORS:** `cors`

---

## 📁 Project Architecture

```text
backend/
├── config/
│   └── db.js                 # PostgreSQL Pool & query helper
├── controllers/
│   ├── authController.js       # Register, login, profile, user listing
│   ├── checkInOutController.js # Check-in, check-out, status
│   ├── expenseController.js    # Hotel expenses and category summary
│   ├── guestController.js      # Guest records management
│   ├── invoiceController.js    # Invoice generation & billing
│   ├── paymentController.js    # Payment tracking & transactions
│   ├── reservationController.js# Bookings & room reservations
│   ├── roomController.js       # Room inventory & room types
│   └── staffController.js      # Hotel staff & shift assignments
├── database/
│   └── schema.sql            # Complete DDL for all 10 modules + seed data
├── middleware/
│   ├── authMiddleware.js     # JWT token verification & role authorization
│   └── errorMiddleware.js    # 404 handler and global error handler
├── models/
│   ├── checkInOutModel.js
│   ├── expenseModel.js
│   ├── guestModel.js
│   ├── invoiceModel.js
│   ├── paymentModel.js
│   ├── reservationModel.js
│   ├── roomModel.js
│   ├── staffModel.js
│   └── userModel.js
├── routes/
│   ├── authRoutes.js         # /api/auth
│   ├── checkInOutRoutes.js   # /api/check-in-out
│   ├── expenseRoutes.js      # /api/expenses
│   ├── guestRoutes.js        # /api/guests
│   ├── healthRoutes.js       # /api/health
│   ├── invoiceRoutes.js      # /api/invoices
│   ├── paymentRoutes.js      # /api/payments
│   ├── reservationRoutes.js  # /api/reservations
│   ├── roomRoutes.js         # /api/rooms
│   └── staffRoutes.js        # /api/staff
├── scripts/
│   ├── init-db.js            # Run schema.sql on database
│   └── test-db.js            # Test PostgreSQL connectivity
├── .env                      # Local environment configuration
├── .env.example              # Environment variables template
├── package.json
└── server.js                 # Main Express server entrypoint
```

---

## ⚙️ Environment Variables Configuration (`.env`)

Edit `backend/.env` with your PostgreSQL credentials:

```env
# Server
PORT=5000
NODE_ENV=development

# PostgreSQL Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_actual_postgres_password_here
DB_NAME=hotel_management

# Authentication
JWT_SECRET=super_secret_jwt_key_hotel_management_system_2026_dev
JWT_EXPIRES_IN=24h

# Client URL (for CORS)
CLIENT_URL=http://localhost:5173
```

---

## 🚀 Quick Setup & Run Commands

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Database Password
Open `backend/.env` and replace `your_postgres_password_here` with the password you set during PostgreSQL installation.

If the database `hotel_management` does not exist yet, you can create it via PostgreSQL shell:
```sql
CREATE DATABASE hotel_management;
```

### 3. Test PostgreSQL Connectivity
Verify that your credentials can connect to PostgreSQL:
```bash
npm run test:db
```

### 4. Initialize Database Schema & Seed Data
Executes `database/schema.sql` to create all 10 tables, indexes, and initial room types:
```bash
npm run init:db
```

### 5. Start Backend Server

**Development Mode (auto-reload on save):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

---

## 📡 REST API Endpoints Overview

### Health & Diagnostics
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Root server test endpoint |
| `GET` | `/api/health` | Live server status & PostgreSQL connectivity check |

### Authentication & Users
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new staff/user |
| `POST` | `/api/auth/login` | Public | User login & JWT issuance |
| `GET` | `/api/auth/me` | Bearer Token | Current user profile |
| `GET` | `/api/auth/users` | Admin, Manager | List all users |

### Rooms & Room Types
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/rooms` | Public | List rooms (filterable by status, floor, type) |
| `GET` | `/api/rooms/types` | Public | List all room categories & amenities |
| `GET` | `/api/rooms/:id` | Public | Single room details |
| `POST` | `/api/rooms` | Admin, Manager | Create new room |
| `PUT` | `/api/rooms/:id` | Admin, Manager | Update room details |
| `DELETE` | `/api/rooms/:id` | Admin | Delete room |

### Guests
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/guests` | Authenticated | List all guests (with search) |
| `GET` | `/api/guests/:id` | Authenticated | Single guest details |
| `POST` | `/api/guests` | Authenticated | Register new guest |
| `PUT` | `/api/guests/:id` | Authenticated | Update guest details |

### Reservations
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/reservations` | Authenticated | List all bookings |
| `GET` | `/api/reservations/:id` | Authenticated | Booking details |
| `POST` | `/api/reservations` | Authenticated | Create booking & reserve room |
| `PATCH` | `/api/reservations/:id/status`| Authenticated | Update status (confirmed, cancelled, etc.) |

### Check-in & Check-out
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/check-in-out/check-in` | Authenticated | Perform guest check-in & issue key |
| `POST` | `/api/check-in-out/check-out` | Authenticated | Perform check-out & mark room for cleaning |
| `GET` | `/api/check-in-out/:reservationId` | Authenticated | Check-in/out records |

### Payments & Invoices
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/payments` | Authenticated | Record payment (cash, UPI, card) |
| `GET` | `/api/payments/reservation/:reservationId` | Authenticated | Payments for a reservation |
| `GET` | `/api/payments` | Authenticated | All payment logs |
| `POST` | `/api/invoices/generate` | Authenticated | Generate invoice with tax/discount |
| `GET` | `/api/invoices/reservation/:reservationId` | Authenticated | Invoice for reservation |
| `GET` | `/api/invoices` | Authenticated | All invoices |

### Hotel Expenses & Staff
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/expenses` | Admin, Manager | List hotel operational expenses |
| `POST` | `/api/expenses` | Admin, Manager | Record hotel expense |
| `GET` | `/api/expenses/summary` | Admin, Manager | Expense summary by category |
| `GET` | `/api/staff` | Admin, Manager | List all staff members |
| `POST` | `/api/staff` | Admin | Add new staff member |
| `PUT` | `/api/staff/:id` | Admin | Update staff member |
