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
  LayoutGrid, Plus, Edit2, Trash2, Eye, EyeOff,
  GripVertical, Save, X, Loader2, ChevronDown, ChevronUp, FolderPlus
} from 'lucide-react';
import type { Category, Subcategory } from '@/types/database';

interface CategoryWithSubs extends Category {
  subcategories: Subcategory[];
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithSubs[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New / Edit category form
  const [showNewForm, setShowNewForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);

  // New subcategory form
  const [showSubForm, setShowSubForm] = useState<string | null>(null);
  const [subName, setSubName] = useState('');
  const [subSlug, setSubSlug] = useState('');
  const [subSortOrder, setSubSortOrder] = useState('0');
  const [savingSub, setSavingSub] = useState(false);

  const supabase = createClient();

  const loadCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*, subcategories(*)')
      .order('sort_order');
    if (data) setCategories(data as CategoryWithSubs[]);
    setLoading(false);
  };

  useEffect(() => { loadCategories(); }, []);

  const resetForm = () => {
    setFormName('');
    setFormSlug('');
    setFormImageUrl('');
    setFormSortOrder('0');
    setEditingId(null);
    setShowNewForm(false);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormImageUrl(cat.image_url || '');
    setFormSortOrder(cat.sort_order.toString());
    setShowNewForm(true);
  };

  const handleSaveCategory = async () => {
    if (!formName.trim()) {
      toast({ title: 'Category name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const data = {
      name: formName.trim(),
      slug: formSlug || slugify(formName),
      image_url: formImageUrl.trim() || null,
      sort_order: parseInt(formSortOrder) || 0,
      is_active: true,
    };

    if (editingId) {
      const { error } = await supabase.from('categories').update(data).eq('id', editingId);
      if (error) toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
      else toast({ title: 'Category updated!', variant: 'success' });
    } else {
      const { error } = await supabase.from('categories').insert(data);
      if (error) toast({ title: 'Failed to create', description: error.message, variant: 'destructive' });
      else toast({ title: 'Category created!', variant: 'success' });
    }
    resetForm();
    loadCategories();
    setSaving(false);
  };

  const toggleActive = async (cat: Category) => {
    await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id);
    loadCategories();
  };

  const deleteCategory = async (cat: Category) => {
    if (!confirm(`Delete "${cat.name}"? This will fail if products use this category.`)) return;
    const { error } = await supabase.from('categories').delete().eq('id', cat.id);
    if (error) toast({ title: 'Cannot delete — products use this category', variant: 'destructive' });
    else loadCategories();
  };

  const handleSaveSubcategory = async (categoryId: string) => {
    if (!subName.trim()) return;
    setSavingSub(true);
    const { error } = await supabase.from('subcategories').insert({
      category_id: categoryId,
      name: subName.trim(),
      slug: subSlug || slugify(subName),
      sort_order: parseInt(subSortOrder) || 0,
      is_active: true,
    });
    if (error) toast({ title: 'Failed to create subcategory', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Subcategory added!', variant: 'success' });
      setSubName(''); setSubSlug(''); setSubSortOrder('0');
      setShowSubForm(null);
      loadCategories();
    }
    setSavingSub(false);
  };

  const deleteSubcategory = async (sub: Subcategory) => {
    if (!confirm(`Delete subcategory "${sub.name}"?`)) return;
    const { error } = await supabase.from('subcategories').delete().eq('id', sub.id);
    if (error) toast({ title: 'Cannot delete', variant: 'destructive' });
    else loadCategories();
  };

  const toggleSubActive = async (sub: Subcategory) => {
    await supabase.from('subcategories').update({ is_active: !sub.is_active }).eq('id', sub.id);
    loadCategories();
  };

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl"/>)}</div>;
  }

  return (
    <div className="space-y-4 page-transition max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><LayoutGrid className="w-5 h-5" /> Categories</h1>
          <p className="text-sm text-muted-foreground">{categories.length} categories</p>
        </div>
        <Button onClick={() => { resetForm(); setShowNewForm(true); }}>
          <Plus className="w-4 h-4" /> Add Category
        </Button>
      </div>

      {/* New / Edit Form */}
      {showNewForm && (
        <Card className="border-2 border-primary/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{editingId ? 'Edit Category' : 'New Category'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Name *" value={formName} onChange={e => { setFormName(e.target.value); if(!editingId) setFormSlug(slugify(e.target.value)); }} placeholder="e.g., Groceries" />
              <Input label="Slug" value={formSlug} onChange={e => setFormSlug(e.target.value)} placeholder="auto-generated" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Image URL" value={formImageUrl} onChange={e => setFormImageUrl(e.target.value)} placeholder="Optional image URL" />
              <Input label="Sort Order" type="number" value={formSortOrder} onChange={e => setFormSortOrder(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveCategory} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Update' : 'Create'}
              </Button>
              <Button variant="outline" onClick={resetForm}><X className="w-4 h-4" /> Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories List */}
      <div className="space-y-2">
        {categories.map((cat) => (
          <Card key={cat.id} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {cat.image_url ? (
                    <img src={cat.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <LayoutGrid className="w-5 h-5 text-muted-foreground/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{cat.name}</span>
                    {!cat.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                    <Badge variant="outline" className="text-[10px]">Order: {cat.sort_order}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">/{cat.slug} • {cat.subcategories?.length || 0} subcategories</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                    {expandedId === cat.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button onClick={() => toggleActive(cat)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                    {cat.is_active ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <button onClick={() => startEdit(cat)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                    <Edit2 className="w-4 h-4 text-blue-600" />
                  </button>
                  <button onClick={() => deleteCategory(cat)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>

              {/* Subcategories */}
              {expandedId === cat.id && (
                <div className="mt-3 pl-15 border-t pt-3 space-y-2">
                  {cat.subcategories?.length > 0 && cat.subcategories.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-3 pl-4 py-1.5 bg-muted/50 rounded-lg">
                      <span className="text-sm flex-1">{sub.name}</span>
                      <span className="text-[10px] text-muted-foreground">/{sub.slug}</span>
                      {!sub.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                      <button onClick={() => toggleSubActive(sub)} className="p-1 rounded hover:bg-muted">
                        {sub.is_active ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => deleteSubcategory(sub)} className="p-1 rounded hover:bg-muted">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  ))}
                  {showSubForm === cat.id ? (
                    <div className="flex gap-2 items-end pl-4">
                      <Input placeholder="Subcategory name" value={subName} onChange={e => { setSubName(e.target.value); setSubSlug(slugify(e.target.value)); }} className="flex-1" />
                      <Button size="sm" onClick={() => handleSaveSubcategory(cat.id)} disabled={savingSub}>
                        {savingSub ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowSubForm(null)}><X className="w-3 h-3" /></Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setShowSubForm(cat.id); setSubName(''); setSubSlug(''); }}
                      className="flex items-center gap-1.5 text-xs text-primary font-medium pl-4 py-1"
                    >
                      <FolderPlus className="w-3.5 h-3.5" /> Add Subcategory
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
