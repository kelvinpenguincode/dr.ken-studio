-- Fengjie Orders — Supabase SQL schema
-- Run this in the Supabase SQL Editor if you prefer raw SQL over Prisma migrations

CREATE TYPE order_status AS ENUM (
  'SUBMITTED',
  'REVIEWED',
  'ERROR_NEEDS_CORRECTION',
  'PROCESSING',
  'READY_FOR_DELIVERY',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE admin_error_type AS ENUM (
  'MISSING_PICKUP_CODE',
  'PRODUCT_MISMATCH',
  'QUANTITY_MISMATCH',
  'INVALID_ADDRESS',
  'DUPLICATE_ORDER',
  'UNKNOWN_PRODUCT'
);

CREATE TYPE admin_role AS ENUM (
  'OWNER',
  'MANAGER',
  'STAFF'
);

CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role admin_role NOT NULL DEFAULT 'OWNER',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE device_push_tokens (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  watch_request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_push_tokens_user_id ON device_push_tokens(user_id);
CREATE INDEX idx_device_push_tokens_watch_request_id ON device_push_tokens(watch_request_id);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  category TEXT,
  description TEXT,
  price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_requests (
  id TEXT PRIMARY KEY,
  request_id TEXT UNIQUE NOT NULL,
  lookup_token TEXT UNIQUE NOT NULL,
  form_filler_name TEXT NOT NULL,
  status order_status NOT NULL DEFAULT 'SUBMITTED',
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE incoming_orders (
  id TEXT PRIMARY KEY,
  order_request_id TEXT NOT NULL REFERENCES order_requests(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  pickup_code TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE incoming_order_products (
  id TEXT PRIMARY KEY,
  incoming_order_id TEXT NOT NULL REFERENCES incoming_orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity > 0)
);

CREATE TABLE recipients (
  id TEXT PRIMARY KEY,
  order_request_id TEXT NOT NULL REFERENCES order_requests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE recipient_products (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity > 0)
);

CREATE TABLE order_status_history (
  id TEXT PRIMARY KEY,
  order_request_id TEXT NOT NULL REFERENCES order_requests(id) ON DELETE CASCADE,
  status order_status NOT NULL,
  changed_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_notes (
  id TEXT PRIMARY KEY,
  order_request_id TEXT NOT NULL REFERENCES order_requests(id) ON DELETE CASCADE,
  admin_id TEXT REFERENCES admins(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_admin_errors (
  id TEXT PRIMARY KEY,
  order_request_id TEXT NOT NULL REFERENCES order_requests(id) ON DELETE CASCADE,
  error_type admin_error_type NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_requests_request_id ON order_requests(request_id);
CREATE INDEX idx_order_requests_status ON order_requests(status);
CREATE INDEX idx_order_requests_user_id ON order_requests(user_id);
CREATE INDEX idx_incoming_orders_order_number ON incoming_orders(order_number);
CREATE INDEX idx_recipients_phone ON recipients(phone);
CREATE INDEX idx_recipients_name ON recipients(name);
