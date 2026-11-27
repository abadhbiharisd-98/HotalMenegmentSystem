-- ====================================================================
-- HOTEL MANAGEMENT SYSTEM - COMPLETE POSTGRESQL SCHEMA
-- Modules:
-- 1. Users and Admin
-- 2. Staff
-- 3. Room Types
-- 4. Rooms
-- 5. Guests
-- 6. Reservations
-- 7. Check-in and Check-out
-- 8. Payments
-- 9. Invoices
-- 10. Hotel Expenses
-- ====================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 1. USERS & ADMIN MODULE
-- ====================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'receptionist', 'staff')),
    phone VARCHAR(25),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ====================================================================
-- 2. STAFF MODULE
-- ====================================================================
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    department VARCHAR(80) NOT NULL,
    position VARCHAR(80) NOT NULL,
    salary NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift VARCHAR(30) DEFAULT 'morning' CHECK (shift IN ('morning', 'evening', 'night', 'rotational')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'terminated')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_user ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_dept ON staff(department);

-- ====================================================================
-- 3. ROOM TYPES MODULE
-- ====================================================================
CREATE TABLE IF NOT EXISTS room_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(80) UNIQUE NOT NULL,
    description TEXT,
    base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
    capacity INT NOT NULL DEFAULT 2 CHECK (capacity > 0),
    amenities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- 4. ROOMS MODULE
-- ====================================================================
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    room_number VARCHAR(20) UNIQUE NOT NULL,
    room_type_id INT NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
    floor INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'cleaning')),
    price_per_night NUMERIC(10, 2) NOT NULL CHECK (price_per_night >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rooms_number ON rooms(room_number);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(room_type_id);

-- ====================================================================
-- 5. GUESTS MODULE
-- ====================================================================
CREATE TABLE IF NOT EXISTS guests (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(60) NOT NULL,
    last_name VARCHAR(60) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(25) NOT NULL,
    id_type VARCHAR(50) DEFAULT 'Aadhar Card' CHECK (id_type IN ('Passport', 'Driving License', 'Aadhar Card', 'National ID', 'Other')),
    id_number VARCHAR(100) NOT NULL,
    address TEXT,
    nationality VARCHAR(60) DEFAULT 'Indian',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests(phone);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);

-- ====================================================================
-- 6. RESERVATIONS MODULE
-- ====================================================================
CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    guest_id INT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    room_id INT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    number_of_guests INT NOT NULL DEFAULT 1 CHECK (number_of_guests > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    special_requests TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_dates CHECK (check_out_date > check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_reservations_guest ON reservations(guest_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room ON reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- ====================================================================
-- 7. CHECK-IN AND CHECK-OUT MODULE
-- ====================================================================
CREATE TABLE IF NOT EXISTS check_in_out (
    id SERIAL PRIMARY KEY,
    reservation_id INT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    guest_id INT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    room_id INT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    actual_check_in TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actual_check_out TIMESTAMP WITH TIME ZONE,
    room_key_status VARCHAR(30) DEFAULT 'issued' CHECK (room_key_status IN ('issued', 'returned', 'lost')),
    notes TEXT,
    handled_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_check_res ON check_in_out(reservation_id);

-- ====================================================================
-- 8. PAYMENTS MODULE
-- ====================================================================
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    reservation_id INT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(40) NOT NULL CHECK (payment_method IN ('cash', 'credit_card', 'debit_card', 'upi', 'bank_transfer')),
    payment_status VARCHAR(30) NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    transaction_id VARCHAR(120),
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    recorded_by INT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_res ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);

-- ====================================================================
-- 9. INVOICES MODULE
-- ====================================================================
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    reservation_id INT UNIQUE NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(payment_status);

-- ====================================================================
-- 10. HOTEL EXPENSES MODULE
-- ====================================================================
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('utilities', 'maintenance', 'supplies', 'food_beverage', 'salaries', 'other')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(40) DEFAULT 'cash',
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    recorded_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- ====================================================================
-- SEED INITIAL DATA (Room types & Default Admin if empty)
-- ====================================================================
INSERT INTO room_types (name, description, base_price, capacity, amenities)
VALUES
    ('Single Standard', 'Comfortable single room with essential amenities', 1200.00, 1, '["Free Wi-Fi", "Air Conditioning", "TV", "Room Service"]'::jsonb),
    ('Double Deluxe', 'Spacious double bed room with premium city view', 2200.00, 2, '["Free Wi-Fi", "Air Conditioning", "Smart TV", "Mini Fridge", "Balcony"]'::jsonb),
    ('Executive Suite', 'Luxury suite with king-size bed and living area', 4500.00, 3, '["Free Wi-Fi", "Jacuzzi", "King Bed", "Mini Bar", "Complimentary Breakfast"]'::jsonb),
    ('Family Suite', 'Two interconnected bedrooms suitable for families', 5500.00, 4, '["Free Wi-Fi", "2 Bathrooms", "Living Room", "Dining Area", "Kitchenette"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Initial Rooms
INSERT INTO rooms (room_number, room_type_id, floor, status, price_per_night)
SELECT '101', 1, 1, 'available', 1200.00 WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE room_number = '101');
INSERT INTO rooms (room_number, room_type_id, floor, status, price_per_night)
SELECT '102', 1, 1, 'available', 1200.00 WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE room_number = '102');
INSERT INTO rooms (room_number, room_type_id, floor, status, price_per_night)
SELECT '201', 2, 2, 'available', 2200.00 WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE room_number = '201');
INSERT INTO rooms (room_number, room_type_id, floor, status, price_per_night)
SELECT '202', 2, 2, 'available', 2200.00 WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE room_number = '202');
INSERT INTO rooms (room_number, room_type_id, floor, status, price_per_night)
SELECT '301', 3, 3, 'available', 4500.00 WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE room_number = '301');
