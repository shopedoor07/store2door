'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatPrice, getEffectivePrice, getDiscountPercentage, debounce } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Package, ArrowLeft, X } from 'lucide-react';
import type { Product, ProductVariant, Category } from '@/types/database';

interface ProductWithVariant extends Product {
  variants: ProductVariant[];
  category: Category;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<ProductWithVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const supabase = createClient();

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setSearched(false);
        return;
      }

      setLoading(true);
      setSearched(true);

      const { data } = await supabase
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
        .ilike('name', `%${searchQuery.trim()}%`)
        .limit(20);

      if (data) setResults(data as unknown as ProductWithVariant[]);
      setLoading(false);
    },
    [supabase]
  );

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((q: string) => performSearch(q), 400),
    [performSearch]
  );

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery, performSearch]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    debouncedSearch(value);
  };

  return (
    <div className="max-w-lg mx-auto page-transition">
      {/* Search Header */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search products, brands..."
              className="w-full h-10 rounded-xl bg-muted border-0 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setSearched(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-background"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-52 rounded-xl" />)}
          </div>
        )}

        {/* Results */}
        {!loading && searched && results.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
            </p>
            <div className="grid grid-cols-2 gap-3">
              {results.map((product) => {
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
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* No results */}
        {!loading && searched && results.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-16 h-16 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No products found</p>
            <p className="text-sm mt-1">Try a different search term</p>
          </div>
        )}

        {/* Initial state */}
        {!loading && !searched && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-16 h-16 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Search for products</p>
            <p className="text-sm mt-1">Type a product name or brand to search</p>
          </div>
        )}
      </div>
    </div>
  );
}
