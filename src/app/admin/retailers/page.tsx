'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatPrice, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toaster';
import {
  Users, Search, ChevronLeft, ChevronRight, Phone,
  Store, ShoppingBag, Ban, CheckCircle2, Eye
} from 'lucide-react';
import type { Profile, Retailer } from '@/types/database';

interface RetailerWithProfile extends Retailer {
  profile: Profile;
}

const PAGE_SIZE = 20;

export default function AdminRetailersPage() {
  const [retailers, setRetailers] = useState<RetailerWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const supabase = createClient();

  const loadRetailers = async () => {
    setLoading(true);
    let query = supabase
      .from('retailers')
      .select('*, profile:profiles(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (searchQuery.trim()) {
      query = query.ilike('shop_name', `%${searchQuery.trim()}%`);
    }

    const { data, count } = await query;
    if (data) setRetailers(data as unknown as RetailerWithProfile[]);
    setTotalCount(count || 0);
    setHasMore((data?.length || 0) === PAGE_SIZE);
    setLoading(false);
  };

  useEffect(() => { loadRetailers(); }, [searchQuery, page]);

  const toggleBlock = async (retailer: Retailer) => {
    const newBlocked = !retailer.is_blocked;
    if (newBlocked && !confirm(`Block "${retailer.shop_name}"? They won't be able to place orders.`)) return;

    await supabase.from('retailers').update({ is_blocked: newBlocked }).eq('id', retailer.id);
    toast({ title: newBlocked ? 'Retailer blocked' : 'Retailer unblocked', variant: newBlocked ? 'destructive' : 'success' });
    loadRetailers();
  };

  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4 page-transition">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5" /> Retailers</h1>
          <p className="text-sm text-muted-foreground">{totalCount} retailers</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="search" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
              placeholder="Search by shop name..."
              className="w-full h-10 rounded-lg border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {retailers.map(r => (
          <Card key={r.id} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{r.shop_name}</span>
                  <Badge variant="outline" className="text-[10px]">{r.shop_type}</Badge>
                  {r.is_blocked && <Badge variant="destructive" className="text-[10px]">Blocked</Badge>}

                </div>
                <p className="text-xs text-muted-foreground">{r.profile?.full_name || 'Unknown'} • {r.profile?.phone || 'No phone'}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> {r.total_orders} orders</span>
                  <span>Lifetime: {formatPrice(r.lifetime_purchase)}</span>
                  {r.last_order_at && <span>Last: {formatDateTime(r.last_order_at)}</span>}
                </div>
                {r.gstin && <p className="text-[10px] text-muted-foreground">GST: {r.gstin}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleBlock(r)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  title={r.is_blocked ? 'Unblock' : 'Block'}>
                  {r.is_blocked ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Ban className="w-4 h-4 text-destructive" />}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
        {retailers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="font-medium">No retailers found</p>
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
