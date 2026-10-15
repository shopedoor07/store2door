'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatPrice, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import {
  ArrowLeft, Package, MapPin, Banknote, Clock,
  CheckCircle2, Truck, PackageCheck, XCircle, Phone,
  User, ChevronRight, Loader2, AlertTriangle
} from 'lucide-react';
import type { Order, OrderItem, OrderStatusHistory, Profile, Retailer } from '@/types/database';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Package }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  CONFIRMED: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  PICKING: { label: 'Picking', color: 'bg-purple-100 text-purple-700', icon: Package },
  PACKED: { label: 'Packed', color: 'bg-indigo-100 text-indigo-700', icon: PackageCheck },
  READY_FOR_DISPATCH: { label: 'Ready for Dispatch', color: 'bg-cyan-100 text-cyan-700', icon: PackageCheck },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: 'bg-emerald-100 text-emerald-700', icon: Truck },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const STATUS_FLOW: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PICKING', 'CANCELLED'],
  PICKING: ['PACKED', 'CANCELLED'],
  PACKED: ['READY_FOR_DISPATCH', 'CANCELLED'],
  READY_FOR_DISPATCH: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [statusHistory, setStatusHistory] = useState<OrderStatusHistory[]>([]);
  const [retailerProfile, setRetailerProfile] = useState<Profile | null>(null);
  const [retailer, setRetailer] = useState<Retailer | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const supabase = createClient();

  const loadOrder = useCallback(async () => {
    // Load order
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (!orderData) {
      setLoading(false);
      return;
    }

    const ord = orderData as Order;
    setOrder(ord);
    setAdminNote(ord.admin_notes || '');

    // Load order items
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);
    if (items) setOrderItems(items as OrderItem[]);

    // Load status history
    const { data: history } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (history) setStatusHistory(history as OrderStatusHistory[]);

    // Load retailer info
    if (ord.profile_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', ord.profile_id)
        .single();
      if (profileData) setRetailerProfile(profileData as Profile);
    }

    if (ord.retailer_id) {
      const { data: retailerData } = await supabase
        .from('retailers')
        .select('*')
        .eq('id', ord.retailer_id)
        .single();
      if (retailerData) setRetailer(retailerData as Retailer);
    }

    setLoading(false);
  }, [orderId, supabase]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const updateOrderStatus = async (newStatus: string) => {
    if (!order || !user) return;

    setUpdating(true);
    try {
      // Update order status
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          order_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (updateError) {
        toast({ title: 'Failed to update status', description: updateError.message, variant: 'destructive' });
        setUpdating(false);
        return;
      }

      // Add status history
      await supabase.from('order_status_history').insert({
        order_id: order.id,
        from_status: order.order_status,
        to_status: newStatus,
        changed_by: user.id,
        notes: statusNote || `Status changed to ${STATUS_CONFIG[newStatus]?.label || newStatus}`,
      });

      // Handle delivered → update payment status for COD
      if (newStatus === 'DELIVERED' && order.payment_method === 'COD') {
        await supabase
          .from('orders')
          .update({ payment_status: 'COD_COLLECTED' })
          .eq('id', order.id);

        await supabase
          .from('payments')
          .update({ status: 'COD_COLLECTED' })
          .eq('order_id', order.id);
      }

      // Handle cancelled → release reserved stock
      if (newStatus === 'CANCELLED') {
        for (const item of orderItems) {
          const { data: variant } = await supabase
            .from('product_variants')
            .select('stock, reserved_stock')
            .eq('id', item.variant_id)
            .single();

          if (variant) {
            await supabase
              .from('product_variants')
              .update({ reserved_stock: Math.max(0, variant.reserved_stock - item.quantity) })
              .eq('id', item.variant_id);

            await supabase.from('inventory_transactions').insert({
              variant_id: item.variant_id,
              type: 'CANCELLATION_RELEASE',
              quantity_before: variant.stock,
              quantity_change: item.quantity,
              quantity_after: variant.stock,
              reason: `Order ${order.order_number} cancelled`,
              reference_id: order.id,
              reference_type: 'order',
              performed_by: user.id,
            });
          }
        }

        // Reverse retailer stats
        if (order.retailer_id) {
          const { data: ret } = await supabase
            .from('retailers')
            .select('total_orders, lifetime_purchase')
            .eq('id', order.retailer_id)
            .single();
          if (ret) {
            await supabase
              .from('retailers')
              .update({
                total_orders: Math.max(0, ret.total_orders - 1),
                lifetime_purchase: Math.max(0, ret.lifetime_purchase - order.total_amount),
              })
              .eq('id', order.retailer_id);
          }
        }
      }

      // Handle delivered → deduct actual stock (move from reserved to sold)
      if (newStatus === 'DELIVERED') {
        for (const item of orderItems) {
          const { data: variant } = await supabase
            .from('product_variants')
            .select('stock, reserved_stock')
            .eq('id', item.variant_id)
            .single();

          if (variant) {
            await supabase
              .from('product_variants')
              .update({
                stock: variant.stock - item.quantity,
                reserved_stock: Math.max(0, variant.reserved_stock - item.quantity),
              })
              .eq('id', item.variant_id);

            await supabase.from('inventory_transactions').insert({
              variant_id: item.variant_id,
              type: 'SALE',
              quantity_before: variant.stock,
              quantity_change: -item.quantity,
              quantity_after: variant.stock - item.quantity,
              reason: `Order ${order.order_number} delivered`,
              reference_id: order.id,
              reference_type: 'order',
              performed_by: user.id,
            });
          }
        }
      }

      toast({ title: `Order ${STATUS_CONFIG[newStatus]?.label || newStatus}`, variant: 'success' });
      setStatusNote('');
      await loadOrder();
    } catch (err) {
      console.error(err);
      toast({ title: 'Something went wrong', variant: 'destructive' });
    }
    setUpdating(false);
  };

  const saveAdminNote = async () => {
    if (!order) return;
    setSavingNote(true);
    const { error } = await supabase
      .from('orders')
      .update({ admin_notes: adminNote })
      .eq('id', order.id);

    if (error) {
      toast({ title: 'Failed to save note', variant: 'destructive' });
    } else {
      toast({ title: 'Admin note saved' });
    }
    setSavingNote(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Package className="w-16 h-16 mx-auto mb-3 opacity-20" />
        <p className="font-medium">Order not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/orders')}>
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Button>
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[order.order_status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusConf.icon;
  const address = order.address_snapshot as Record<string, string>;
  const nextStatuses = STATUS_FLOW[order.order_status] || [];
  const profit = orderItems.reduce((sum, item) => {
    return sum + (item.unit_price - item.purchase_cost_snapshot) * item.quantity;
  }, 0);

  return (
    <div className="space-y-4 page-transition max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin/orders')} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">{order.order_number}</h1>
          <p className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p>
        </div>
        <Badge variant={order.order_status === 'DELIVERED' ? 'success' : order.order_status === 'CANCELLED' ? 'destructive' : order.order_status === 'PENDING' || order.order_status === 'OUT_FOR_DELIVERY' ? 'warning' : 'info'} className="text-xs">
          {statusConf.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Status Update */}
          {nextStatuses.length > 0 && (
            <Card className="border-2 border-primary/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <StatusIcon className="w-4 h-4 text-primary" /> Update Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Status update note (optional)..."
                  className="w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex gap-2 flex-wrap">
                  {nextStatuses.map((status) => {
                    const conf = STATUS_CONFIG[status];
                    const isCancelBtn = status === 'CANCELLED';
                    return (
                      <Button
                        key={status}
                        variant={isCancelBtn ? 'destructive' : 'default'}
                        size="sm"
                        onClick={() => updateOrderStatus(status)}
                        disabled={updating}
                      >
                        {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {isCancelBtn ? 'Cancel Order' : `Mark as ${conf?.label || status}`}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Items */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" /> Items ({orderItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {orderItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-muted-foreground/30" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.product_name_snapshot}</p>
                      <p className="text-xs text-muted-foreground">{item.variant_name_snapshot} • SKU: {item.sku_snapshot}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{formatPrice(item.unit_price)} × {item.quantity}</span>
                        <span className="text-emerald-600">
                          Cost: {formatPrice(item.purchase_cost_snapshot)}
                        </span>
                        <span className="text-primary font-medium">
                          Margin: {formatPrice((item.unit_price - item.purchase_cost_snapshot) * item.quantity)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold shrink-0">{formatPrice(item.line_total)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Price Breakdown */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Price Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items Subtotal</span>
                <span>{formatPrice(order.items_subtotal)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatPrice(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Charge</span>
                <span>{order.delivery_charge === 0 ? <span className="text-emerald-600 text-xs font-medium">FREE</span> : formatPrice(order.delivery_charge)}</span>
              </div>
              {order.handling_charge > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Handling Charge</span>
                  <span>{formatPrice(order.handling_charge)}</span>
                </div>
              )}
              {order.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (GST)</span>
                  <span>{formatPrice(order.tax_amount)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total Amount</span>
                <span className="text-primary text-base">{formatPrice(order.total_amount)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-sm">
                <span className="text-emerald-600 font-medium">Gross Profit</span>
                <span className="text-emerald-600 font-bold">{formatPrice(profit)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Status History */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Status History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6 space-y-3">
                {statusHistory.map((entry, idx) => {
                  const conf = STATUS_CONFIG[entry.to_status] || STATUS_CONFIG.PENDING;
                  return (
                    <div key={entry.id} className="relative pb-2">
                      {idx < statusHistory.length - 1 && (
                        <div className="absolute left-[-16px] top-5 w-0.5 h-full bg-muted" />
                      )}
                      <div className="absolute left-[-20px] top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-primary" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{conf.label}</span>
                          {entry.from_status && (
                            <span className="text-[10px] text-muted-foreground">
                              from {STATUS_CONFIG[entry.from_status]?.label || entry.from_status}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(entry.created_at)}</p>
                        {entry.notes && <p className="text-xs text-muted-foreground mt-0.5">{entry.notes}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Customer Info */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{retailerProfile?.full_name || 'Unknown'}</p>
              {retailer && (
                <p className="text-muted-foreground">{retailer.shop_name} ({retailer.shop_type})</p>
              )}
              {retailerProfile?.phone && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" /> {retailerProfile.phone}
                </div>
              )}
              {retailerProfile?.email && (
                <p className="text-xs text-muted-foreground">{retailerProfile.email}</p>
              )}
              {retailer && (
                <div className="border-t pt-2 mt-2 text-xs text-muted-foreground space-y-0.5">
                  <p>Total Orders: {retailer.total_orders}</p>
                  <p>Lifetime: {formatPrice(retailer.lifetime_purchase)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Address */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium">{address?.full_name}</p>
              <p className="text-muted-foreground">{address?.full_address}</p>
              <p className="text-muted-foreground">{address?.locality} - {address?.pincode}</p>
              {address?.landmark && <p className="text-muted-foreground">Landmark: {address.landmark}</p>}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="w-3.5 h-3.5" /> {address?.phone}
              </div>
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="w-4 h-4 text-primary" /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium">{order.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className="text-xs">{order.payment_status.replace(/_/g, ' ')}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span className="text-xs">{order.source}</span>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {order.retailer_notes && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Customer Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{order.retailer_notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Admin Notes */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Admin Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Internal notes about this order..."
                className="w-full h-20 rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={saveAdminNote}
                disabled={savingNote}
              >
                {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Save Note
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
