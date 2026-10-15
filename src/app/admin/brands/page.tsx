'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toaster';
import {
  Tag, Plus, Edit2, Trash2, Eye, EyeOff,
  Save, X, Loader2
} from 'lucide-react';
import type { Brand } from '@/types/database';

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const loadBrands = async () => {
    const { data } = await supabase.from('brands').select('*').order('sort_order');
    if (data) setBrands(data);
    setLoading(false);
  };

  useEffect(() => { loadBrands(); }, []);

  const resetForm = () => {
    setFormName(''); setFormSlug(''); setFormLogoUrl(''); setFormSortOrder('0');
    setEditingId(null); setShowNewForm(false);
  };

  const startEdit = (brand: Brand) => {
    setEditingId(brand.id);
    setFormName(brand.name);
    setFormSlug(brand.slug);
    setFormLogoUrl(brand.logo_url || '');
    setFormSortOrder(brand.sort_order.toString());
    setShowNewForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast({ title: 'Brand name required', variant: 'destructive' }); return; }
    setSaving(true);
    const data = {
      name: formName.trim(),
      slug: formSlug || slugify(formName),
      logo_url: formLogoUrl.trim() || null,
      sort_order: parseInt(formSortOrder) || 0,
      is_active: true,
    };
    if (editingId) {
      const { error } = await supabase.from('brands').update(data).eq('id', editingId);
      if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      else toast({ title: 'Brand updated!', variant: 'success' });
    } else {
      const { error } = await supabase.from('brands').insert(data);
      if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      else toast({ title: 'Brand created!', variant: 'success' });
    }
    resetForm(); loadBrands(); setSaving(false);
  };

  const toggleActive = async (brand: Brand) => {
    await supabase.from('brands').update({ is_active: !brand.is_active }).eq('id', brand.id);
    loadBrands();
  };

  const deleteBrand = async (brand: Brand) => {
    if (!confirm(`Delete "${brand.name}"?`)) return;
    const { error } = await supabase.from('brands').delete().eq('id', brand.id);
    if (error) toast({ title: 'Cannot delete — products use this brand', variant: 'destructive' });
    else loadBrands();
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl"/>)}</div>;

  return (
    <div className="space-y-4 page-transition max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Tag className="w-5 h-5" /> Brands</h1>
          <p className="text-sm text-muted-foreground">{brands.length} brands</p>
        </div>
        <Button onClick={() => { resetForm(); setShowNewForm(true); }}><Plus className="w-4 h-4" /> Add Brand</Button>
      </div>

      {showNewForm && (
        <Card className="border-2 border-primary/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{editingId ? 'Edit Brand' : 'New Brand'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Name *" value={formName} onChange={e => { setFormName(e.target.value); if(!editingId) setFormSlug(slugify(e.target.value)); }} placeholder="e.g., Tata" />
              <Input label="Slug" value={formSlug} onChange={e => setFormSlug(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Logo URL" value={formLogoUrl} onChange={e => setFormLogoUrl(e.target.value)} placeholder="Optional" />
              <Input label="Sort Order" type="number" value={formSortOrder} onChange={e => setFormSortOrder(e.target.value)} />
            </div>
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
        {brands.map((brand) => (
          <Card key={brand.id} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {brand.logo_url ? <img src={brand.logo_url} alt="" className="w-full h-full object-contain" /> : <Tag className="w-4 h-4 text-muted-foreground/30" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{brand.name}</span>
                  {!brand.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">/{brand.slug}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleActive(brand)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                  {brand.is_active ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => startEdit(brand)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                  <Edit2 className="w-4 h-4 text-blue-600" />
                </button>
                <button onClick={() => deleteBrand(brand)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
        {brands.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Tag className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="font-medium">No brands yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
