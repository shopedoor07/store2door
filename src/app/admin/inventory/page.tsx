'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatPrice, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toaster';
import {
  Warehouse, Search, AlertCircle, Package, Edit2,
  Save, X, Loader2, ChevronLeft, ChevronRight, Plus, Minus,
  ArrowUpDown, History
} from 'lucide-react';
import type { ProductVariant, InventoryTransaction } from '@/types/database';

interface VariantWithProduct extends ProductVariant {
  product: { name: string; slug: string };
}

const PAGE_SIZE = 20;

export default function AdminInventoryPage() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter') || '';
  const { user } = useAuth();

  const [variants, setVariants] = useState<VariantWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState(initialFilter);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Stock adjustment
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // History
  const [historyVariantId, setHistoryVariantId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const supabase = createClient();

  const loadVariants = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('product_variants')
      .select('*, product:products(name, slug)', { count: 'exact' })
      .eq('is_active', true)
      .order('stock', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (searchQuery.trim()) {
      query = query.ilike('variant_name', `%${searchQuery.trim()}%`);
    }

    const { data, count } = await query;
    let results = (data || []) as unknown as VariantWithProduct[];

    // Client-side filter for low stock
    if (filterMode === 'low') {
      results = results.filter(v => (v.stock - v.reserved_stock) <= v.low_stock_threshold);
    }

    setVariants(results);
    setTotalCount(count || 0);
    setHasMore((data?.length || 0) === PAGE_SIZE);
    setLoading(false);
  }, [supabase, searchQuery, filterMode, page]);

  useEffect(() => { loadVariants(); }, [loadVariants]);

  const handleAdjustStock = async (variant: VariantWithProduct) => {
    if (!adjustQty || parseInt(adjustQty) <= 0) {
      toast({ title: 'Enter a valid quantity', variant: 'destructive' });
      return;
    }
    if (!adjustReason.trim()) {
      toast({ title: 'Reason is required for audit trail', variant: 'destructive' });
      return;
    }
    setAdjusting(true);
    const qty = parseInt(adjustQty);
    const change = adjustType === 'add' ? qty : -qty;
    const newStock = variant.stock + change;

    if (newStock < 0) {
      toast({ title: 'Cannot reduce below 0', variant: 'destructive' });
      setAdjusting(false);
      return;
    }

    // Update stock
    const { error } = await supabase
      .from('product_variants')
      .update({ stock: newStock })
      .eq('id', variant.id);

    if (error) {
      toast({ title: 'Failed to update stock', variant: 'destructive' });
      setAdjusting(false);
      return;
    }

    // Create inventory transaction
    await supabase.from('inventory_transactions').insert({
      variant_id: variant.id,
      type: adjustType === 'add' ? 'RESTOCK' : 'MANUAL_ADJUSTMENT',
      quantity_before: variant.stock,
      quantity_change: change,
      quantity_after: newStock,
      reason: adjustReason.trim(),
      performed_by: user?.id,
    });

    toast({ title: `Stock ${adjustType === 'add' ? 'added' : 'removed'}!`, variant: 'success' });
    setAdjustingId(null);
    setAdjustQty('');
    setAdjustReason('');
    loadVariants();
    setAdjusting(false);
  };

  const loadHistory = async (variantId: string) => {
    setHistoryVariantId(variantId);
    setLoadingHistory(true);
    const { data } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('variant_id', variantId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setTransactions(data as InventoryTransaction[]);
    setLoadingHistory(false);
  };

  if (loading) {
    return <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-20 rounded-xl"/>)}</div>;
  }

  return (
    <div className="space-y-4 page-transition">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Warehouse className="w-5 h-5" /> Inventory</h1>
          <p className="text-sm text-muted-foreground">{totalCount} active variants</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 flex gap-3 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="search" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
              placeholder="Search variants..."
              className="w-full h-10 rounded-lg border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex gap-2">
            {['', 'low'].map(f => (
              <button key={f} onClick={() => { setFilterMode(f); setPage(0); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterMode === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {f === '' ? 'All' : 'Low Stock'}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Variants List */}
      <div className="space-y-2">
        {variants.map((v) => {
          const available = v.stock - v.reserved_stock;
          const isLow = available <= v.low_stock_threshold;
          return (
            <Card key={v.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{v.product?.name}</span>
                      <span className="text-xs text-muted-foreground">— {v.variant_name}</span>
                      {isLow && <Badge variant="destructive" className="text-[10px]"><AlertCircle className="w-2.5 h-2.5" /> Low Stock</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>SKU: {v.sku}</span>
                      <span>Stock: <strong className={isLow ? 'text-destructive' : 'text-foreground'}>{v.stock}</strong></span>
                      <span>Reserved: {v.reserved_stock}</span>
                      <span className={isLow ? 'text-destructive font-medium' : 'text-emerald-600'}>Available: {available}</span>
                      <span>Threshold: {v.low_stock_threshold}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => loadHistory(v.id)} className="p-2 rounded-lg hover:bg-muted transition-colors" title="View History">
                      <History className="w-4 h-4 text-blue-600" />
                    </button>
                    <button onClick={() => { setAdjustingId(v.id); setAdjustType('add'); }} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Adjust Stock">
                      <ArrowUpDown className="w-4 h-4 text-primary" />
                    </button>
                  </div>
                </div>

                {/* Stock Adjustment Form */}
                {adjustingId === v.id && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <div className="flex gap-2">
                      <button onClick={() => setAdjustType('add')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${adjustType === 'add' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                        <Plus className="w-3 h-3 inline" /> Add Stock
                      </button>
                      <button onClick={() => setAdjustType('remove')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${adjustType === 'remove' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>
                        <Minus className="w-3 h-3 inline" /> Remove Stock
                      </button>
                    </div>
                    <div className="flex gap-2 items-end">
                      <Input type="number" label="Quantity" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="0" className="w-28" />
                      <Input label="Reason *" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="e.g., New shipment received" className="flex-1" />
                      <Button size="sm" onClick={() => handleAdjustStock(v)} disabled={adjusting}>
                        {adjusting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Apply
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setAdjustingId(null)}><X className="w-3 h-3" /></Button>
                    </div>
                  </div>
                )}

                {/* Transaction History */}
                {historyVariantId === v.id && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold">Transaction History</h4>
                      <button onClick={() => setHistoryVariantId(null)} className="text-xs text-muted-foreground"><X className="w-3 h-3 inline" /> Close</button>
                    </div>
                    {loadingHistory ? (
                      <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
                    ) : transactions.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {transactions.map(t => (
                          <div key={t.id} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                            <Badge variant={t.quantity_change > 0 ? 'success' : 'destructive'} className="text-[10px] w-6 text-center">
                              {t.quantity_change > 0 ? '+' : ''}{t.quantity_change}
                            </Badge>
                            <span className="text-muted-foreground">{t.type.replace(/_/g, ' ')}</span>
                            <span className="flex-1 truncate text-muted-foreground">{t.reason}</span>
                            <span className="text-muted-foreground shrink-0">{formatDateTime(t.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground py-2">No transactions</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {variants.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Warehouse className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="font-medium">No variants found</p>
          </div>
        )}
      </div>

      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">Page {page + 1}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}><ChevronLeft className="w-4 h-4" /> Prev</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p+1)} disabled={!hasMore}>Next <ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
