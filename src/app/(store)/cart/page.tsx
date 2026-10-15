'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatPrice, getEffectivePrice, validateQuantity } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';
import { ShoppingCart, Minus, Plus, Trash2, ArrowRight, Package } from 'lucide-react';
import type { CartItemWithVariant } from '@/types/database';

export default function CartPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItemWithVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const loadCart = useCallback(async () => {
    if (!user) return;
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (!cart) {
      setLoading(false);
      return;
    }

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
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const updateQuantity = async (itemId: string, newQty: number, moq: number, step: number) => {
    const validation = validateQuantity(newQty, moq, step);
    const finalQty = validation.valid ? newQty : validation.corrected || moq;

    setUpdating(itemId);
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: finalQty })
      .eq('id', itemId);

    if (error) {
      toast({ title: 'Failed to update', variant: 'destructive' });
    } else {
      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, quantity: finalQty } : item))
      );
    }
    setUpdating(null);
  };

  const removeItem = async (itemId: string) => {
    setUpdating(itemId);
    await supabase.from('cart_items').delete().eq('id', itemId);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    setUpdating(null);
    toast({ title: 'Item removed from cart' });
  };

  // Calculate totals (display only — server recalculates at checkout)
  const subtotal = items.reduce((sum, item) => {
    const price = getEffectivePrice(item.variant);
    return sum + price * item.quantity;
  }, 0);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 page-transition">
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
        <ShoppingCart className="w-5 h-5" /> Cart ({items.length})
      </h1>

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => {
            const price = getEffectivePrice(item.variant);
            return (
              <Card key={item.id} className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {item.variant.product?.images?.[0] ? (
                        <img src={item.variant.product.images[0]} alt="" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <Package className="w-6 h-6 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium truncate">{item.variant.product?.name}</h3>
                      <p className="text-xs text-muted-foreground">{item.variant.variant_name}</p>
                      <p className="text-sm font-bold text-primary mt-1">{formatPrice(price)}</p>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive p-1 self-start">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <button
                        className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-muted disabled:opacity-50"
                        onClick={() => updateQuantity(item.id, item.quantity - item.variant.quantity_step, item.variant.moq, item.variant.quantity_step)}
                        disabled={item.quantity <= item.variant.moq || updating === item.id}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-10 text-center font-medium text-sm">{item.quantity}</span>
                      <button
                        className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-muted disabled:opacity-50"
                        onClick={() => updateQuantity(item.id, item.quantity + item.variant.quantity_step, item.variant.moq, item.variant.quantity_step)}
                        disabled={updating === item.id}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="font-bold">{formatPrice(price * item.quantity)}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Order Summary */}
          <Card className="border-0 shadow-md sticky bottom-20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({items.length} items)</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span className="text-xs text-emerald-600 font-medium">Calculated at checkout</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-semibold">Estimated Total</span>
                <span className="text-lg font-bold text-primary">{formatPrice(subtotal)}</span>
              </div>
              <Button size="lg" className="w-full mt-2" onClick={() => router.push('/checkout')}>
                Proceed to Checkout <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingCart className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Your cart is empty</p>
          <p className="text-sm mt-1">Browse products and add items to your cart</p>
          <Button className="mt-4" onClick={() => router.push('/')}>
            Browse Products
          </Button>
        </div>
      )}
    </div>
  );
}
