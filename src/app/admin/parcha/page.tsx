'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ClipboardList, ChevronLeft, ChevronRight, RefreshCw, Eye
} from 'lucide-react';
import type { ParchaRequest } from '@/types/database';

const STATUS_CONFIG: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'destructive' | 'secondary' }> = {
  NEW: { label: 'New', variant: 'warning' },
  REVIEWING: { label: 'Reviewing', variant: 'info' },
  CONVERTED_TO_ORDER: { label: 'Converted', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
  COMPLETED: { label: 'Completed', variant: 'success' },
};

const PAGE_SIZE = 20;

export default function AdminParchaPage() {
  const [requests, setRequests] = useState<ParchaRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const supabase = createClient();

  const loadRequests = async () => {
    setLoading(true);
    let query = supabase
      .from('parcha_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (statusFilter) query = query.eq('status', statusFilter);

    const { data, count } = await query;
    if (data) setRequests(data as ParchaRequest[]);
    setTotalCount(count || 0);
    setHasMore((data?.length || 0) === PAGE_SIZE);
    setLoading(false);
  };

  useEffect(() => { loadRequests(); }, [statusFilter, page]);

  return (
    <div className="space-y-4 page-transition">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ClipboardList className="w-5 h-5" /> Parcha Requests</h1>
          <p className="text-sm text-muted-foreground">{totalCount} requests</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadRequests}><RefreshCw className="w-4 h-4" /> Refresh</Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {[{ value: '', label: 'All' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))].map(opt => (
          <button key={opt.value} onClick={() => { setStatusFilter(opt.value); setPage(0); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : requests.length > 0 ? (
        <div className="space-y-2">
          {requests.map(r => {
            const conf = STATUS_CONFIG[r.status] || { label: r.status, variant: 'secondary' as const };
            return (
              <Link key={r.id} href={`/admin/parcha/${r.id}`}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0">
                      {r.image_urls?.[0] ? (
                        <img src={r.image_urls[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><ClipboardList className="w-6 h-6 text-muted-foreground/30" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{r.slip_number}</span>
                        <Badge variant={conf.variant} className="text-[10px]">{conf.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(r.created_at)}</p>
                      {r.instructions && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.instructions}</p>}
                    </div>
                    <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-20" />
          <p className="font-medium">No parcha requests</p>
        </div>
      )}

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
