'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toaster';
import {
  ImageIcon, Plus, Edit2, Trash2, Eye, EyeOff,
  Save, X, Loader2
} from 'lucide-react';
import type { Banner } from '@/types/database';

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const loadBanners = async () => {
    const { data } = await supabase.from('banners').select('*').order('sort_order');
    if (data) setBanners(data as Banner[]);
    setLoading(false);
  };

  useEffect(() => { loadBanners(); }, []);

  const resetForm = () => {
    setTitle(''); setImageUrl(''); setTargetValue(''); setSortOrder('0');
    setEditingId(null); setShowForm(false);
  };

  const startEdit = (b: Banner) => {
    setEditingId(b.id); setTitle(b.title || ''); setImageUrl(b.image_url);
    setTargetValue(b.target_value || ''); setSortOrder(b.sort_order.toString());
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!imageUrl.trim()) { toast({ title: 'Image URL required', variant: 'destructive' }); return; }
    setSaving(true);
    const data = { title: title.trim() || null, image_url: imageUrl.trim(), target_value: targetValue.trim() || null, target_type: targetValue.trim() ? 'url' : null, sort_order: parseInt(sortOrder) || 0, is_active: true };
    if (editingId) {
      await supabase.from('banners').update(data).eq('id', editingId);
      toast({ title: 'Banner updated!', variant: 'success' });
    } else {
      await supabase.from('banners').insert(data);
      toast({ title: 'Banner created!', variant: 'success' });
    }
    resetForm(); loadBanners(); setSaving(false);
  };

  const toggleActive = async (b: Banner) => {
    await supabase.from('banners').update({ is_active: !b.is_active }).eq('id', b.id);
    loadBanners();
  };

  const deleteBanner = async (b: Banner) => {
    if (!confirm('Delete this banner?')) return;
    await supabase.from('banners').delete().eq('id', b.id);
    loadBanners();
  };

  if (loading) return <div className="space-y-3">{[1,2].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4 page-transition max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ImageIcon className="w-5 h-5" /> Banners</h1>
          <p className="text-sm text-muted-foreground">{banners.length} banners</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}><Plus className="w-4 h-4" /> Add Banner</Button>
      </div>

      {showForm && (
        <Card className="border-2 border-primary/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{editingId ? 'Edit Banner' : 'New Banner'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Optional title" />
            <Input label="Image URL *" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Banner image URL" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Link URL" value={targetValue} onChange={e => setTargetValue(e.target.value)} placeholder="Optional link" />
              <Input label="Sort Order" type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
            </div>
            {imageUrl && <img src={imageUrl} alt="" className="h-32 rounded-lg object-cover" />}
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Update' : 'Create'}
              </Button>
              <Button variant="outline" onClick={resetForm}><X className="w-4 h-4" /> Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {banners.map(b => (
          <Card key={b.id} className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="flex">
                <div className="w-32 h-24 bg-muted shrink-0 overflow-hidden">
                  <img src={b.image_url} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{b.title || 'Untitled Banner'}</span>
                      {!b.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                    </div>
                    {b.target_value && <p className="text-xs text-muted-foreground truncate">{b.target_value}</p>}
                    <p className="text-[10px] text-muted-foreground">Order: {b.sort_order}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleActive(b)} className="p-2 rounded-lg hover:bg-muted">
                      {b.is_active ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => startEdit(b)} className="p-2 rounded-lg hover:bg-muted">
                      <Edit2 className="w-4 h-4 text-blue-600" />
                    </button>
                    <button onClick={() => deleteBanner(b)} className="p-2 rounded-lg hover:bg-muted">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {banners.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="font-medium">No banners yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
