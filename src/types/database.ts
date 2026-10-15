// ============================================================
// Store2Door — Complete Database Types
// ============================================================

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'STAFF' | 'RETAILER';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PICKING'
  | 'PACKED'
  | 'READY_FOR_DISPATCH'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentMethod = 'COD' | 'ONLINE' | 'UPI';

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'COD_PENDING'
  | 'COD_COLLECTED';

export type ParchaStatus =
  | 'NEW'
  | 'REVIEWING'
  | 'CUSTOMER_CONTACTED'
  | 'CONFIRMED'
  | 'CONVERTED_TO_ORDER'
  | 'REJECTED'
  | 'CANCELLED';

export type OrderSource = 'APP' | 'PHONE' | 'PARCHA' | 'WHATSAPP' | 'ADMIN';

export type InventoryTransactionType =
  | 'OPENING_STOCK'
  | 'PURCHASE_INWARD'
  | 'MANUAL_ADDITION'
  | 'MANUAL_DEDUCTION'
  | 'ORDER_RESERVATION'
  | 'SALE'
  | 'CANCELLATION_RELEASE'
  | 'RETURN'
  | 'DAMAGE'
  | 'ADJUSTMENT';

// ============================================================
// Table Types
// ============================================================

export interface Profile {
  id: string; // UUID, same as auth.users.id
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Retailer {
  id: string;
  profile_id: string;
  shop_name: string;
  shop_type: string | null;
  gstin: string | null;
  default_address_id: string | null;
  total_orders: number;
  lifetime_purchase: number;
  last_order_at: string | null;
  is_blocked: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  profile_id: string;
  label: string;
  full_name: string;
  phone: string;
  pincode: string;
  locality: string;
  full_address: string;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  subcategory_id: string | null;
  brand_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  images: string[];
  is_active: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  barcode: string | null;
  variant_name: string; // e.g., "100g", "500g", "1kg"
  unit: string; // e.g., "g", "kg", "ml", "L", "pcs"
  pack_size: string | null;
  pieces_per_case: number | null;
  mrp: number;
  purchase_price: number; // ADMIN ONLY — never exposed to retailers
  wholesale_price: number;
  offer_price: number | null;
  gst_percentage: number;
  hsn_code: string | null;
  moq: number; // Minimum Order Quantity
  quantity_step: number;
  stock: number;
  reserved_stock: number;
  low_stock_threshold: number;
  max_order_quantity: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  variant_id: string;
  type: InventoryTransactionType;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  reason: string | null;
  reference_id: string | null; // order_id or other reference
  reference_type: string | null; // 'order', 'manual', etc.
  performed_by: string;
  created_at: string;
}

export interface Cart {
  id: string;
  profile_id: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  variant_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string; // e.g., S2D-20260929-00125
  profile_id: string;
  retailer_id: string;
  address_snapshot: Record<string, unknown>;
  items_subtotal: number;
  discount_amount: number;
  delivery_charge: number;
  handling_charge: number;
  tax_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  source: OrderSource;
  parcha_request_id: string | null;
  retailer_notes: string | null;
  admin_notes: string | null;
  created_by_admin: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string;
  product_name_snapshot: string;
  variant_name_snapshot: string;
  sku_snapshot: string;
  unit_price: number;
  purchase_cost_snapshot: number; // ADMIN ONLY
  tax_rate_snapshot: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string;
  notes: string | null;
  created_at: string;
}

export interface ParchaRequest {
  id: string;
  slip_number: string; // e.g., SLIP-20260929-00123
  profile_id: string;
  retailer_id: string;
  image_urls: string[];
  instructions: string | null;
  preferred_delivery_time: string | null;
  status: ParchaStatus;
  order_id: string | null; // linked order after conversion
  admin_notes: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  payment_method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  gateway_signature: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceArea {
  id: string;
  pincode: string;
  locality: string;
  district: string | null;
  state: string | null;
  is_serviceable: boolean;
  minimum_order: number | null;
  delivery_charge: number | null;
  handling_charge: number | null;
  free_delivery_threshold: number | null;
  estimated_delivery_time: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Banner {
  id: string;
  image_url: string;
  title: string | null;
  subtitle: string | null;
  cta_text: string | null;
  target_type: string | null; // 'product', 'category', 'url'
  target_value: string | null;
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  deep_link: string | null;
  audience_type: string; // 'all', 'locality', 'pincode', 'selected'
  audience_value: string | null;
  sent_by: string;
  sent_at: string;
  created_at: string;
}

export interface BusinessSettings {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================
// Joined / View Types (for queries)
// ============================================================

export interface ProductWithVariants extends Product {
  category?: Category;
  subcategory?: Subcategory;
  brand?: Brand;
  variants: ProductVariant[];
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  status_history?: OrderStatusHistory[];
  retailer?: Retailer;
  profile?: Profile;
}

export interface CartItemWithVariant extends CartItem {
  variant: ProductVariant & {
    product: Product;
  };
}

export interface ParchaRequestWithDetails extends ParchaRequest {
  profile?: Profile;
  retailer?: Retailer;
  order?: Order;
}

// ============================================================
// API / Form Types
// ============================================================

export interface RegisterFormData {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  shop_name: string;
  shop_type: string;
  gstin?: string;
  pincode: string;
  locality: string;
  full_address: string;
  landmark?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface AddToCartData {
  variant_id: string;
  quantity: number;
}

export interface CheckoutData {
  address_id: string;
  payment_method: PaymentMethod;
  retailer_notes?: string;
}

export interface ParchaSubmitData {
  images: File[];
  instructions?: string;
  preferred_delivery_time?: string;
}

export interface BusinessSettingsMap {
  business_name: string;
  business_logo: string;
  support_phone: string;
  whatsapp_number: string;
  support_email: string;
  business_address: string;
  store_open: string; // 'true' | 'false'
  opening_time: string;
  closing_time: string;
  closed_message: string;
  accept_orders_when_closed: string; // 'true' | 'false'
  default_delivery_eta: string;
  minimum_order_value: string;
  delivery_charge: string;
  free_delivery_threshold: string;
  handling_charge: string;
  cod_enabled: string; // 'true' | 'false'
  online_payment_enabled: string; // 'true' | 'false'
  currency: string;
  timezone: string;
}
