'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatPrice, getEffectivePrice, getDiscountPercentage } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ChevronRight, Package, Truck, Clock, Star, AlertCircle } from 'lucide-react';
import type { Category, Banner, ProductVariant, Product } from '@/types/database';

interface ProductWithVariant extends Product {
  variants: ProductVariant[];
  category: Category;
}

export default function HomePage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<ProductWithVariant[]>([]);
  const [storeOpen, setStoreOpen] = useState(true);
  const [closedMessage, setClosedMessage] = useState('');
  const [deliveryEta, setDeliveryEta] = useState('1 hour');
  const [loading, setLoading] = useState(true);
  const [currentBanner, setCurrentBanner] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      // Load business settings
      const { data: settings } = await supabase
        .from('business_settings')
        .select('key, value')
        .in('key', ['store_open', 'closed_message', 'default_delivery_eta']);

      if (settings) {
        settings.forEach((s) => {
          if (s.key === 'store_open') setStoreOpen(s.value === 'true');
          if (s.key === 'closed_message') setClosedMessage(s.value);
          if (s.key === 'default_delivery_eta') setDeliveryEta(s.value);
        });
      }

      // Load banners
      const { data: bannerData } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (bannerData) setBanners(bannerData);

      // Load categories
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .limit(8);
      if (catData) setCategories(catData);

      // Load featured products with variants
      const { data: productData } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          variants:product_variants(
            id, variant_name, unit, mrp, wholesale_price, offer_price,
            moq, stock, reserved_stock, is_active
          )
        `)
        .eq('is_active', true)
        .eq('is_featured', true)
        .limit(8);
      if (productData) setFeaturedProducts(productData as unknown as ProductWithVariant[]);

      setLoading(false);
    }
    loadData();
  }, [supabase]);

  // Auto-rotate banners
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto page-transition">
      {/* Store Closed Banner */}
      {!storeOpen && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-sm font-medium">{closedMessage || 'Store is currently closed'}</p>
          </div>
        </div>
      )}

      {/* Quick Info Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-emerald-50 border-b border-emerald-100">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1 text-emerald-700">
            <Truck className="w-3.5 h-3.5" />
            <span>Free Delivery</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-700">
            <Clock className="w-3.5 h-3.5" />
            <span>~{deliveryEta}</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-700">
            <Package className="w-3.5 h-3.5" />
            <span>Wholesale</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Banner Carousel */}
        {banners.length > 0 && (
          <div className="relative overflow-hidden rounded-2xl">
            <div
              className="flex transition-transform duration-500"
              style={{ transform: `translateX(-${currentBanner * 100}%)` }}
            >
              {banners.map((banner) => (
                <div key={banner.id} className="w-full shrink-0">
                  <div className="relative h-40 sm:h-48 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl overflow-hidden">
                    {banner.image_url ? (
                      <img
                        src={banner.image_url}
                        alt={banner.title || 'Banner'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-white">
                        <div className="text-center">
                          <h3 className="text-xl font-bold">{banner.title || 'Store2Door'}</h3>
                          {banner.subtitle && <p className="text-sm mt-1 opacity-90">{banner.subtitle}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Dots */}
            {banners.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentBanner(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === currentBanner ? 'bg-white w-5' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Default banner when no banners */}
        {banners.length === 0 && (
          <div className="relative h-40 sm:h-48 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl overflow-hidden flex items-center justify-center text-white">
            <div className="text-center px-6">
              <h3 className="text-2xl font-bold">Store2Door</h3>
              <p className="text-sm mt-2 opacity-90">Wholesale Stock, Direct to Your Store</p>
              <p className="text-xs mt-1 opacity-75">Browse catalog or upload your parcha</p>
            </div>
          </div>
        )}

        {/* Categories */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Categories</h2>
            <Link href="/categories" className="text-sm text-primary font-medium flex items-center gap-0.5">
              See All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {categories.length > 0 ? (
            <div className="grid grid-cols-4 gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted transition-colors"
                >
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center overflow-hidden">
                    {cat.image_url ? (
                      <img src={cat.image_url} alt={cat.name} className="w-10 h-10 object-contain" loading="lazy" />
                    ) : (
                      <Package className="w-6 h-6 text-emerald-600" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-center line-clamp-2 leading-tight">{cat.name}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Categories coming soon</p>
            </div>
          )}
        </section>

        {/* Featured Products */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-1.5">
              <Star className="w-5 h-5 text-amber-500" /> Featured
            </h2>
          </div>
          {featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {featuredProducts.map((product) => {
                const variant = product.variants?.[0];
                if (!variant) return null;
                const price = getEffectivePrice(variant);
                const discount = getDiscountPercentage(variant.mrp, price);
                const available = variant.stock - variant.reserved_stock;

                return (
                  <Link key={product.id} href={`/product/${product.slug}`}>
                    <Card className="overflow-hidden hover:shadow-md transition-shadow border-0 shadow-sm">
                      <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                        {product.images?.[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-contain p-2"
                            loading="lazy"
                          />
                        ) : (
                          <Package className="w-12 h-12 text-muted-foreground/30" />
                        )}
                        {discount > 0 && (
                          <Badge variant="destructive" className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5">
                            {discount}% OFF
                          </Badge>
                        )}
                        {available <= 0 && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white text-xs font-medium bg-black/60 px-3 py-1 rounded-full">
                              Out of Stock
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{product.category?.name}</p>
                        <h3 className="text-sm font-medium mt-0.5 line-clamp-2 leading-snug">{product.name}</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{variant.variant_name}</p>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                          <span className="text-base font-bold text-primary">{formatPrice(price)}</span>
                          {discount > 0 && (
                            <span className="text-xs text-muted-foreground line-through">{formatPrice(variant.mrp)}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">MOQ: {variant.moq} {variant.unit}</p>
                        {available > 0 && (
                          <Button size="sm" className="w-full mt-2 h-8 text-xs" disabled={!storeOpen}>
                            <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
                          </Button>
                        )}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Products coming soon</p>
              <p className="text-xs mt-1">Admin will add products from the admin panel</p>
            </div>
          )}
        </section>

        {/* Order by Parcha CTA */}
        <section>
          <Link href="/parcha">
            <Card className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">Order by Parcha</h3>
                  <p className="text-sm text-orange-100 mt-0.5">
                    Click a photo of your shopping list & we&apos;ll deliver!
                  </p>
                </div>
                <ChevronRight className="w-6 h-6 shrink-0" />
              </div>
            </Card>
          </Link>
        </section>
      </div>
    </div>
  );
}
