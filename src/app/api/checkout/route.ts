// ============================================================
// Store2Door — Checkout API
// Server-side order creation with price validation
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { calculateOrderPricing } from '@/lib/pricing/engine';
import type { BusinessSettingsMap, ProductVariant } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { address_id, payment_method = 'COD', retailer_notes } = body;

    if (!address_id) {
      return NextResponse.json({ error: 'Delivery address required' }, { status: 400 });
    }

    // 1. Get retailer
    const { data: retailer } = await supabase
      .from('retailers')
      .select('*')
      .eq('profile_id', user.id)
      .single();

    if (!retailer) {
      return NextResponse.json({ error: 'Retailer profile not found' }, { status: 404 });
    }

    if (retailer.is_blocked) {
      return NextResponse.json({ error: 'Your account is blocked. Contact support.' }, { status: 403 });
    }

    // 2. Get address
    const { data: address } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', address_id)
      .eq('profile_id', user.id)
      .single();

    if (!address) {
      return NextResponse.json({ error: 'Invalid delivery address' }, { status: 404 });
    }

    // 3. Get cart items with variants
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    const { data: cartItems } = await supabase
      .from('cart_items')
      .select(`
        *,
        variant:product_variants(*)
      `)
      .eq('cart_id', cart.id);

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // 4. Check store open status
    const { data: settings } = await supabase
      .from('business_settings')
      .select('key, value');

    const settingsMap: Partial<BusinessSettingsMap> = {};
    settings?.forEach((s) => {
      settingsMap[s.key as keyof BusinessSettingsMap] = s.value;
    });

    if (settingsMap.store_open === 'false' && settingsMap.accept_orders_when_closed !== 'true') {
      return NextResponse.json({ error: 'Store is currently closed' }, { status: 400 });
    }

    // 5. Check service area
    const { data: serviceArea } = await supabase
      .from('service_areas')
      .select('*')
      .eq('pincode', address.pincode)
      .eq('locality', address.locality)
      .eq('is_serviceable', true)
      .single();

    // 6. SERVER-SIDE PRICE CALCULATION (authoritative)
    const pricingItems = cartItems.map((ci) => ({
      variant: ci.variant as unknown as ProductVariant,
      quantity: ci.quantity,
    }));

    const pricing = calculateOrderPricing(pricingItems, settingsMap, serviceArea);

    if (pricing.errors.length > 0) {
      return NextResponse.json({ error: pricing.errors.join('; ') }, { status: 400 });
    }

    // 7. Use admin client for transactional operations
    const adminSupabase = await createAdminSupabaseClient();

    // Generate order number
    const { data: seqData } = await adminSupabase.rpc('nextval', { seq_name: 'order_number_seq' });
    const seq = seqData || Date.now() % 100000;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const orderNumber = `S2D-${dateStr}-${String(seq).padStart(5, '0')}`;

    // Set payment status based on method
    const paymentStatus = payment_method === 'COD' ? 'COD_PENDING' : 'PENDING';

    // 8. Create order
    const { data: order, error: orderError } = await adminSupabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        profile_id: user.id,
        retailer_id: retailer.id,
        address_snapshot: {
          full_name: address.full_name,
          phone: address.phone,
          pincode: address.pincode,
          locality: address.locality,
          full_address: address.full_address,
          landmark: address.landmark,
          latitude: address.latitude,
          longitude: address.longitude,
        },
        items_subtotal: pricing.items_subtotal,
        discount_amount: pricing.discount_amount,
        delivery_charge: pricing.delivery_charge,
        handling_charge: pricing.handling_charge,
        tax_amount: pricing.tax_amount,
        total_amount: pricing.total_amount,
        payment_method,
        payment_status: paymentStatus,
        order_status: 'PENDING',
        source: 'APP',
        retailer_notes: retailer_notes || null,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Order creation error:', orderError);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // 9. Create order items with price snapshots
    const orderItems = [];
    for (const pricingItem of pricing.items) {
      const cartItem = cartItems.find((ci) => (ci.variant as unknown as ProductVariant).id === pricingItem.variant_id);
      if (!cartItem) continue;
      const variant = cartItem.variant as unknown as ProductVariant;

      orderItems.push({
        order_id: order.id,
        variant_id: variant.id,
        product_name_snapshot: variant.variant_name, // Will be updated with product name
        variant_name_snapshot: variant.variant_name,
        sku_snapshot: variant.sku,
        unit_price: pricingItem.unit_price,
        purchase_cost_snapshot: variant.purchase_price,
        tax_rate_snapshot: variant.gst_percentage,
        quantity: pricingItem.quantity,
        line_total: pricingItem.line_total,
      });
    }

    await adminSupabase.from('order_items').insert(orderItems);

    // 10. Create order status history
    await adminSupabase.from('order_status_history').insert({
      order_id: order.id,
      from_status: null,
      to_status: 'PENDING',
      changed_by: user.id,
      notes: 'Order placed',
    });

    // 11. Reserve stock (inventory transactions)
    for (const pricingItem of pricing.items) {
      const cartItem = cartItems.find((ci) => (ci.variant as unknown as ProductVariant).id === pricingItem.variant_id);
      if (!cartItem) continue;
      const variant = cartItem.variant as unknown as ProductVariant;

      // Update reserved stock
      await adminSupabase
        .from('product_variants')
        .update({ reserved_stock: variant.reserved_stock + pricingItem.quantity })
        .eq('id', variant.id);

      // Create inventory transaction
      await adminSupabase.from('inventory_transactions').insert({
        variant_id: variant.id,
        type: 'ORDER_RESERVATION',
        quantity_before: variant.stock,
        quantity_change: -pricingItem.quantity,
        quantity_after: variant.stock,
        reason: `Order ${orderNumber}`,
        reference_id: order.id,
        reference_type: 'order',
        performed_by: user.id,
      });
    }

    // 12. Create payment record
    await adminSupabase.from('payments').insert({
      order_id: order.id,
      payment_method,
      amount: pricing.total_amount,
      status: paymentStatus,
    });

    // 13. Update retailer stats
    await adminSupabase
      .from('retailers')
      .update({
        total_orders: retailer.total_orders + 1,
        lifetime_purchase: retailer.lifetime_purchase + pricing.total_amount,
        last_order_at: new Date().toISOString(),
      })
      .eq('id', retailer.id);

    // 14. Clear cart
    await adminSupabase.from('cart_items').delete().eq('cart_id', cart.id);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        order_number: orderNumber,
        total_amount: pricing.total_amount,
      },
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
