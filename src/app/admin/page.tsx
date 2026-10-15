'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatPrice, formatDate, formatDateTime, getISTDayBounds } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShoppingBag, Package, Users, IndianRupee, TrendingUp,
  Clock, AlertCircle, ChevronRight, ArrowUpRight, ArrowDownRight,
  BarChart3, ClipboardList, PackageCheck
} from 'lucide-react';
import type { Order, ParchaRequest } from '@/types/database';

interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  outForDelivery: number;
  totalProducts: number;
  totalRetailers: number;
  lowStockCount: number;
  newParchaCount: number;
}

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

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    todayOrders: 0,
    todayRevenue: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    outForDelivery: 0,
    totalProducts: 0,
    totalRetailers: 0,
    lowStockCount: 0,
    newParchaCount: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [recentParcha, setRecentParcha] = useState<ParchaRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();
      const { start, end } = getISTDayBounds();

      // Today's orders
      const { data: todayOrdersData } = await supabase
        .from('orders')
        .select('total_amount, order_status')
        .gte('created_at', start)
        .lte('created_at', end)
        .neq('order_status', 'CANCELLED');

      const todayOrders = todayOrdersData?.length || 0;
      const todayRevenue = todayOrdersData?.reduce((sum, o) => sum + o.total_amount, 0) || 0;

      // Total orders & revenue (all time, excluding cancelled)
      const { data: allOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .neq('order_status', 'CANCELLED');

      const totalOrders = allOrders?.length || 0;
      const totalRevenue = allOrders?.reduce((sum, o) => sum + o.total_amount, 0) || 0;

      // Pending orders
      const { count: pendingCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('order_status', ['PENDING', 'CONFIRMED', 'PICKING', 'PACKED', 'READY_FOR_DISPATCH']);

      // Out for delivery
      const { count: ofdCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'OUT_FOR_DELIVERY');

      // Total products
      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Total retailers
      const { count: retailerCount } = await supabase
        .from('retailers')
        .select('*', { count: 'exact', head: true });

      // Low stock variants
      const { data: lowStockData } = await supabase
        .from('product_variants')
        .select('id')
        .eq('is_active', true)
        .filter('stock', 'lte', 'low_stock_threshold');

      // We need to do this differently since we can't compare columns directly
      const { data: allVariants } = await supabase
        .from('product_variants')
        .select('id, stock, reserved_stock, low_stock_threshold')
        .eq('is_active', true);

      const lowStockCount = allVariants?.filter(
        (v) => (v.stock - v.reserved_stock) <= v.low_stock_threshold
      ).length || 0;

      // New parcha requests
      const { count: parchaCount } = await supabase
        .from('parcha_requests')
        .select('*', { count: 'exact', head: true })
        .in('status', ['NEW', 'REVIEWING']);

      // Recent orders (last 5)
      const { data: recentOrdersData } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // Recent parcha (last 3)
      const { data: recentParchaData } = await supabase
        .from('parcha_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

      setStats({
        todayOrders,
        todayRevenue,
        totalOrders,
        totalRevenue,
        pendingOrders: pendingCount || 0,
        outForDelivery: ofdCount || 0,
        totalProducts: productCount || 0,
        totalRetailers: retailerCount || 0,
        lowStockCount,
        newParchaCount: parchaCount || 0,
      });

      if (recentOrdersData) setRecentOrders(recentOrdersData as Order[]);
      if (recentParchaData) setRecentParcha(recentParchaData as ParchaRequest[]);

      setLoading(false);
    }
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 page-transition">
      {/* Alert Cards */}
      {(stats.pendingOrders > 0 || stats.newParchaCount > 0 || stats.lowStockCount > 0) && (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {stats.pendingOrders > 0 && (
            <Link href="/admin/orders?status=PENDING" className="shrink-0">
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 border shadow-none hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-700">{stats.pendingOrders}</p>
                    <p className="text-xs text-amber-600">Pending Orders</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          {stats.newParchaCount > 0 && (
            <Link href="/admin/parcha" className="shrink-0">
              <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 border shadow-none hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-700">{stats.newParchaCount}</p>
                    <p className="text-xs text-orange-600">New Parcha</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          {stats.lowStockCount > 0 && (
            <Link href="/admin/inventory?filter=low" className="shrink-0">
              <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 border shadow-none hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-700">{stats.lowStockCount}</p>
                    <p className="text-xs text-red-600">Low Stock Items</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-emerald-600" />
              </div>
              <Badge variant="success" className="text-[10px]">Today</Badge>
            </div>
            <p className="text-2xl font-bold">{formatPrice(stats.todayRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Today&apos;s Revenue</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
              </div>
              <Badge variant="info" className="text-[10px]">Today</Badge>
            </div>
            <p className="text-2xl font-bold">{stats.todayOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">Today&apos;s Orders</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold">{formatPrice(stats.totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Revenue</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-teal-600" />
              </div>
            </div>
            <p className="text-2xl font-bold">{stats.totalOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats.totalProducts}</p>
              <p className="text-[11px] text-muted-foreground">Active Products</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats.totalRetailers}</p>
              <p className="text-[11px] text-muted-foreground">Retailers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
              <PackageCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats.outForDelivery}</p>
              <p className="text-[11px] text-muted-foreground">Out for Delivery</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats.pendingOrders}</p>
              <p className="text-[11px] text-muted-foreground">Pending Action</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders & Parcha */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Orders</CardTitle>
            <Link href="/admin/orders" className="text-xs text-primary font-medium flex items-center gap-0.5">
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length > 0 ? (
              <div className="space-y-2">
                {recentOrders.map((order) => {
                  const status = statusConfig[order.order_status] || { label: order.order_status, variant: 'secondary' as const };
                  return (
                    <Link
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-medium">{order.order_number}</span>
                          <Badge variant={status.variant} className="text-[10px]">{status.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(order.created_at)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{formatPrice(order.total_amount)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{order.payment_method}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No orders yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Parcha */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base">Parcha Requests</CardTitle>
            <Link href="/admin/parcha" className="text-xs text-primary font-medium flex items-center gap-0.5">
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentParcha.length > 0 ? (
              <div className="space-y-2">
                {recentParcha.map((parcha) => (
                  <Link
                    key={parcha.id}
                    href={`/admin/parcha/${parcha.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                      <ClipboardList className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-mono font-medium">{parcha.slip_number}</span>
                      <p className="text-xs text-muted-foreground">{formatDateTime(parcha.created_at)}</p>
                    </div>
                    <Badge
                      variant={parcha.status === 'NEW' ? 'warning' : parcha.status === 'CONVERTED_TO_ORDER' ? 'success' : 'info'}
                      className="text-[10px] shrink-0"
                    >
                      {parcha.status.replace(/_/g, ' ')}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No parcha requests</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
