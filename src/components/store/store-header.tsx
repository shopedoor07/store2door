'use client';

import Link from 'next/link';
import { ShoppingCart, Bell, Search, MapPin, Store } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function StoreHeader() {
  const { user, retailer } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  // Load cart count
  const loadCartCount = useCallback(async () => {
    if (!user) { setCartCount(0); return; }
    const { count } = await supabase
      .from('cart_items')
      .select('*', { count: 'exact', head: true })
      .eq('retailer_id', user.id);
    setCartCount(count ?? 0);
  }, [user, supabase]);

  useEffect(() => {
    loadCartCount();

    // Subscribe to cart changes
    if (!user) return;
    const channel = supabase
      .channel('cart-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cart_items', filter: `retailer_id=eq.${user.id}` },
        () => loadCartCount()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase, loadCartCount]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-emerald-600 to-teal-600 text-white pt-safe">
      <div className="max-w-lg mx-auto px-4 py-3">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Store2Door</h1>
              {retailer && (
                <div className="flex items-center gap-1 text-emerald-100 text-[10px]">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate max-w-[150px]">{retailer.shop_name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
            <Link href="/notifications" className="p-2 rounded-xl hover:bg-white/10 transition-colors relative">
              <Bell className="w-5 h-5" />
            </Link>
            <Link href="/cart" className="p-2 rounded-xl hover:bg-white/10 transition-colors relative">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-orange-500 rounded-full text-[9px] font-bold flex items-center justify-center">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <form onSubmit={handleSearch} className="mt-2 animate-in slide-in-from-top-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, brands..."
                className="w-full h-10 rounded-xl bg-white/15 backdrop-blur border-0 pl-10 pr-4 text-sm placeholder:text-emerald-200 focus:outline-none focus:ring-2 focus:ring-white/30"
                autoFocus
              />
            </div>
          </form>
        )}
      </div>
    </header>
  );
}
