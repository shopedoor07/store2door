'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatPrice, getEffectivePrice, getDiscountPercentage } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Package, ArrowLeft, Filter } from 'lucide-react';
import type { Category, Product, ProductVariant, Subcategory } from '@/types/database';

interface ProductWithVariant extends Product {
  variants: ProductVariant[];
}

export default function CategoryDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [category, setCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [products, setProducts] = useState<ProductWithVariant[]>([]);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadCategory() {
      // Fetch category by slug
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (!catData) {
        setLoading(false);
        return;
      }
      setCategory(catData);

      // Fetch subcategories
      const { data: subData } = await supabase
        .from('subcategories')
        .select('*')
        .eq('category_id', catData.id)
        .eq('is_active', true)
        .order('sort_order');
      if (subData) setSubcategories(subData);

      // Fetch products in this category
      const { data: productData } = await supabase
        .from('products')
        .select(`
          *,
          variants:product_variants(
            id, variant_name, unit, mrp, wholesale_price, offer_price,
            moq, stock, reserved_stock, is_active
          )
        `)
        .eq('category_id', catData.id)
        .eq('is_active', true)
        .order('name');

      if (productData) setProducts(productData as unknown as ProductWithVariant[]);
      setLoading(false);
    }
    loadCategory();
  }, [slug, supabase]);

  // Filter by subcategory
  const filteredProducts = selectedSub
    ? products.filter((p) => p.subcategory_id === selectedSub)
    : products;

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-8 w-20 rounded-full" />)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-52 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center text-muted-foreground">
        <Package className="w-16 h-16 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Category not found</p>
        <Link href="/categories">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4" /> Back to Categories
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 page-transition">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/categories" className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center shrink-0">
            {category.image_url ? (
              <img src={category.image_url} alt={category.name} className="w-7 h-7 object-contain" />
            ) : (
              <Package className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold">{category.name}</h1>
            <p className="text-xs text-muted-foreground">{filteredProducts.length} products</p>
          </div>
        </div>
      </div>

      {/* Subcategory Filters */}
      {subcategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
          <button
            onClick={() => setSelectedSub(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !selectedSub
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            All
          </button>
          {subcategories.map((sub) => (
            <button
              key={sub.id}
              onClick={() => setSelectedSub(sub.id === selectedSub ? null : sub.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedSub === sub.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.map((product) => {
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
                    <h3 className="text-sm font-medium line-clamp-2 leading-snug">{product.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{variant.variant_name}</p>
                    <div className="flex items-baseline gap-1.5 mt-1.5">
                      <span className="text-base font-bold text-primary">{formatPrice(price)}</span>
                      {discount > 0 && (
                        <span className="text-xs text-muted-foreground line-through">{formatPrice(variant.mrp)}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">MOQ: {variant.moq} {variant.unit}</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No products found</p>
          <p className="text-sm mt-1">Products will be added to this category soon</p>
        </div>
      )}
    </div>
  );
}
