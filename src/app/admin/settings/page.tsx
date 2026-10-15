'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';
import { Settings, Save, Loader2, Store, Truck, IndianRupee, Clock, Bell } from 'lucide-react';
import type { BusinessSettingsMap } from '@/types/database';

const SETTINGS_GROUPS = [
  {
    title: 'Store Settings',
    icon: Store,
    settings: [
      { key: 'store_name', label: 'Store Name', type: 'text', placeholder: 'Store2Door' },
      { key: 'store_open', label: 'Store Open', type: 'toggle' },
      { key: 'accept_orders_when_closed', label: 'Accept Orders When Closed', type: 'toggle' },
      { key: 'store_tagline', label: 'Tagline', type: 'text', placeholder: 'Your tagline' },
      { key: 'support_phone', label: 'Support Phone', type: 'text', placeholder: '+91 XXXXX XXXXX' },
      { key: 'support_email', label: 'Support Email', type: 'text', placeholder: 'support@store2door.com' },
      { key: 'whatsapp_number', label: 'WhatsApp Number', type: 'text', placeholder: '+91 XXXXX XXXXX' },
    ],
  },
  {
    title: 'Order & Delivery',
    icon: Truck,
    settings: [
      { key: 'minimum_order_value', label: 'Minimum Order Value (₹)', type: 'number' },
      { key: 'delivery_charge', label: 'Default Delivery Charge (₹)', type: 'number' },
      { key: 'free_delivery_threshold', label: 'Free Delivery Above (₹)', type: 'number' },
      { key: 'handling_charge', label: 'Handling Charge (₹)', type: 'number' },
    ],
  },
  {
    title: 'Business Hours',
    icon: Clock,
    settings: [
      { key: 'order_start_time', label: 'Order Start Time', type: 'text', placeholder: '08:00' },
      { key: 'order_end_time', label: 'Order End Time', type: 'text', placeholder: '21:00' },
      { key: 'delivery_start_time', label: 'Delivery Start Time', type: 'text', placeholder: '09:00' },
      { key: 'delivery_end_time', label: 'Delivery End Time', type: 'text', placeholder: '20:00' },
    ],
  },
  {
    title: 'Notifications',
    icon: Bell,
    settings: [
      { key: 'admin_notification_email', label: 'Admin Notification Email', type: 'text' },
      { key: 'new_order_sms', label: 'SMS on New Order', type: 'toggle' },
      { key: 'order_update_sms', label: 'SMS on Order Update', type: 'toggle' },
    ],
  },
];

export default function AdminSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('business_settings').select('key, value');
      const map: Record<string, string> = {};
      data?.forEach(s => { map[s.key] = s.value; });
      setValues(map);
      setLoading(false);
    }
    load();
  }, []);

  const updateValue = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const entries = Object.entries(values);
    for (const [key, value] of entries) {
      // Upsert each setting
      const { data: existing } = await supabase
        .from('business_settings')
        .select('id')
        .eq('key', key)
        .single();

      if (existing) {
        await supabase.from('business_settings').update({ value }).eq('key', key);
      } else {
        await supabase.from('business_settings').insert({ key, value });
      }
    }
    toast({ title: 'Settings saved!', variant: 'success' });
    setSaving(false);
  };

  if (loading) {
    return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-48 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6 page-transition max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Settings className="w-5 h-5" /> Business Settings</h1>
          <p className="text-sm text-muted-foreground">Configure your store</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All
        </Button>
      </div>

      {SETTINGS_GROUPS.map(group => {
        const Icon = group.icon;
        return (
          <Card key={group.title} className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="w-4 h-4 text-primary" /> {group.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.settings.map(setting => (
                <div key={setting.key} className="flex items-center gap-4">
                  <label className="text-sm font-medium min-w-[180px] shrink-0">{setting.label}</label>
                  {setting.type === 'toggle' ? (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={values[setting.key] === 'true'}
                        onChange={e => updateValue(setting.key, e.target.checked ? 'true' : 'false')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary" />
                    </label>
                  ) : (
                    <input
                      type={setting.type === 'number' ? 'number' : 'text'}
                      value={values[setting.key] || ''}
                      onChange={e => updateValue(setting.key, e.target.value)}
                      placeholder={setting.placeholder || ''}
                      className="flex-1 h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 max-w-[300px]"
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All Settings
        </Button>
      </div>
    </div>
  );
}
