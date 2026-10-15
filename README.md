# 🏪 Store2Door — Wholesale Stock, Direct to Your Store

A full-stack B2B wholesale ordering platform built with **Next.js 16**, **Supabase**, and **TailwindCSS**. Retailers can browse catalog, add to cart, upload handwritten purchase orders (parcha), and track deliveries — all from a mobile-first PWA.

## 🌟 Features

### For Retailers (Store Frontend)
- **📱 Mobile-First PWA** — Installable on any device, works offline-capable
- **🛒 Product Catalog** — Browse by category, search, filter by brand
- **🛍️ Cart & Checkout** — Variant-aware cart with COD & online payment
- **📝 Parcha Upload** — Upload handwritten purchase orders as photos
- **📦 Order Tracking** — Real-time order status updates
- **👤 Account Management** — Profile, address, order history

### For Distributors (Admin Dashboard)
- **📊 Analytics Dashboard** — Revenue, orders, top products at a glance
- **📦 Order Management** — View, process, and fulfill orders
- **🏷️ Product Management** — Full CRUD with variants, pricing tiers
- **📝 Parcha Processing** — Review uploaded purchase orders
- **👥 Retailer Management** — Verify and manage retailer accounts
- **🏢 Brand & Category Management** — Organize product catalog
- **📍 Service Area Management** — Define delivery zones
- **📢 Banner Management** — Promotional banners for the storefront
- **📊 Inventory Management** — Track stock levels
- **⚙️ Settings** — Store configuration

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **Styling** | TailwindCSS 4 |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (Email/Password) |
| **State** | TanStack React Query v5 |
| **Forms** | React Hook Form + Zod validation |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Deployment** | Vercel (recommended) |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- A [Supabase](https://supabase.com) project

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd store2door
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Set Up Database

Run the migration SQL in your Supabase SQL Editor:

```bash
# Copy contents of supabase/migrations/001_initial_schema.sql
# Paste and run in Supabase Dashboard → SQL Editor
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the store frontend.  
Navigate to [http://localhost:3000/admin](http://localhost:3000/admin) — the admin dashboard.

## 📁 Project Structure

```
store2door/
├── public/
│   ├── manifest.webmanifest    # PWA manifest
│   └── icons/                  # PWA icons
├── src/
│   ├── app/
│   │   ├── (store)/            # Customer-facing routes
│   │   │   ├── page.tsx        # Homepage
│   │   │   ├── categories/     # Category browsing
│   │   │   ├── product/        # Product detail
│   │   │   ├── cart/           # Shopping cart
│   │   │   ├── checkout/       # Checkout flow
│   │   │   ├── orders/         # Order history
│   │   │   ├── parcha/         # Parcha upload
│   │   │   ├── search/         # Product search
│   │   │   └── account/        # User account
│   │   ├── admin/              # Admin dashboard
│   │   │   ├── page.tsx        # Dashboard home
│   │   │   ├── orders/         # Order management
│   │   │   ├── products/       # Product CRUD
│   │   │   ├── categories/     # Category management
│   │   │   ├── brands/         # Brand management
│   │   │   ├── retailers/      # Retailer management
│   │   │   ├── banners/        # Banner management
│   │   │   ├── parcha/         # Parcha processing
│   │   │   ├── inventory/      # Inventory tracking
│   │   │   ├── service-areas/  # Delivery zones
│   │   │   └── settings/       # Store settings
│   │   ├── api/                # API routes
│   │   ├── login/              # Auth pages
│   │   └── register/
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   └── store/              # Store-specific components
│   ├── lib/
│   │   ├── supabase/           # Supabase client setup
│   │   ├── auth/               # Auth utilities
│   │   ├── pricing/            # Pricing tier logic
│   │   └── utils.ts            # Utility functions
│   ├── types/                  # TypeScript types
│   └── middleware.ts           # Auth middleware
└── supabase/
    └── migrations/             # Database schema
```

## 🌐 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (your Vercel domain)
5. Deploy!

### Build for Production

```bash
npm run build
npm start
```

## 🔒 Security

- Row Level Security (RLS) enabled on all Supabase tables
- Server-side auth validation via middleware
- Service role key only used server-side
- Input validation with Zod schemas
- CSRF protection via Supabase's built-in mechanisms

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

Built with ❤️ for Indian wholesale distributors and retailers.
