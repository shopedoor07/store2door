// ============================================================
// Store2Door — Server-side Pricing Engine
// ALL price calculations happen HERE, never on client
// ============================================================

import type { BusinessSettingsMap, ProductVariant, ServiceArea } from '@/types/database';

interface CartItemForPricing {
  variant: ProductVariant;
  quantity: number;
}

interface PricingResult {
  items: Array<{
    variant_id: string;
    unit_price: number;
    quantity: number;
    line_total: number;
    tax_amount: number;
  }>;
  items_subtotal: number;
  discount_amount: number;
  delivery_charge: number;
  handling_charge: number;
  tax_amount: number;
  total_amount: number;
  errors: string[];
}

export function calculateOrderPricing(
  cartItems: CartItemForPricing[],
  settings: Partial<BusinessSettingsMap>,
  serviceArea?: ServiceArea | null
): PricingResult {
  const errors: string[] = [];
  const items: PricingResult['items'] = [];

  // Validate and calculate each item
  for (const item of cartItems) {
    const { variant, quantity } = item;

    // Check stock
    const available = variant.stock - variant.reserved_stock;
    if (quantity > available) {
      errors.push(`${variant.variant_name}: Only ${available} available`);
      continue;
    }

    // Check MOQ
    if (quantity < variant.moq) {
      errors.push(`${variant.variant_name}: Minimum order quantity is ${variant.moq}`);
      continue;
    }

    // Check step
    if (variant.quantity_step > 1 && (quantity - variant.moq) % variant.quantity_step !== 0) {
      errors.push(`${variant.variant_name}: Quantity must be in steps of ${variant.quantity_step}`);
      continue;
    }

    // Check max
    if (variant.max_order_quantity && quantity > variant.max_order_quantity) {
      errors.push(`${variant.variant_name}: Maximum ${variant.max_order_quantity} allowed`);
      continue;
    }

    // Calculate price
    const unitPrice =
      variant.offer_price !== null && variant.offer_price > 0 && variant.offer_price < variant.wholesale_price
        ? variant.offer_price
        : variant.wholesale_price;

    const lineTotal = unitPrice * quantity;
    const taxAmount = (lineTotal * variant.gst_percentage) / 100;

    items.push({
      variant_id: variant.id,
      unit_price: unitPrice,
      quantity,
      line_total: lineTotal,
      tax_amount: taxAmount,
    });
  }

  // Calculate subtotal
  const itemsSubtotal = items.reduce((sum, i) => sum + i.line_total, 0);
  const taxAmount = items.reduce((sum, i) => sum + i.tax_amount, 0);
  const discountAmount = 0; // Future: coupon/discount logic

  // Delivery charge calculation
  const globalMinOrder = parseFloat(settings.minimum_order_value || '0');
  const globalDeliveryCharge = parseFloat(settings.delivery_charge || '0');
  const globalFreeThreshold = parseFloat(settings.free_delivery_threshold || '0');
  const globalHandlingCharge = parseFloat(settings.handling_charge || '0');

  // Use service area overrides if available
  const minOrder = serviceArea?.minimum_order ?? globalMinOrder;
  const baseDeliveryCharge = serviceArea?.delivery_charge ?? globalDeliveryCharge;
  const freeThreshold = serviceArea?.free_delivery_threshold ?? globalFreeThreshold;
  const handlingCharge = serviceArea?.handling_charge ?? globalHandlingCharge;

  // Check minimum order
  if (itemsSubtotal < minOrder) {
    errors.push(`Minimum order value is ₹${minOrder}`);
  }

  // Free delivery check
  const deliveryCharge = itemsSubtotal >= freeThreshold && freeThreshold > 0 ? 0 : baseDeliveryCharge;

  const totalAmount = itemsSubtotal - discountAmount + deliveryCharge + handlingCharge + taxAmount;

  return {
    items,
    items_subtotal: Math.round(itemsSubtotal * 100) / 100,
    discount_amount: Math.round(discountAmount * 100) / 100,
    delivery_charge: Math.round(deliveryCharge * 100) / 100,
    handling_charge: Math.round(handlingCharge * 100) / 100,
    tax_amount: Math.round(taxAmount * 100) / 100,
    total_amount: Math.round(totalAmount * 100) / 100,
    errors,
  };
}
