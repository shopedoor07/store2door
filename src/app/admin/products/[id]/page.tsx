'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';
import {
  ArrowLeft, Plus, Trash2, Save, Loader2, Package
} from 'lucide-react';
import type { Category, Subcategory, Brand, Product, ProductVariant } from '@/types/database';

interface VariantForm {
  id?: string;
  variant_name: string;
  sku: string;
  barcode: string;
  unit: string;
  pack_size: string;
  pieces_per_case: string;
  mrp: string;
  purchase_price: string;
  wholesale_price: string;
  offer_price: string;
  gst_percentage: string;
  hsn_code: string;
  moq: string;
  quantity_step: string;
  stock: string;
  low_stock_threshold: string;
  max_order_quantity: string;
  is_active: boolean;
}

const emptyVariant: VariantForm = {
  variant_name: '',
  sku: '',
  barcode: '',
  unit: 'pcs',
  pack_size: '',
  pieces_per_case: '',
  mrp: '',
  purchase_price: '',
  wholesale_price: '',
  offer_price: '',
  gst_percentage: '0',
  hsn_code: '',
  moq: '1',
  quantity_step: '1',
  stock: '0',
  low_stock_threshold: '5',
  max_order_quantity: '',
  is_active: true,
};

export default function AdminProductFormPage() {
  const params = useParams();
  const productId = params.id as string;
  const isNew = productId === 'new';
  const router = useRouter();
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Product form
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isBestseller, setIsBestseller] = useState(false);

  // Variants
  const [variants, setVariants] = useState<VariantForm[]>([{ ...emptyVariant }]);

  // Load categories, brands
  useEffect(() => {
    async function load() {
      const [catRes, brandRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('brands').select('*').order('sort_order'),
      ]);
      if (catRes.data) setCategories(catRes.data);
      if (brandRes.data) setBrands(brandRes.data);
    }
    load();
  }, [supabase]);

  // Load subcategories when category changes
  useEffect(() => {
    if (!categoryId) { setSubcategories([]); return; }
    async function loadSubs() {
      const { data } = await supabase
        .from('subcategories')
        .select('*')
        .eq('category_id', categoryId)
        .order('sort_order');
      if (data) setSubcategories(data);
    }
    loadSubs();
  }, [categoryId, supabase]);

  // Load existing product
  useEffect(() => {
    if (isNew) return;
    async function loadProduct() {
      const { data } = await supabase
        .from('products')
        .select('*, variants:product_variants(*)')
        .eq('id', productId)
        .single();

      if (data) {
        const prod = data as unknown as Product & { variants: ProductVariant[] };
        setName(prod.name);
        setSlug(prod.slug);
        setDescription(prod.description || '');
        setCategoryId(prod.category_id);
        setSubcategoryId(prod.subcategory_id || '');
        setBrandId(prod.brand_id || '');
        setImageUrls(prod.images || []);
        setIsActive(prod.is_active);
        setIsFeatured(prod.is_featured);
        setIsBestseller(prod.is_bestseller);

        if (prod.variants && prod.variants.length > 0) {
          setVariants(prod.variants.map((v) => ({
            id: v.id,
            variant_name: v.variant_name,
            sku: v.sku,
            barcode: v.barcode || '',
            unit: v.unit,
            pack_size: v.pack_size || '',
            pieces_per_case: v.pieces_per_case?.toString() || '',
            mrp: v.mrp.toString(),
            purchase_price: v.purchase_price.toString(),
            wholesale_price: v.wholesale_price.toString(),
            offer_price: v.offer_price?.toString() || '',
            gst_percentage: v.gst_percentage.toString(),
            hsn_code: v.hsn_code || '',
            moq: v.moq.toString(),
            quantity_step: v.quantity_step.toString(),
            stock: v.stock.toString(),
            low_stock_threshold: v.low_stock_threshold.toString(),
            max_order_quantity: v.max_order_quantity?.toString() || '',
            is_active: v.is_active,
          })));
        }
      }
      setLoading(false);
    }
    loadProduct();
  }, [productId, isNew, supabase]);

  // Auto-generate slug from name
  useEffect(() => {
    if (isNew && name) {
      setSlug(slugify(name));
    }
  }, [name, isNew]);

  const updateVariant = (index: number, field: keyof VariantForm, value: string | boolean) => {
    setVariants((prev) => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  const addVariant = () => {
    setVariants((prev) => [...prev, { ...emptyVariant }]);
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 1) {
      toast({ title: 'At least one variant is required', variant: 'destructive' });
      return;
    }
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const addImageUrl = () => {
    if (newImageUrl.trim()) {
      setImageUrls((prev) => [...prev, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Product name is required', variant: 'destructive' });
      return;
    }
    if (!categoryId) {
      toast({ title: 'Category is required', variant: 'destructive' });
      return;
    }
    if (variants.length === 0 || !variants[0].variant_name.trim()) {
      toast({ title: 'At least one variant with a name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const productData = {
        name: name.trim(),
        slug: slug || slugify(name),
        description: description.trim() || null,
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
        brand_id: brandId || null,
        images: imageUrls,
        is_active: isActive,
        is_featured: isFeatured,
        is_bestseller: isBestseller,
      };

      let savedProductId = productId;

      if (isNew) {
        const { data, error } = await supabase
          .from('products')
          .insert(productData)
          .select('id')
          .single();
        if (error) throw error;
        savedProductId = data.id;
      } else {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', productId);
        if (error) throw error;
      }

      // Save variants
      for (const variant of variants) {
        const variantData = {
          product_id: savedProductId,
          variant_name: variant.variant_name.trim(),
          sku: variant.sku.trim() || `${slug}-${variant.variant_name}`.toLowerCase().replace(/\s+/g, '-'),
          barcode: variant.barcode.trim() || null,
          unit: variant.unit,
          pack_size: variant.pack_size.trim() || null,
          pieces_per_case: variant.pieces_per_case ? parseInt(variant.pieces_per_case) : null,
          mrp: parseFloat(variant.mrp) || 0,
          purchase_price: parseFloat(variant.purchase_price) || 0,
          wholesale_price: parseFloat(variant.wholesale_price) || 0,
          offer_price: variant.offer_price ? parseFloat(variant.offer_price) : null,
          gst_percentage: parseFloat(variant.gst_percentage) || 0,
          hsn_code: variant.hsn_code.trim() || null,
          moq: parseInt(variant.moq) || 1,
          quantity_step: parseInt(variant.quantity_step) || 1,
          stock: parseInt(variant.stock) || 0,
          low_stock_threshold: parseInt(variant.low_stock_threshold) || 5,
          max_order_quantity: variant.max_order_quantity ? parseInt(variant.max_order_quantity) : null,
          is_active: variant.is_active,
        };

        if (variant.id) {
          await supabase
            .from('product_variants')
            .update(variantData)
            .eq('id', variant.id);
        } else {
          await supabase
            .from('product_variants')
            .insert(variantData);
        }
      }

      toast({ title: isNew ? 'Product created!' : 'Product updated!', variant: 'success' });
      router.push('/admin/products');
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Failed to save product', description: err?.message || 'Unknown error', variant: 'destructive' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4 page-transition max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin/products')} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">
          {isNew ? 'Add Product' : 'Edit Product'}
        </h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isNew ? 'Create Product' : 'Save Changes'}
        </Button>
      </div>

      {/* Basic Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Product Name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Tata Salt" />
            <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated" />
          </div>
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Product description..." rows={3} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Subcategory</label>
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                disabled={!categoryId}
              >
                <option value="">None</option>
                {subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Brand</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-6 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="rounded" />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isBestseller} onChange={(e) => setIsBestseller(e.target.checked)} className="rounded" />
              Bestseller
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Images</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {imageUrls.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg border overflow-hidden group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setImageUrls((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Paste image URL..."
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addImageUrl()}
              className="flex-1"
            />
            <Button variant="outline" onClick={addImageUrl}>Add</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Paste Supabase Storage URLs or any public image URL</p>
        </CardContent>
      </Card>

      {/* Variants */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-base">Variants ({variants.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={addVariant}>
            <Plus className="w-4 h-4" /> Add Variant
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {variants.map((variant, idx) => (
            <div key={idx} className="border rounded-xl p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-primary">Variant {idx + 1}</h4>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={variant.is_active} onChange={(e) => updateVariant(idx, 'is_active', e.target.checked)} className="rounded" />
                    Active
                  </label>
                  <button onClick={() => removeVariant(idx)} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input label="Variant Name *" placeholder="e.g., 1 kg" value={variant.variant_name} onChange={(e) => updateVariant(idx, 'variant_name', e.target.value)} />
                <Input label="SKU" placeholder="Auto-generated" value={variant.sku} onChange={(e) => updateVariant(idx, 'sku', e.target.value)} />
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Unit</label>
                  <select
                    value={variant.unit}
                    onChange={(e) => updateVariant(idx, 'unit', e.target.value)}
                    className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    {['pcs', 'g', 'kg', 'ml', 'L', 'box', 'pack', 'dozen', 'case'].map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <Input label="Barcode" placeholder="Optional" value={variant.barcode} onChange={(e) => updateVariant(idx, 'barcode', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input label="MRP (₹) *" type="number" placeholder="0" value={variant.mrp} onChange={(e) => updateVariant(idx, 'mrp', e.target.value)} />
                <Input label="Purchase Price (₹) *" type="number" placeholder="0" value={variant.purchase_price} onChange={(e) => updateVariant(idx, 'purchase_price', e.target.value)} />
                <Input label="Wholesale Price (₹) *" type="number" placeholder="0" value={variant.wholesale_price} onChange={(e) => updateVariant(idx, 'wholesale_price', e.target.value)} />
                <Input label="Offer Price (₹)" type="number" placeholder="Optional" value={variant.offer_price} onChange={(e) => updateVariant(idx, 'offer_price', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input label="GST %" type="number" placeholder="0" value={variant.gst_percentage} onChange={(e) => updateVariant(idx, 'gst_percentage', e.target.value)} />
                <Input label="MOQ" type="number" placeholder="1" value={variant.moq} onChange={(e) => updateVariant(idx, 'moq', e.target.value)} />
                <Input label="Qty Step" type="number" placeholder="1" value={variant.quantity_step} onChange={(e) => updateVariant(idx, 'quantity_step', e.target.value)} />
                <Input label="Stock" type="number" placeholder="0" value={variant.stock} onChange={(e) => updateVariant(idx, 'stock', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input label="Low Stock Threshold" type="number" placeholder="5" value={variant.low_stock_threshold} onChange={(e) => updateVariant(idx, 'low_stock_threshold', e.target.value)} />
                <Input label="Max Order Qty" type="number" placeholder="No limit" value={variant.max_order_quantity} onChange={(e) => updateVariant(idx, 'max_order_quantity', e.target.value)} />
                <Input label="Pack Size" placeholder="e.g., 12x100g" value={variant.pack_size} onChange={(e) => updateVariant(idx, 'pack_size', e.target.value)} />
                <Input label="HSN Code" placeholder="Optional" value={variant.hsn_code} onChange={(e) => updateVariant(idx, 'hsn_code', e.target.value)} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Save button (bottom) */}
      <div className="flex justify-end gap-3 pt-2 pb-4">
        <Button variant="outline" onClick={() => router.push('/admin/products')}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isNew ? 'Create Product' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
