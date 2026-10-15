'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatPrice, getEffectivePrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Package, Plus, Search, Edit2, Trash2, Eye, EyeOff,
  ChevronLeft, ChevronRight, Star, AlertCircle
} from 'lucide-react';
import type { Product, ProductVariant, Category } from '@/types/database';

interface ProductRow extends Product {
  variants: ProductVariant[];
  category: Category;
}

const PAGE_SIZE = 20;

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const supabase = createClient();

  const loadProducts = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories(*),
        variants:product_variants(*)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (categoryFilter) {
      query = query.eq('category_id', categoryFilter);
    }

    if (searchQuery.trim()) {
      query = query.ilike('name', `%${searchQuery.trim()}%`);
    }

    const { data, count } = await query;
    if (data) setProducts(data as unknown as ProductRow[]);
    setTotalCount(count || 0);
    setHasMore((data?.length || 0) === PAGE_SIZE);
    setLoading(false);
  }, [supabase, categoryFilter, searchQuery, page]);

  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');
      if (data) setCategories(data);
    }
    loadCategories();
  }, [supabase]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const toggleActive = async (product: ProductRow) => {
    await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id);
    loadProducts();
  };

  const deleteProduct = async (product: ProductRow) => {
    if (!confirm(`Delete "${product.name}"? This will also delete all its variants.`)) return;

    // Delete variants first
    await supabase.from('product_variants').delete().eq('product_id', product.id);
    await supabase.from('products').delete().eq('id', product.id);
    loadProducts();
  };

  return (
    <div className="space-y-4 page-transition">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5" /> Products
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{totalCount} products</p>
        </div>
        <Link href="/admin/products/new">
          <Button>
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 flex gap-3 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              placeholder="Search products..."
              className="w-full h-10 rounded-lg border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
            className="h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[160px]"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Products List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : products.length > 0 ? (
        <div className="space-y-2">
          {products.map((product) => {
            const activeVariants = product.variants?.filter((v) => v.is_active) || [];
            const firstVariant = activeVariants[0] || product.variants?.[0];
            const lowStock = product.variants?.some(
              (v) => v.is_active && (v.stock - v.reserved_stock) <= v.low_stock_threshold
            );

            return (
              <Card key={product.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Image */}
                    <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <Package className="w-6 h-6 text-muted-foreground/30" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{product.name}</span>
                        {!product.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                        {product.is_featured && <Badge variant="info" className="text-[10px]"><Star className="w-2.5 h-2.5" /> Featured</Badge>}
                        {lowStock && <Badge variant="destructive" className="text-[10px]"><AlertCircle className="w-2.5 h-2.5" /> Low Stock</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {product.category?.name} • {activeVariants.length} variant{activeVariants.length !== 1 ? 's' : ''}
                      </p>
                      {firstVariant && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{formatPrice(getEffectivePrice(firstVariant))}</span>
                          <span>MRP: {formatPrice(firstVariant.mrp)}</span>
                          <span className="text-emerald-600">Cost: {formatPrice(firstVariant.purchase_price)}</span>
                          <span>Stock: {firstVariant.stock - firstVariant.reserved_stock}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleActive(product)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                        title={product.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {product.is_active ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      <Link href={`/admin/products/${product.id}`}>
                        <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                          <Edit2 className="w-4 h-4 text-blue-600" />
                        </button>
                      </Link>
                      <button
                        onClick={() => deleteProduct(product)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-16 h-16 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No products found</p>
          <p className="text-sm mt-1">
            {searchQuery || categoryFilter ? 'Try adjusting your filters' : 'Add your first product'}
          </p>
          <Link href="/admin/products/new">
            <Button className="mt-4"><Plus className="w-4 h-4" /> Add Product</Button>
          </Link>
        </div>
      )}

      {/* Pagination */}
      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
