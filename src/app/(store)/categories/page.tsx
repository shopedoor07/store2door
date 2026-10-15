'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Package, ChevronRight } from 'lucide-react';
import type { Category } from '@/types/database';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (data) setCategories(data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 page-transition">
      <h1 className="text-xl font-bold mb-4">All Categories</h1>

      {categories.length > 0 ? (
        <div className="space-y-2">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-accent transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center shrink-0">
                {cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} className="w-8 h-8 object-contain" loading="lazy" />
                ) : (
                  <Package className="w-5 h-5 text-emerald-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">{cat.name}</h3>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No categories yet</p>
          <p className="text-sm mt-1">Admin will add categories from the admin panel</p>
        </div>
      )}
    </div>
  );
}
