'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatPrice, formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingBag, Package, ChevronRight, Clock } from 'lucide-react';
import type { Order } from '@/types/database';

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

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('profile_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setOrders(data as Order[]);
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 page-transition">
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
        <ShoppingBag className="w-5 h-5" /> My Orders
      </h1>

      {orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order) => {
            const status = statusConfig[order.order_status] || { label: order.order_status, variant: 'secondary' as const };
            return (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <Card className="hover:shadow-md transition-shadow border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-mono text-sm font-medium">{order.order_number}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(order.created_at)}
                        </div>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Amount</p>
                        <p className="text-lg font-bold text-primary">{formatPrice(order.total_amount)}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="capitalize">{order.payment_method}</span>
                        <ChevronRight className="w-4 h-4" />
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
          <Package className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No orders yet</p>
          <p className="text-sm mt-1">Browse products and place your first wholesale order!</p>
        </div>
      )}
    </div>
  );
}
