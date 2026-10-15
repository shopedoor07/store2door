-- ============================================================
-- Store2Door — Complete Database Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'RETAILER' CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'STAFF', 'RETAILER')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'RETAILER')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. RETAILERS
-- ============================================================
CREATE TABLE IF NOT EXISTS retailers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  shop_type TEXT,
  gstin TEXT,
  default_address_id UUID,
  total_orders INTEGER NOT NULL DEFAULT 0,
  lifetime_purchase NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_retailers_profile_id ON retailers(profile_id);

-- ============================================================
-- 3. ADDRESSES
-- ============================================================
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Shop',
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pincode TEXT NOT NULL,
  locality TEXT NOT NULL,
  full_address TEXT NOT NULL,
  landmark TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_addresses_profile_id ON addresses(profile_id);

-- ============================================================
-- 4. CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  image_url TEXT,
  icon_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. SUBCATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS subcategories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subcategories_category_id ON subcategories(category_id);

-- ============================================================
-- 6. BRANDS
-- ============================================================
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_bestseller BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_name_search ON products USING gin(to_tsvector('english', name));

-- ============================================================
-- 8. PRODUCT VARIANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT,
  variant_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  pack_size TEXT,
  pieces_per_case INTEGER,
  mrp NUMERIC(10,2) NOT NULL CHECK (mrp >= 0),
  purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  wholesale_price NUMERIC(10,2) NOT NULL CHECK (wholesale_price >= 0),
  offer_price NUMERIC(10,2) CHECK (offer_price IS NULL OR offer_price >= 0),
  gst_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  hsn_code TEXT,
  moq INTEGER NOT NULL DEFAULT 1 CHECK (moq >= 1),
  quantity_step INTEGER NOT NULL DEFAULT 1 CHECK (quantity_step >= 1),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  max_order_quantity INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);

-- ============================================================
-- 9. INVENTORY TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN (
    'OPENING_STOCK', 'PURCHASE_INWARD', 'MANUAL_ADDITION', 'MANUAL_DEDUCTION',
    'ORDER_RESERVATION', 'SALE', 'CANCELLATION_RELEASE', 'RETURN', 'DAMAGE', 'ADJUSTMENT'
  )),
  quantity_before INTEGER NOT NULL,
  quantity_change INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason TEXT,
  reference_id TEXT,
  reference_type TEXT,
  performed_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inv_tx_variant_id ON inventory_transactions(variant_id);
CREATE INDEX idx_inv_tx_created_at ON inventory_transactions(created_at);

-- ============================================================
-- 10. CARTS
-- ============================================================
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 11. CART ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cart_id, variant_id)
);

CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);

-- ============================================================
-- 12. ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  retailer_id UUID NOT NULL REFERENCES retailers(id),
  address_snapshot JSONB NOT NULL DEFAULT '{}',
  items_subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
  handling_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'COD' CHECK (payment_method IN ('COD', 'ONLINE', 'UPI')),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN (
    'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'COD_PENDING', 'COD_COLLECTED'
  )),
  order_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (order_status IN (
    'PENDING', 'CONFIRMED', 'PICKING', 'PACKED', 'READY_FOR_DISPATCH',
    'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'
  )),
  source TEXT NOT NULL DEFAULT 'APP' CHECK (source IN ('APP', 'PHONE', 'PARCHA', 'WHATSAPP', 'ADMIN')),
  parcha_request_id UUID,
  retailer_notes TEXT,
  admin_notes TEXT,
  created_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_profile_id ON orders(profile_id);
CREATE INDEX idx_orders_retailer_id ON orders(retailer_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(order_status);

-- Sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- ============================================================
-- 13. ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  product_name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT NOT NULL,
  sku_snapshot TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  purchase_cost_snapshot NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate_snapshot NUMERIC(5,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ============================================================
-- 14. ORDER STATUS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_history_order_id ON order_status_history(order_id);

-- ============================================================
-- 15. PARCHA REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS parcha_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slip_number TEXT NOT NULL UNIQUE,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  retailer_id UUID NOT NULL REFERENCES retailers(id),
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  instructions TEXT,
  preferred_delivery_time TEXT,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN (
    'NEW', 'REVIEWING', 'CUSTOMER_CONTACTED', 'CONFIRMED',
    'CONVERTED_TO_ORDER', 'REJECTED', 'CANCELLED'
  )),
  order_id UUID REFERENCES orders(id),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_parcha_profile_id ON parcha_requests(profile_id);
CREATE INDEX idx_parcha_status ON parcha_requests(status);

-- Sequence for slip numbers
CREATE SEQUENCE IF NOT EXISTS slip_number_seq START 1;

-- ============================================================
-- 16. PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  gateway_order_id TEXT,
  gateway_payment_id TEXT,
  gateway_signature TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_order_id ON payments(order_id);

-- ============================================================
-- 17. SERVICE AREAS
-- ============================================================
CREATE TABLE IF NOT EXISTS service_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pincode TEXT NOT NULL,
  locality TEXT NOT NULL,
  district TEXT,
  state TEXT,
  is_serviceable BOOLEAN NOT NULL DEFAULT true,
  minimum_order NUMERIC(10,2),
  delivery_charge NUMERIC(10,2),
  handling_charge NUMERIC(10,2),
  free_delivery_threshold NUMERIC(10,2),
  estimated_delivery_time TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pincode, locality)
);

