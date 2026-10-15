'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart3, TrendingUp, Download, Calendar,
  Package, ShoppingBag, IndianRupee, Users,
  ArrowUpRight, ArrowDownRight, Filter, RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';

type DateRange = '7d' | '30d' | '90d' | 'all';
type ReportTab = 'overview' | 'products' | 'retailers';

interface DailySale {
  date: string;
  orders: number;
  revenue: number;
}

interface ProductPerf {
  name: string;
  quantity_sold: number;
  revenue: number;
}

interface RetailerPerf {
  name: string;
  shop_name: string;
  total_orders: number;
  total_spent: number;
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function ReportsPage() {
  const { profile } = useAuth();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [loading, setLoading] = useState(true);

  // Overview stats
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalRetailers: 0,
    avgOrderValue: 0,
    prevRevenue: 0,
    prevOrders: 0,
  });

  // Chart data
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [productPerf, setProductPerf] = useState<ProductPerf[]>([]);
  const [retailerPerf, setRetailerPerf] = useState<RetailerPerf[]>([]);

  const getDateFilter = useCallback(() => {
    const now = new Date();
    switch (dateRange) {
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      case 'all': return new Date('2020-01-01').toISOString();
    }
  }, [dateRange]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const fromDate = getDateFilter();

    try {
      // Fetch orders in date range
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at')
        .gte('created_at', fromDate)
        .not('status', 'eq', 'CANCELLED');

      // Previous period for comparison
      const prevFrom = new Date(new Date(fromDate).getTime() - (new Date().getTime() - new Date(fromDate).getTime())).toISOString();
      const { data: prevOrders } = await supabase
        .from('orders')
        .select('id, total_amount')
        .gte('created_at', prevFrom)
        .lt('created_at', fromDate)
        .not('status', 'eq', 'CANCELLED');

      const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      const totalOrders = orders?.length || 0;
      const prevRevenue = prevOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      const prevOrdersCount = prevOrders?.length || 0;

      // Total products
      const { count: productCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      // Total retailers
      const { count: retailerCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'RETAILER');

      setStats({
        totalRevenue,
        totalOrders,
        totalProducts: productCount || 0,
        totalRetailers: retailerCount || 0,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        prevRevenue,
        prevOrders: prevOrdersCount,
      });

      // Daily sales chart data
      const salesByDay: Record<string, { orders: number; revenue: number }> = {};
      orders?.forEach((order) => {
        const day = order.created_at.split('T')[0];
        if (!salesByDay[day]) salesByDay[day] = { orders: 0, revenue: 0 };
        salesByDay[day].orders++;
        salesByDay[day].revenue += order.total_amount || 0;
      });

      const sortedDays = Object.entries(salesByDay)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
      setDailySales(sortedDays);

      // Product performance
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          quantity, total_price,
          products:product_id ( name )
        `)
        .gte('created_at', fromDate);

      const productMap: Record<string, { quantity_sold: number; revenue: number }> = {};
      orderItems?.forEach((item: any) => {
        const name = item.products?.name || 'Unknown';
        if (!productMap[name]) productMap[name] = { quantity_sold: 0, revenue: 0 };
        productMap[name].quantity_sold += item.quantity || 0;
        productMap[name].revenue += item.total_price || 0;
      });

      const sortedProducts = Object.entries(productMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
      setProductPerf(sortedProducts);

      // Retailer performance
      const { data: retailerOrders } = await supabase
        .from('orders')
        .select(`
          total_amount,
          profiles:retailer_id ( full_name, shop_name )
        `)
        .gte('created_at', fromDate)
        .not('status', 'eq', 'CANCELLED');

      const retailerMap: Record<string, { name: string; shop_name: string; total_orders: number; total_spent: number }> = {};
      retailerOrders?.forEach((order: any) => {
        const id = order.profiles?.full_name || 'Unknown';
        if (!retailerMap[id]) retailerMap[id] = {
          name: order.profiles?.full_name || 'Unknown',
          shop_name: order.profiles?.shop_name || '',
          total_orders: 0,
          total_spent: 0,
        };
        retailerMap[id].total_orders++;
        retailerMap[id].total_spent += order.total_amount || 0;
      });

      const sortedRetailers = Object.values(retailerMap)
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 10);
      setRetailerPerf(sortedRetailers);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, getDateFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const getChangePercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100);
  };

  const revenueChange = getChangePercent(stats.totalRevenue, stats.prevRevenue);
  const orderChange = getChangePercent(stats.totalOrders, stats.prevOrders);

  // CSV Export
  const exportCSV = (type: 'sales' | 'products' | 'retailers') => {
    let csv = '';
    let filename = '';

    if (type === 'sales') {
      csv = 'Date,Orders,Revenue\n';
      dailySales.forEach(d => {
        csv += `${d.date},${d.orders},${d.revenue}\n`;
      });
      filename = `sales_report_${dateRange}.csv`;
    } else if (type === 'products') {
      csv = 'Product,Quantity Sold,Revenue\n';
      productPerf.forEach(p => {
        csv += `"${p.name}",${p.quantity_sold},${p.revenue}\n`;
      });
      filename = `product_report_${dateRange}.csv`;
    } else {
      csv = 'Retailer,Shop Name,Total Orders,Total Spent\n';
      retailerPerf.forEach(r => {
        csv += `"${r.name}","${r.shop_name}",${r.total_orders},${r.total_spent}\n`;
      });
      filename = `retailer_report_${dateRange}.csv`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your business performance</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button
            onClick={fetchReports}
            disabled={loading}
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm hover:bg-muted transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          {
            label: 'Total Revenue',
            value: formatCurrency(stats.totalRevenue),
            change: revenueChange,
            icon: IndianRupee,
            color: 'emerald',
          },
          {
            label: 'Total Orders',
            value: stats.totalOrders.toString(),
            change: orderChange,
            icon: ShoppingBag,
            color: 'blue',
          },
          {
            label: 'Avg. Order Value',
            value: formatCurrency(stats.avgOrderValue),
            icon: TrendingUp,
            color: 'amber',
          },
          {
            label: 'Active Retailers',
            value: stats.totalRetailers.toString(),
            icon: Users,
            color: 'violet',
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                stat.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-600' :
                stat.color === 'blue' ? 'bg-blue-500/10 text-blue-600' :
                stat.color === 'amber' ? 'bg-amber-500/10 text-amber-600' :
                'bg-violet-500/10 text-violet-600'
              }`}>
                <stat.icon className="w-4.5 h-4.5" />
              </div>
              {stat.change !== undefined && (
                <span className={`text-xs font-medium inline-flex items-center gap-0.5 ${
                  stat.change >= 0 ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {stat.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(stat.change).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        {(['overview', 'products', 'retailers'] as ReportTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'overview' ? 'Sales Overview' : tab === 'products' ? 'Products' : 'Retailers'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Revenue Chart */}
              <div className="bg-card border border-border rounded-xl p-4 lg:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Daily Revenue</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Revenue trend over time</p>
                  </div>
                  <button
                    onClick={() => exportCSV('sales')}
                    className="h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>
                {dailySales.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailySales}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(val) => new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(val) => [formatCurrency(Number(val)), 'Revenue']}
                        labelFormatter={(label) => new Date(String(label)).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                    No sales data for this period
                  </div>
                )}
              </div>

              {/* Orders Chart */}
              <div className="bg-card border border-border rounded-xl p-4 lg:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Daily Orders</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Order volume over time</p>
                  </div>
                </div>
                {dailySales.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dailySales}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(val) => new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(val) => [Number(val), 'Orders']}
                        labelFormatter={(label) => new Date(String(label)).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      />
                      <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                    No order data for this period
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Products Tab */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-4 lg:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Top Products by Revenue</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Best performing products</p>
                  </div>
                  <button
                    onClick={() => exportCSV('products')}
                    className="h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>
                {productPerf.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={productPerf} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(val) => val.length > 18 ? val.substring(0, 18) + '…' : val}
                      />
                      <Tooltip formatter={(val) => [formatCurrency(Number(val)), 'Revenue']} />
                      <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                    No product data for this period
                  </div>
                )}
              </div>

              {/* Product table */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 lg:px-6 py-4 border-b border-border">
                  <h3 className="font-semibold">Product Performance Table</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 lg:px-6 py-3 font-medium text-muted-foreground">#</th>
                        <th className="text-left px-4 lg:px-6 py-3 font-medium text-muted-foreground">Product</th>
                        <th className="text-right px-4 lg:px-6 py-3 font-medium text-muted-foreground">Qty Sold</th>
                        <th className="text-right px-4 lg:px-6 py-3 font-medium text-muted-foreground">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productPerf.map((p, i) => (
                        <tr key={p.name} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 lg:px-6 py-3 text-muted-foreground">{i + 1}</td>
                          <td className="px-4 lg:px-6 py-3 font-medium">{p.name}</td>
                          <td className="px-4 lg:px-6 py-3 text-right">{p.quantity_sold}</td>
                          <td className="px-4 lg:px-6 py-3 text-right font-medium text-emerald-600">{formatCurrency(p.revenue)}</td>
                        </tr>
                      ))}
                      {productPerf.length === 0 && (
                        <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No data available</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Retailers Tab */}
          {activeTab === 'retailers' && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-4 lg:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Top Retailers by Spending</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Most valuable retailers</p>
                  </div>
                  <button
                    onClick={() => exportCSV('retailers')}
                    className="h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>
                {retailerPerf.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={retailerPerf}
                        dataKey="total_spent"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${(name ?? '').toString().split(' ')[0]} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                      >
                        {retailerPerf.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => [formatCurrency(Number(val)), 'Total Spent']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                    No retailer data for this period
                  </div>
                )}
              </div>

              {/* Retailer table */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 lg:px-6 py-4 border-b border-border">
                  <h3 className="font-semibold">Retailer Performance Table</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 lg:px-6 py-3 font-medium text-muted-foreground">#</th>
                        <th className="text-left px-4 lg:px-6 py-3 font-medium text-muted-foreground">Retailer</th>
                        <th className="text-left px-4 lg:px-6 py-3 font-medium text-muted-foreground">Shop</th>
                        <th className="text-right px-4 lg:px-6 py-3 font-medium text-muted-foreground">Orders</th>
                        <th className="text-right px-4 lg:px-6 py-3 font-medium text-muted-foreground">Total Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retailerPerf.map((r, i) => (
                        <tr key={r.name} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 lg:px-6 py-3 text-muted-foreground">{i + 1}</td>
                          <td className="px-4 lg:px-6 py-3 font-medium">{r.name}</td>
                          <td className="px-4 lg:px-6 py-3 text-muted-foreground">{r.shop_name}</td>
                          <td className="px-4 lg:px-6 py-3 text-right">{r.total_orders}</td>
                          <td className="px-4 lg:px-6 py-3 text-right font-medium text-emerald-600">{formatCurrency(r.total_spent)}</td>
                        </tr>
                      ))}
                      {retailerPerf.length === 0 && (
                        <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No data available</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
