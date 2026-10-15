'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toaster';
import {
  MapPin, Plus, Edit2, Trash2, Eye, EyeOff,
  Save, X, Loader2
} from 'lucide-react';
import type { ServiceArea } from '@/types/database';

export default function AdminServiceAreasPage() {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formPincode, setFormPincode] = useState('');
  const [formLocality, setFormLocality] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formDeliveryCharge, setFormDeliveryCharge] = useState('0');
  const [formFreeThreshold, setFormFreeThreshold] = useState('0');
  const [formMinOrder, setFormMinOrder] = useState('0');
  const [formHandlingCharge, setFormHandlingCharge] = useState('0');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const loadAreas = async () => {
    const { data } = await supabase.from('service_areas').select('*').order('pincode');
    if (data) setAreas(data as ServiceArea[]);
    setLoading(false);
  };

  useEffect(() => { loadAreas(); }, []);

  const resetForm = () => {
    setFormPincode(''); setFormLocality(''); setFormCity(''); setFormState('');
    setFormDeliveryCharge('0'); setFormFreeThreshold('0'); setFormMinOrder('0'); setFormHandlingCharge('0');
    setEditingId(null); setShowForm(false);
  };

  const startEdit = (a: ServiceArea) => {
    setEditingId(a.id);
    setFormPincode(a.pincode); setFormLocality(a.locality); setFormCity(a.district || ''); setFormState(a.state || '');
    setFormDeliveryCharge(a.delivery_charge?.toString() || '0');
    setFormFreeThreshold(a.free_delivery_threshold?.toString() || '0');
    setFormMinOrder(a.minimum_order?.toString() || '0');
    setFormHandlingCharge(a.handling_charge?.toString() || '0');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formPincode.trim() || !formLocality.trim()) {
      toast({ title: 'Pincode and locality required', variant: 'destructive' }); return;
    }
    setSaving(true);
    const data = {
      pincode: formPincode.trim(),
      locality: formLocality.trim(),
      district: formCity.trim(),
      state: formState.trim(),
      delivery_charge: parseFloat(formDeliveryCharge) || 0,
      free_delivery_threshold: parseFloat(formFreeThreshold) || 0,
      minimum_order: parseFloat(formMinOrder) || 0,
      handling_charge: parseFloat(formHandlingCharge) || 0,
      is_serviceable: true,
    };
    if (editingId) {
      await supabase.from('service_areas').update(data).eq('id', editingId);
      toast({ title: 'Area updated!', variant: 'success' });
    } else {
      await supabase.from('service_areas').insert(data);
      toast({ title: 'Area created!', variant: 'success' });
    }
    resetForm(); loadAreas(); setSaving(false);
  };

  const toggleServiceable = async (a: ServiceArea) => {
    await supabase.from('service_areas').update({ is_serviceable: !a.is_serviceable }).eq('id', a.id);
    loadAreas();
  };

  const deleteArea = async (a: ServiceArea) => {
    if (!confirm(`Delete "${a.locality} - ${a.pincode}"?`)) return;
    await supabase.from('service_areas').delete().eq('id', a.id);
    loadAreas();
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4 page-transition max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><MapPin className="w-5 h-5" /> Service Areas</h1>
          <p className="text-sm text-muted-foreground">{areas.length} areas</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}><Plus className="w-4 h-4" /> Add Area</Button>
      </div>

      {showForm && (
        <Card className="border-2 border-primary/20 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">{editingId ? 'Edit Area' : 'New Area'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input label="Pincode *" value={formPincode} onChange={e => setFormPincode(e.target.value)} placeholder="e.g., 110001" />
              <Input label="Locality *" value={formLocality} onChange={e => setFormLocality(e.target.value)} placeholder="e.g., Connaught Place" />
              <Input label="City" value={formCity} onChange={e => setFormCity(e.target.value)} placeholder="e.g., New Delhi" />
              <Input label="State" value={formState} onChange={e => setFormState(e.target.value)} placeholder="e.g., Delhi" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input label="Delivery ₹" type="number" value={formDeliveryCharge} onChange={e => setFormDeliveryCharge(e.target.value)} />
              <Input label="Free Above ₹" type="number" value={formFreeThreshold} onChange={e => setFormFreeThreshold(e.target.value)} />
              <Input label="Min Order ₹" type="number" value={formMinOrder} onChange={e => setFormMinOrder(e.target.value)} />
              <Input label="Handling ₹" type="number" value={formHandlingCharge} onChange={e => setFormHandlingCharge(e.target.value)} />
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
        {areas.map(a => (
          <Card key={a.id} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{a.locality}</span>
                  <Badge variant="outline" className="text-[10px]">{a.pincode}</Badge>
                  {!a.is_serviceable && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{a.district}, {a.state}</span>
                  <span>Del: {formatPrice(a.delivery_charge || 0)}</span>
                  <span>Free: {formatPrice(a.free_delivery_threshold || 0)}+</span>
                  <span>Min: {formatPrice(a.minimum_order || 0)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleServiceable(a)} className="p-2 rounded-lg hover:bg-muted">
                  {a.is_serviceable ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => startEdit(a)} className="p-2 rounded-lg hover:bg-muted">
                  <Edit2 className="w-4 h-4 text-blue-600" />
                </button>
                <button onClick={() => deleteArea(a)} className="p-2 rounded-lg hover:bg-muted">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
        {areas.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="font-medium">No service areas defined</p>
            <p className="text-sm mt-1">Add pincodes and localities where you deliver</p>
          </div>
        )}
      </div>
    </div>
  );
}
