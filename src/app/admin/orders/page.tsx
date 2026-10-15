'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatPrice, formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ShoppingBag, Search, Filter, ChevronRight, Clock,
  Package, ChevronLeft, RefreshCw
} from 'lucide-react';
import type { Order } from '@/types/database';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PICKING', label: 'Picking' },
  { value: 'PACKED', label: 'Packed' },
  { value: 'READY_FOR_DISPATCH', label: 'Ready for Dispatch' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' }> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  CONFIRMED: { label: 'Confirmed', variant: 'info' },
  PICKING: { label: 'Picking', variant: 'info' },
  PACKED: { label: 'Packed', variant: 'info' },
  READY_FOR_DISPATCH: { label: 'Ready', variant: 'info' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', variant: 'warning' },
  DELIVERED: { label: 'Delivered', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

const PAYMENT_LABELS: Record<string, string> = {
  COD_PENDING: 'COD Pending',
  COD_COLLECTED: 'COD Collected',
  PENDING: 'Pending',
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

const PAGE_SIZE = 20;

export default function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStatus = searchParams.get('status') || '';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const supabase = createClient();

  const loadOrders = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (statusFilter) {
      query = query.eq('order_status', statusFilter);
    }

    if (searchQuery.trim()) {
      query = query.ilike('order_number', `%${searchQuery.trim()}%`);
    }

    const { data, count } = await query;
    if (data) setOrders(data as Order[]);
    setTotalCount(count || 0);
    setHasMore((data?.length || 0) === PAGE_SIZE);
    setLoading(false);
  }, [supabase, statusFilter, searchQuery, page]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setPage(0);
  };

  return (
    <div className="space-y-4 page-transition">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" /> Order Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{totalCount} total orders</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadOrders}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-3 flex-col sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                placeholder="Search by order number..."
                className="w-full h-10 rounded-lg border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[160px]"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {/* Status quick filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Orders Table/List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : orders.length > 0 ? (
        <div className="space-y-2">
          {orders.map((order) => {
            const status = statusConfig[order.order_status] || { label: order.order_status, variant: 'secondary' as const };
            const addr = order.address_snapshot as Record<string, string>;
            return (
              <Link key={order.id} href={`/admin/orders/${order.id}`}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold">{order.order_number}</span>
                          <Badge variant={status.variant} className="text-[10px]">{status.label}</Badge>
                          <Badge variant="outline" className="text-[10px]">{order.payment_method}</Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(order.created_at)}
                        </div>
                        {addr?.full_name && (
                          <p className="text-xs text-muted-foreground truncate">
                            {addr.full_name} • {addr.locality} - {addr.pincode}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-primary">{formatPrice(order.total_amount)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {PAYMENT_LABELS[order.payment_status] || order.payment_status}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-16 h-16 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No orders found</p>
          <p className="text-sm mt-1">
            {statusFilter || searchQuery ? 'Try adjusting your filters' : 'Orders will appear here'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
