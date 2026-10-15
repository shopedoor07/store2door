'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toaster';
import {
  ArrowLeft, ClipboardList, User, Phone, Loader2,
  CheckCircle2, XCircle, ImageIcon
} from 'lucide-react';
import type { ParchaRequest, ParchaStatus, Profile, Retailer } from '@/types/database';

const STATUS_CONFIG: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'destructive' | 'secondary' }> = {
  NEW: { label: 'New', variant: 'warning' },
  REVIEWING: { label: 'Reviewing', variant: 'info' },
  CONVERTED_TO_ORDER: { label: 'Converted to Order', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
  COMPLETED: { label: 'Completed', variant: 'success' },
};

export default function AdminParchaDetailPage() {
  const params = useParams();
  const parchaId = params.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [parcha, setParcha] = useState<ParchaRequest | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [retailer, setRetailer] = useState<Retailer | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: parchaData } = await supabase
        .from('parcha_requests')
        .select('*')
        .eq('id', parchaId)
        .single();

      if (parchaData) {
        const p = parchaData as ParchaRequest;
        setParcha(p);
        setAdminNote(p.admin_notes || '');

        // Auto-mark as reviewing
        if (p.status === 'NEW') {
          await supabase.from('parcha_requests').update({ status: 'REVIEWING', reviewed_by: user?.id }).eq('id', p.id);
          setParcha({ ...p, status: 'REVIEWING' });
        }

        // Load customer
        if (p.profile_id) {
          const { data: prof } = await supabase.from('profiles').select('*').eq('id', p.profile_id).single();
          if (prof) setProfile(prof as Profile);
        }
        if (p.retailer_id) {
          const { data: ret } = await supabase.from('retailers').select('*').eq('id', p.retailer_id).single();
          if (ret) setRetailer(ret as Retailer);
        }
      }
      setLoading(false);
    }
    load();
  }, [parchaId, supabase, user]);

  const updateStatus = async (status: string) => {
    if (!parcha) return;
    setUpdating(true);
    const { error } = await supabase
      .from('parcha_requests')
      .update({
        status,
        admin_notes: adminNote,
        reviewed_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parcha.id);

    if (error) {
      toast({ title: 'Failed to update', variant: 'destructive' });
    } else {
      toast({ title: `Status updated to ${STATUS_CONFIG[status]?.label || status}`, variant: 'success' });
      setParcha({ ...parcha, status: status as ParchaStatus, admin_notes: adminNote });
    }
    setUpdating(false);
  };

  const saveNote = async () => {
    if (!parcha) return;
    await supabase.from('parcha_requests').update({ admin_notes: adminNote }).eq('id', parcha.id);
    toast({ title: 'Note saved' });
  };

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>;
  }

  if (!parcha) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ClipboardList className="w-16 h-16 mx-auto mb-3 opacity-20" />
        <p className="font-medium">Parcha request not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/parcha')}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>
    );
  }

  const conf = STATUS_CONFIG[parcha.status] || { label: parcha.status, variant: 'secondary' as const };
  const images = parcha.image_urls || [];

  return (
    <div className="space-y-4 page-transition max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin/parcha')} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">{parcha.slip_number}</h1>
          <p className="text-xs text-muted-foreground">{formatDateTime(parcha.created_at)}</p>
        </div>
        <Badge variant={conf.variant}>{conf.label}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Images */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Parcha Images ({images.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {images.length > 0 ? (
                <div className="space-y-3">
                  <div className="aspect-[4/3] bg-muted rounded-xl overflow-hidden">
                    <img src={images[selectedImage]} alt="" className="w-full h-full object-contain" />
                  </div>
                  {images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto">
                      {images.map((img: string, i: number) => (
                        <button key={i} onClick={() => setSelectedImage(i)}
                          className={`w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 ${i === selectedImage ? 'border-primary' : 'border-transparent'}`}>
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No images uploaded</p>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          {parcha.instructions && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">Customer Instructions</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{parcha.instructions}</p>
              </CardContent>
            </Card>
          )}

          {/* Status Actions */}
          {!['COMPLETED', 'REJECTED', 'CONVERTED_TO_ORDER'].includes(parcha.status) && (
            <Card className="border-2 border-primary/20 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">Take Action</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
                  placeholder="Admin notes..."
                  className="w-full h-20 rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => updateStatus('CONVERTED_TO_ORDER')} disabled={updating}>
                    {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Convert to Order
                  </Button>
                  <Button variant="outline" onClick={() => updateStatus('COMPLETED')} disabled={updating}>
                    <CheckCircle2 className="w-4 h-4" /> Mark Completed
                  </Button>
                  <Button variant="destructive" onClick={() => updateStatus('REJECTED')} disabled={updating}>
                    <XCircle className="w-4 h-4" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> Customer</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <p className="font-medium">{profile?.full_name || 'Unknown'}</p>
              {retailer && <p className="text-muted-foreground">{retailer.shop_name} ({retailer.shop_type})</p>}
              {profile?.phone && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" /> {profile.phone}
                </div>
              )}
            </CardContent>
          </Card>

          {parcha.preferred_delivery_time && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">Delivery Preference</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm">{parcha.preferred_delivery_time}</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-base">Admin Notes</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
                placeholder="Internal notes..."
                className="w-full h-20 rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              <Button variant="outline" size="sm" onClick={saveNote}>Save Note</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