CREATE INDEX idx_service_areas_pincode ON service_areas(pincode);

-- ============================================================
-- 18. BANNERS
-- ============================================================
CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_url TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  cta_text TEXT,
  target_type TEXT,
  target_value TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 19. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  deep_link TEXT,
  audience_type TEXT NOT NULL DEFAULT 'all',
  audience_value TEXT,
  sent_by UUID NOT NULL REFERENCES profiles(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 20. BUSINESS SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS business_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO business_settings (key, value, description) VALUES
  ('business_name', 'Store2Door', 'Business display name'),
  ('business_logo', '', 'Logo URL'),
  ('support_phone', '', 'Support phone number'),
  ('whatsapp_number', '', 'WhatsApp number'),
  ('support_email', '', 'Support email'),
  ('business_address', '', 'Business address'),
  ('store_open', 'true', 'Store open/closed status'),
  ('opening_time', '08:00', 'Store opening time'),
  ('closing_time', '21:00', 'Store closing time'),
  ('closed_message', 'Store2Door is currently closed. We will be back soon!', 'Message when store is closed'),
  ('accept_orders_when_closed', 'false', 'Accept orders when store is closed'),
  ('default_delivery_eta', '1 hour', 'Default estimated delivery time'),
  ('minimum_order_value', '500', 'Minimum order amount'),
  ('delivery_charge', '50', 'Default delivery charge'),
  ('free_delivery_threshold', '2000', 'Free delivery above this amount'),
  ('handling_charge', '0', 'Handling charge'),
  ('cod_enabled', 'true', 'Cash on delivery enabled'),
  ('online_payment_enabled', 'false', 'Online payment enabled'),
  ('currency', 'INR', 'Currency'),
  ('timezone', 'Asia/Kolkata', 'Timezone')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 21. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcha_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role IN ('SUPER_ADMIN', 'ADMIN', 'STAFF') AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING (is_admin(auth.uid()));

-- RETAILERS policies
CREATE POLICY "Users can view own retailer" ON retailers FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Users can insert own retailer" ON retailers FOR INSERT WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Users can update own retailer" ON retailers FOR UPDATE USING (profile_id = auth.uid());
CREATE POLICY "Admins can do anything with retailers" ON retailers FOR ALL USING (is_admin(auth.uid()));

-- ADDRESSES policies
CREATE POLICY "Users can manage own addresses" ON addresses FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Admins can view all addresses" ON addresses FOR SELECT USING (is_admin(auth.uid()));

-- CATEGORIES / SUBCATEGORIES / BRANDS — public read, admin write
CREATE POLICY "Anyone can view active categories" ON categories FOR SELECT USING (is_active = true OR is_admin(auth.uid()));
CREATE POLICY "Admins manage categories" ON categories FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Anyone can view active subcategories" ON subcategories FOR SELECT USING (is_active = true OR is_admin(auth.uid()));
CREATE POLICY "Admins manage subcategories" ON subcategories FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Anyone can view active brands" ON brands FOR SELECT USING (is_active = true OR is_admin(auth.uid()));
CREATE POLICY "Admins manage brands" ON brands FOR ALL USING (is_admin(auth.uid()));

-- PRODUCTS — public read (active only), admin write
CREATE POLICY "Anyone can view active products" ON products FOR SELECT USING (is_active = true OR is_admin(auth.uid()));
CREATE POLICY "Admins manage products" ON products FOR ALL USING (is_admin(auth.uid()));

-- PRODUCT VARIANTS — public read (EXCLUDING purchase_price), admin write
-- Note: purchase_price filtering is done at API level, not RLS
CREATE POLICY "Anyone can view active variants" ON product_variants FOR SELECT USING (is_active = true OR is_admin(auth.uid()));
CREATE POLICY "Admins manage variants" ON product_variants FOR ALL USING (is_admin(auth.uid()));

-- INVENTORY TRANSACTIONS — admin only
CREATE POLICY "Admins manage inventory" ON inventory_transactions FOR ALL USING (is_admin(auth.uid()));

-- CARTS — own cart only
CREATE POLICY "Users manage own cart" ON carts FOR ALL USING (profile_id = auth.uid());

-- CART ITEMS — via cart ownership
CREATE POLICY "Users manage own cart items" ON cart_items FOR ALL
  USING (EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.profile_id = auth.uid()));

