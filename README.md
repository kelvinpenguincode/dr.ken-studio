# Dr. Ken Studio Orders

A full-stack order request website built with Next.js, Tailwind CSS, React Hook Form, Zod, Prisma, and PostgreSQL (Supabase-compatible).

Customers can submit package/order requests, search and lightly edit submitted orders, and admins can review requests, update statuses, flag issues, and export CSV data.

## Features

- Public order request form styled like the reference design (beige background, gold accents, card layout)
- Collapsible order search on the home page
- Order confirmation page with request ID warning
- Search/modify page with editable recipient fields before processing starts
- Protected admin dashboard with login, filters, detail view, status updates, issue flags, and CSV export
- Prisma schema + Supabase SQL schema + seed data for products and admin user

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS 4**
- **React Hook Form + Zod**
- **Prisma** for database access
- **PostgreSQL** via Supabase or any Postgres host
- **Supabase client** stubbed for future auth/storage/Google Sheets integration

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Required for local development:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/fengjie_orders"
ADMIN_SESSION_SECRET="replace-with-a-long-random-string"
ADMIN_EMAIL="admin@fengjie.local"
ADMIN_PASSWORD="admin123"
```

### 3. Set up the database

**Option A — Supabase (recommended)**

1. Create a project at [supabase.com](https://supabase.com)
2. Copy the Postgres connection string into `DATABASE_URL`
3. Optionally run `supabase/schema.sql` in the SQL editor
4. Or use Prisma:

```bash
npm run db:push
npm run db:seed
```

**Option B — Local PostgreSQL**

```bash
createdb fengjie_orders
npm run db:setup
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Admin dashboard: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

Default seeded admin (change in production):

- Email: `admin@fengjie.local`
- Password: `admin123`

## Project Structure

```
src/
├── app/
│   ├── page.tsx                     # Public order form
│   ├── confirmation/[requestId]/  # Submission confirmation
│   ├── search/                      # Search & modify orders
│   ├── admin/                       # Admin dashboard & order detail
│   └── api/                         # REST API routes
├── components/
│   ├── forms/                       # Order form sections
│   ├── orders/                      # Order display & search UI
│   ├── admin/                       # Admin UI
│   └── ui/                          # Shared UI primitives
├── lib/
│   ├── services/orders.ts           # Database business logic
│   ├── validations/order.ts         # Zod schemas
│   └── auth.ts                      # Admin session helpers
prisma/
├── schema.prisma                    # Prisma schema
└── seed.ts                          # Product + admin seed data
supabase/
└── schema.sql                       # Raw SQL schema for Supabase
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Submit a new order + collapsible search |
| `/confirmation/[requestId]` | Post-submission summary |
| `/search?q=` | Find and edit an existing order |
| `/admin/login` | Admin sign-in |
| `/admin` | Order list with filters + CSV export |
| `/admin/team` | Manage admins, roles, and permissions |
| `/admin/orders/[requestId]` | Admin order detail & status tools |

## Order Statuses

- Submitted
- Reviewed
- Error / Needs Correction
- Processing
- Ready for Delivery
- Completed
- Cancelled

Customers can edit recipient info, notes, and product quantities only while status is **Submitted**, **Reviewed**, or **Error / Needs Correction**.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | Active product list |
| POST | `/api/orders` | Create order request |
| GET | `/api/orders/search?q=` | Search orders |
| GET/PATCH | `/api/orders/[requestId]` | View/update customer order |
| POST/DELETE | `/api/admin/login` | Admin login/logout |
| GET | `/api/admin/me` | Current admin profile + permissions |
| GET/POST/PATCH/DELETE | `/api/admin/admins` | Manage admin accounts |
| GET | `/api/admin/orders` | Admin order list |
| GET/PATCH | `/api/admin/orders/[requestId]` | Admin order detail/update |
| GET | `/api/admin/orders/export` | CSV export |
| GET | `/api/admin/reports` | Sales report |

## Database Tables

- `admins`
- `products`
- `order_requests`
- `incoming_orders`
- `incoming_order_products`
- `recipients`
- `recipient_products`
- `order_status_history`
- `admin_notes`
- `order_admin_errors`

## Google Sheets (future)

`src/lib/supabase.ts` includes a `googleSheetsConfig` helper with env placeholders. Wire a server action or cron job later using:

- `GOOGLE_SHEETS_CLIENT_EMAIL`
- `GOOGLE_SHEETS_PRIVATE_KEY`
- `GOOGLE_SHEETS_SPREADSHEET_ID`

## Production Notes

- Change the seeded admin password immediately
- Use a strong `ADMIN_SESSION_SECRET`
- Enable SSL for your Postgres connection
- Invite extra admins from `/admin/team` (Owner / Manager / Staff + custom permissions)

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Generate Prisma client + production build
npm run db:push      # Push schema to database
npm run db:seed      # Seed products and admin user
npm run db:setup     # Push schema + seed
```

## iOS app (Xcode)

A native SwiftUI companion app lives in [`ios/DrKenStudio`](ios/DrKenStudio).

- Same cream/gold look, easier phone navigation (tabs + step wizard)
- Talks to your deployed Next.js/Vercel API
- Open on a **Mac with Xcode** — see `ios/DrKenStudio/README.md`
