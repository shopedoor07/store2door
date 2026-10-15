'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatPrice, getEffectivePrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';
import {
  ArrowLeft, MapPin, CreditCard, Banknote, Truck,
  Plus, ShieldCheck, Clock, Package, Loader2
} from 'lucide-react';
import type { Address, CartItemWithVariant } from '@/types/database';

export default function CheckoutPage() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [items, setItems] = useState<CartItemWithVariant[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'ONLINE' | 'UPI'>('COD');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;

    // Load cart items
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (cart) {
      const { data: cartItems } = await supabase
        .from('cart_items')
        .select(`
          *,
          variant:product_variants(
            *,
            product:products(*)
          )
        `)
        .eq('cart_id', cart.id);

      if (cartItems) setItems(cartItems as unknown as CartItemWithVariant[]);
    }

    // Load addresses
    const { data: addrData } = await supabase
      .from('addresses')
      .select('*')
      .eq('profile_id', user.id)
      .order('is_default', { ascending: false });

    if (addrData) {
      setAddresses(addrData as Address[]);
      const defaultAddr = addrData.find((a) => a.is_default) || addrData[0];
      if (defaultAddr) setSelectedAddress(defaultAddr.id);
    }

    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const subtotal = items.reduce((sum, item) => {
    const price = getEffectivePrice(item.variant);
    return sum + price * item.quantity;
  }, 0);

  const placeOrder = async () => {
    if (!selectedAddress) {
      toast({ title: 'Please select a delivery address', variant: 'destructive' });
      return;
    }
    if (items.length === 0) {
      toast({ title: 'Cart is empty', variant: 'destructive' });
      return;
    }

    setPlacing(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address_id: selectedAddress,
          payment_method: paymentMethod,
          retailer_notes: notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: data.error || 'Failed to place order', variant: 'destructive' });
        setPlacing(false);
        return;
      }

      toast({ title: 'Order placed successfully! 🎉', description: `Order #${data.order.order_number}` });
      router.push(`/orders/${data.order.id}`);
    } catch {
      toast({ title: 'Something went wrong', variant: 'destructive' });
    }
    setPlacing(false);
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center text-muted-foreground">
        <Package className="w-16 h-16 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Your cart is empty</p>
        <Button className="mt-4" onClick={() => router.push('/')}>Browse Products</Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 page-transition">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Checkout</h1>
      </div>

      <div className="space-y-4">
        {/* Delivery Address */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Delivery Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {addresses.length > 0 ? (
              addresses.map((addr) => (
                <button
                  key={addr.id}
                  onClick={() => setSelectedAddress(addr.id)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    selectedAddress === addr.id
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold text-primary uppercase">{addr.label}</span>
                      <p className="text-sm font-medium mt-0.5">{addr.full_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {addr.full_address}, {addr.locality} - {addr.pincode}
                      </p>
                      <p className="text-xs text-muted-foreground">{addr.phone}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                      selectedAddress === addr.id ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                    }`}>
                      {selectedAddress === addr.id && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">No saved addresses</p>
                <Link href="/account/addresses">
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4" /> Add Address
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Items Summary */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" /> Order Items ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((item) => {
              const price = getEffectivePrice(item.variant);
              return (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {item.variant.product?.images?.[0] ? (
                      <img src={item.variant.product.images[0]} alt="" className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <Package className="w-4 h-4 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.variant.product?.name}</p>
                    <p className="text-xs text-muted-foreground">{item.variant.variant_name} × {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatPrice(price * item.quantity)}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" /> Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { id: 'COD' as const, label: 'Cash on Delivery', icon: Banknote, desc: 'Pay when order is delivered' },
              { id: 'UPI' as const, label: 'UPI', icon: CreditCard, desc: 'Pay via UPI (Coming soon)' },
              { id: 'ONLINE' as const, label: 'Online Payment', icon: CreditCard, desc: 'Card/NetBanking (Coming soon)' },
            ].map((method) => (
              <button
                key={method.id}
                onClick={() => setPaymentMethod(method.id)}
                disabled={method.id !== 'COD'} // Only COD active for now
                className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  paymentMethod === method.id
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/30'
                } ${method.id !== 'COD' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <method.icon className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{method.label}</p>
                  <p className="text-[11px] text-muted-foreground">{method.desc}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  paymentMethod === method.id ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                }`}>
                  {paymentMethod === method.id && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Order Notes */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Order Notes (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions for this order..."
              className="w-full h-20 rounded-xl border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </CardContent>
        </Card>

        {/* Delivery Info */}
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Delivery charges will be calculated based on your area</span>
        </div>
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Expected delivery within 24 hours</span>
        </div>
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>100% genuine products guaranteed</span>
        </div>

        {/* Order Total & Place Order */}
        <Card className="border-0 shadow-md sticky bottom-20">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal ({items.length} items)</span>
              <span className="font-medium">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery</span>
              <span className="text-xs text-emerald-600 font-medium">Calculated at server</span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="font-semibold">Estimated Total</span>
              <span className="text-lg font-bold text-primary">{formatPrice(subtotal)}</span>
            </div>
            <Button
              size="lg"
              className="w-full mt-2"
              onClick={placeOrder}
              disabled={placing || !selectedAddress}
            >
              {placing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Placing Order...</>
              ) : (
                `Place Order — ${formatPrice(subtotal)}`
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
