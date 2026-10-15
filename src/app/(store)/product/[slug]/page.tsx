'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatPrice, getEffectivePrice, getDiscountPercentage, validateQuantity } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';
import {
  ShoppingCart, Package, ArrowLeft, Minus, Plus,
  Share2, ChevronRight, Truck, ShieldCheck, RotateCcw
} from 'lucide-react';
import type { Product, ProductVariant, Category } from '@/types/database';

interface ProductFull extends Product {
  variants: ProductVariant[];
  category: Category;
}

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const { user } = useAuth();

  const [product, setProduct] = useState<ProductFull | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);

  const supabase = createClient();

  useEffect(() => {
    async function loadProduct() {
      const { data } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          variants:product_variants(*)
        `)
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (data) {
        const prod = data as unknown as ProductFull;
        setProduct(prod);
        // Select first active variant
        const firstActive = prod.variants?.find((v) => v.is_active) || prod.variants?.[0];
        if (firstActive) {
          setSelectedVariant(firstActive);
          setQuantity(firstActive.moq);
        }
      }
      setLoading(false);
    }
    loadProduct();
  }, [slug, supabase]);

  const addToCart = useCallback(async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!selectedVariant) return;

    setAdding(true);
    try {
      // Get or create cart
      let { data: cart } = await supabase
        .from('carts')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!cart) {
        const { data: newCart } = await supabase
          .from('carts')
          .insert({ profile_id: user.id })
          .select('id')
          .single();
        cart = newCart;
      }

      if (!cart) {
        toast({ title: 'Failed to create cart', variant: 'destructive' });
        setAdding(false);
        return;
      }

      // Check if variant already in cart
      const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cart.id)
        .eq('variant_id', selectedVariant.id)
        .single();

      if (existing) {
        // Update quantity
        await supabase
          .from('cart_items')
          .update({ quantity: existing.quantity + quantity })
          .eq('id', existing.id);
        toast({ title: 'Cart updated', description: `Quantity increased to ${existing.quantity + quantity}` });
      } else {
        // Add new item
        await supabase
          .from('cart_items')
          .insert({
            cart_id: cart.id,
            variant_id: selectedVariant.id,
            quantity,
          });
        toast({ title: 'Added to cart!', description: `${product?.name} - ${selectedVariant.variant_name}` });
      }
    } catch {
      toast({ title: 'Failed to add to cart', variant: 'destructive' });
    }
    setAdding(false);
  }, [user, selectedVariant, quantity, product, supabase, router]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div className="skeleton h-80 rounded-2xl" />
        <div className="skeleton h-6 w-48 rounded-lg" />
        <div className="skeleton h-4 w-32 rounded-lg" />
        <div className="skeleton h-10 w-full rounded-xl" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center text-muted-foreground">
        <Package className="w-16 h-16 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Product not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Button>
      </div>
    );
  }

  const price = selectedVariant ? getEffectivePrice(selectedVariant) : 0;
  const discount = selectedVariant ? getDiscountPercentage(selectedVariant.mrp, price) : 0;
  const available = selectedVariant ? selectedVariant.stock - selectedVariant.reserved_stock : 0;
  const images = product.images?.length > 0 ? product.images : [];

  const adjustQuantity = (delta: number) => {
    if (!selectedVariant) return;
    const step = selectedVariant.quantity_step;
    const newQty = quantity + delta * step;
    const validation = validateQuantity(newQty, selectedVariant.moq, step);
    if (validation.valid) {
      setQuantity(newQty);
    } else if (validation.corrected && validation.corrected >= selectedVariant.moq) {
      setQuantity(validation.corrected);
    }
  };

  return (
    <div className="max-w-lg mx-auto page-transition">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Image Gallery */}
      <div className="relative bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="aspect-square flex items-center justify-center overflow-hidden">
          {images.length > 0 ? (
            <img
              src={images[currentImage]}
              alt={product.name}
              className="w-full h-full object-contain p-6"
            />
          ) : (
            <Package className="w-24 h-24 text-muted-foreground/20" />
          )}
        </div>
        {discount > 0 && (
          <Badge variant="destructive" className="absolute top-3 left-3 text-xs px-2 py-1">
            {discount}% OFF
          </Badge>
        )}
        {available <= 0 && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white font-medium bg-black/60 px-4 py-2 rounded-full">Out of Stock</span>
          </div>
        )}
        {/* Image dots */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentImage(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentImage ? 'bg-primary w-5' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="px-4 py-4 space-y-4">
        {/* Category & Name */}
        <div>
          <Link
            href={`/categories/${product.category?.slug || ''}`}
            className="text-[11px] text-primary font-medium uppercase tracking-wider flex items-center gap-0.5 mb-1"
          >
            {product.category?.name} <ChevronRight className="w-3 h-3" />
          </Link>
          <h1 className="text-xl font-bold leading-tight">{product.name}</h1>
        </div>

        {/* Variant Selection */}
        {product.variants.length > 1 && (
          <div>
            <p className="text-sm font-medium mb-2">Select Variant</p>
            <div className="flex gap-2 flex-wrap">
              {product.variants
                .filter((v) => v.is_active)
                .map((variant) => {
                  const vPrice = getEffectivePrice(variant);
                  const isSelected = selectedVariant?.id === variant.id;
                  return (
                    <button
                      key={variant.id}
                      onClick={() => {
                        setSelectedVariant(variant);
                        setQuantity(variant.moq);
                      }}
                      className={`px-3 py-2 rounded-xl border-2 text-sm transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-muted hover:border-primary/30'
                      }`}
                    >
                      <span className="block font-medium">{variant.variant_name}</span>
                      <span className="block text-xs mt-0.5">{formatPrice(vPrice)}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Price */}
        {selectedVariant && (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">{formatPrice(price)}</span>
            {discount > 0 && (
              <>
                <span className="text-base text-muted-foreground line-through">{formatPrice(selectedVariant.mrp)}</span>
                <Badge variant="destructive" className="text-xs">{discount}% OFF</Badge>
              </>
            )}
          </div>
        )}

        {/* MOQ & Unit info */}
        {selectedVariant && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>MOQ: {selectedVariant.moq} {selectedVariant.unit}</span>
            <span>Step: {selectedVariant.quantity_step} {selectedVariant.unit}</span>
            {available > 0 && <span className="text-emerald-600">In Stock ({available})</span>}
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div>
            <h3 className="text-sm font-semibold mb-1">Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50 text-center">
            <Truck className="w-5 h-5 text-emerald-600" />
            <span className="text-[10px] font-medium">Free Delivery</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50 text-center">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span className="text-[10px] font-medium">Genuine Products</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50 text-center">
            <RotateCcw className="w-5 h-5 text-emerald-600" />
            <span className="text-[10px] font-medium">Easy Returns</span>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      {selectedVariant && available > 0 && (
        <div className="sticky bottom-20 bg-background border-t px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3 max-w-lg mx-auto">
            {/* Quantity Selector */}
            <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
              <button
                className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-background transition-colors disabled:opacity-50"
                onClick={() => adjustQuantity(-1)}
                disabled={quantity <= selectedVariant.moq}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-semibold text-sm">{quantity}</span>
              <button
                className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-background transition-colors"
                onClick={() => adjustQuantity(1)}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Add to Cart Button */}
            <Button
              className="flex-1 h-11"
              onClick={addToCart}
              disabled={adding}
            >
              <ShoppingCart className="w-4 h-4" />
              {adding ? 'Adding...' : `Add to Cart — ${formatPrice(price * quantity)}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