-- ORDERS — own orders + admin
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Users can create orders" ON orders FOR INSERT WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Admins manage all orders" ON orders FOR ALL USING (is_admin(auth.uid()));

-- ORDER ITEMS
CREATE POLICY "Users can view own order items" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.profile_id = auth.uid()));
CREATE POLICY "Admins manage order items" ON order_items FOR ALL USING (is_admin(auth.uid()));

-- ORDER STATUS HISTORY
CREATE POLICY "Users can view own order history" ON order_status_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.profile_id = auth.uid()));
CREATE POLICY "Admins manage order history" ON order_status_history FOR ALL USING (is_admin(auth.uid()));

-- PARCHA REQUESTS — own + admin
CREATE POLICY "Users manage own parcha" ON parcha_requests FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "Admins manage all parcha" ON parcha_requests FOR ALL USING (is_admin(auth.uid()));

-- PAYMENTS — own (read only) + admin
CREATE POLICY "Users can view own payments" ON payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id AND orders.profile_id = auth.uid()));
CREATE POLICY "Admins manage payments" ON payments FOR ALL USING (is_admin(auth.uid()));

-- SERVICE AREAS — public read, admin write
CREATE POLICY "Anyone can view service areas" ON service_areas FOR SELECT USING (true);
CREATE POLICY "Admins manage service areas" ON service_areas FOR ALL USING (is_admin(auth.uid()));

-- BANNERS — public read active, admin write
CREATE POLICY "Anyone can view active banners" ON banners FOR SELECT USING (is_active = true OR is_admin(auth.uid()));
CREATE POLICY "Admins manage banners" ON banners FOR ALL USING (is_admin(auth.uid()));

-- NOTIFICATIONS — authenticated read, admin write
CREATE POLICY "Users can view notifications" ON notifications FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage notifications" ON notifications FOR ALL USING (is_admin(auth.uid()));

-- BUSINESS SETTINGS — public read, admin write
CREATE POLICY "Anyone can view settings" ON business_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage settings" ON business_settings FOR ALL USING (is_admin(auth.uid()));

-- AUDIT LOGS — admin only
CREATE POLICY "Admins can view audit logs" ON audit_logs FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert audit logs" ON audit_logs FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('categories', 'categories', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('brands', 'brands', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('parcha', 'parcha', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Public read for products" ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "Admin upload products" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'products' AND is_admin(auth.uid()));
CREATE POLICY "Public read for categories" ON storage.objects FOR SELECT USING (bucket_id = 'categories');
CREATE POLICY "Admin upload categories" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'categories' AND is_admin(auth.uid()));
CREATE POLICY "Public read for brands" ON storage.objects FOR SELECT USING (bucket_id = 'brands');
CREATE POLICY "Admin upload brands" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'brands' AND is_admin(auth.uid()));
CREATE POLICY "Public read for banners" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
CREATE POLICY "Admin upload banners" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'banners' AND is_admin(auth.uid()));
CREATE POLICY "Users upload parcha" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'parcha' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users read own parcha" ON storage.objects FOR SELECT USING (bucket_id = 'parcha' AND auth.uid() IS NOT NULL);
CREATE POLICY "Admin read all parcha" ON storage.objects FOR SELECT USING (bucket_id = 'parcha' AND is_admin(auth.uid()));
CREATE POLICY "Users manage own avatar" ON storage.objects FOR ALL USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- UPDATED_AT AUTO-UPDATE TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'profiles', 'retailers', 'addresses', 'categories', 'subcategories',
      'brands', 'products', 'product_variants', 'carts', 'cart_items',
      'orders', 'parcha_requests', 'payments', 'service_areas', 'banners'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', tbl);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', tbl);
  END LOOP;
END;
$$;
