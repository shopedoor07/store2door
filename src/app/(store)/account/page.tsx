'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import {
  User, Store, MapPin, Phone, Mail, ShoppingBag,
  LogOut, ChevronRight, Settings, FileText, HelpCircle
} from 'lucide-react';
import Link from 'next/link';

export default function AccountPage() {
  const { profile, retailer, signOut, loading } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 page-transition space-y-4">
      {/* Profile Card */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 pt-5 pb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="text-white">
              <h2 className="text-lg font-bold">{profile?.full_name || 'User'}</h2>
              {retailer && (
                <div className="flex items-center gap-1 text-emerald-100 text-sm mt-0.5">
                  <Store className="w-3.5 h-3.5" />
                  {retailer.shop_name}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="-mt-4 mx-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-bold text-primary">{retailer?.total_orders || 0}</p>
                <p className="text-[10px] text-muted-foreground">Orders</p>
              </div>
              <div>
                <p className="text-xl font-bold text-primary">₹{retailer?.lifetime_purchase || 0}</p>
                <p className="text-[10px] text-muted-foreground">Purchases</p>
              </div>
              <div>
                <p className="text-xl font-bold text-primary">{retailer?.shop_type || '-'}</p>
                <p className="text-[10px] text-muted-foreground">Shop Type</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Card>

      {/* Contact Info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Contact Details</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{profile?.phone || 'Not set'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span>{profile?.email || 'Not set'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>Manage Addresses</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu Items */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {[
            { href: '/orders', icon: ShoppingBag, label: 'My Orders' },
            { href: '/parcha', icon: FileText, label: 'My Parcha Requests' },
            { href: '/account/addresses', icon: MapPin, label: 'Delivery Addresses' },
            { href: '/account/settings', icon: Settings, label: 'Settings' },
            { href: '/about', icon: HelpCircle, label: 'About & Support' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted transition-colors border-b last:border-0"
            >
              <item.icon className="w-5 h-5 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Button variant="outline" className="w-full text-destructive hover:bg-destructive hover:text-white" onClick={handleSignOut}>
        <LogOut className="w-4 h-4" /> Sign Out
      </Button>
    </div>
  );
}
