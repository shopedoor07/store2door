'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatPrice, formatDate, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Package, MapPin, Banknote, Clock,
  CheckCircle2, Truck, PackageCheck, CircleDot,
  XCircle, Phone
} from 'lucide-react';
import type { Order, OrderItem, OrderStatusHistory } from '@/types/database';

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

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  AUTHORIZED: 'Authorized',
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  COD_PENDING: 'COD - Pending',
  COD_COLLECTED: 'COD - Collected',
};

const TIMELINE_STEPS = ['PENDING', 'CONFIRMED', 'PICKING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [statusHistory, setStatusHistory] = useState<OrderStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function loadOrder() {
      if (!user) return;

      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('profile_id', user.id)
        .single();

      if (orderData) {
        setOrder(orderData as Order);

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
      }

      setLoading(false);
    }
    loadOrder();
  }, [orderId, user, supabase]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center text-muted-foreground">
        <Package className="w-16 h-16 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Order not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/orders')}>
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Button>
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[order.order_status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusConf.icon;
  const address = order.address_snapshot as Record<string, string>;
  const currentStepIdx = TIMELINE_STEPS.indexOf(order.order_status);
  const isCancelled = order.order_status === 'CANCELLED';

  return (
    <div className="max-w-lg mx-auto px-4 py-4 page-transition">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push('/orders')} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">Order Details</h1>
          <p className="text-xs text-muted-foreground">{order.order_number}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Status Card */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className={`px-4 py-3 ${statusConf.color}`}>
            <div className="flex items-center gap-2">
              <StatusIcon className="w-5 h-5" />
              <span className="font-semibold">{statusConf.label}</span>
            </div>
            <p className="text-xs mt-1 opacity-80">
              {isCancelled
                ? `Cancelled on ${formatDateTime(order.updated_at)}`
                : order.order_status === 'DELIVERED'
                ? `Delivered on ${formatDateTime(order.updated_at)}`
                : `Placed on ${formatDateTime(order.created_at)}`
              }
            </p>
          </div>
        </Card>

        {/* Timeline */}
        {!isCancelled && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Order Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6">
                {TIMELINE_STEPS.map((step, idx) => {
                  const isCompleted = idx <= currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  const conf = STATUS_CONFIG[step];
                  const historyEntry = statusHistory.find((h) => h.to_status === step);

                  return (
                    <div key={step} className="relative pb-4 last:pb-0">
                      {/* Vertical line */}
                      {idx < TIMELINE_STEPS.length - 1 && (
                        <div className={`absolute left-[-16px] top-5 w-0.5 h-full ${
                          isCompleted && idx < currentStepIdx ? 'bg-primary' : 'bg-muted'
                        }`} />
                      )}
                      {/* Dot */}
                      <div className={`absolute left-[-20px] top-1 w-3 h-3 rounded-full border-2 ${
                        isCurrent
                          ? 'border-primary bg-primary animate-pulse'
                          : isCompleted
                          ? 'border-primary bg-primary'
                          : 'border-muted bg-background'
                      }`} />
                      {/* Content */}
                      <div>
                        <p className={`text-sm font-medium ${isCompleted ? '' : 'text-muted-foreground'}`}>
                          {conf.label}
                        </p>
                        {historyEntry && (
                          <p className="text-[11px] text-muted-foreground">{formatDateTime(historyEntry.created_at)}</p>
                        )}
                      </div>
                    </div>
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
          <CardContent className="space-y-2">
            {orderItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-muted-foreground/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.product_name_snapshot}</p>
                  <p className="text-xs text-muted-foreground">{item.variant_name_snapshot} • SKU: {item.sku_snapshot}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(item.unit_price)} × {item.quantity}
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatPrice(item.line_total)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Price Breakdown */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Price Details</CardTitle>
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
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="w-4 h-4 text-primary" /> Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span className="font-medium">{order.payment_method === 'COD' ? 'Cash on Delivery' : order.payment_method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className="text-xs">{PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Address */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Delivery Address
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium">{address?.full_name}</p>
            <p className="text-muted-foreground mt-0.5">
              {address?.full_address}, {address?.locality} - {address?.pincode}
            </p>
            {address?.landmark && <p className="text-muted-foreground">Landmark: {address.landmark}</p>}
            <div className="flex items-center gap-1 text-muted-foreground mt-1">
              <Phone className="w-3 h-3" /> {address?.phone}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {order.retailer_notes && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Your Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{order.retailer_notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Order Info */}
        <div className="text-[11px] text-muted-foreground text-center pb-4 space-y-0.5">
          <p>Order ID: {order.id}</p>
          <p>Placed on {formatDateTime(order.created_at)}</p>
          <p>Source: {order.source}</p>
        </div>
      </div>
    </div>
  );
}
