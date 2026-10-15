'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';
import { Store, ArrowRight, UserPlus } from 'lucide-react';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    shop_name: '',
    shop_type: 'Kirana Store',
    pincode: '',
    locality: '',
    full_address: '',
    landmark: '',
  });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const router = useRouter();

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();

      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            phone: formData.phone,
            role: 'RETAILER',
          },
        },
      });

      if (authError) {
        toast({ title: 'Registration failed', description: authError.message, variant: 'destructive' });
        setLoading(false);
        return;
      }

      if (authData.user) {
        // 2. Create retailer record
        const { error: retailerError } = await supabase.from('retailers').insert({
          profile_id: authData.user.id,
          shop_name: formData.shop_name,
          shop_type: formData.shop_type,
        });

        if (retailerError) {
          console.error('Retailer creation error:', retailerError);
        }

        // 3. Create address
        if (formData.full_address) {
          await supabase.from('addresses').insert({
            profile_id: authData.user.id,
            label: 'Shop',
            full_name: formData.full_name,
            phone: formData.phone,
            pincode: formData.pincode,
            locality: formData.locality,
            full_address: formData.full_address,
            landmark: formData.landmark,
            is_default: true,
          });
        }

        // 4. Create cart
        await supabase.from('carts').insert({
          profile_id: authData.user.id,
        });

        toast({ title: 'Account created!', description: 'Welcome to Store2Door', variant: 'success' });
        router.push('/');
        router.refresh();
      }
    } catch {
      toast({ title: 'Something went wrong', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Store2Door
          </h1>
          <p className="text-sm text-muted-foreground">Create your wholesale ordering account</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className={`w-3 h-3 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`w-8 h-0.5 ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`w-3 h-3 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`w-8 h-0.5 ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`w-3 h-3 rounded-full transition-colors ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        <Card className="border-0 shadow-xl shadow-emerald-100/50">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <UserPlus className="w-5 h-5" />
              {step === 1 ? 'Personal Details' : step === 2 ? 'Shop Details' : 'Delivery Address'}
            </CardTitle>
            <CardDescription>
              {step === 1 ? 'Step 1 of 3' : step === 2 ? 'Step 2 of 3' : 'Step 3 of 3'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              {step === 1 && (
                <>
                  <Input
                    label="Full Name *"
                    placeholder="Your full name"
                    value={formData.full_name}
                    onChange={(e) => updateField('full_name', e.target.value)}
                    required
                  />
                  <Input
                    label="Email Address *"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    required
                  />
                  <Input
                    label="Mobile Number *"
                    type="tel"
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    required
                  />
                  <Input
                    label="Password *"
                    type="password"
                    placeholder="Min 6 characters"
                    value={formData.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    required
                    minLength={6}
                  />
                  <Button type="button" className="w-full" size="lg" onClick={() => setStep(2)}
                    disabled={!formData.full_name || !formData.email || !formData.phone || !formData.password}>
                    Next <ArrowRight className="w-4 h-4" />
                  </Button>
                </>
              )}

              {step === 2 && (
                <>
                  <Input
                    label="Shop Name *"
                    placeholder="Your shop name"
                    value={formData.shop_name}
                    onChange={(e) => updateField('shop_name', e.target.value)}
                    required
                  />
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Shop Type</label>
                    <select
                      className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={formData.shop_type}
                      onChange={(e) => updateField('shop_type', e.target.value)}
                    >
                      <option>Kirana Store</option>
                      <option>General Store</option>
                      <option>Supermarket</option>
                      <option>Medical Store</option>
                      <option>Cosmetic Shop</option>
                      <option>Paan Shop</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button type="button" className="flex-1" onClick={() => setStep(3)}
                      disabled={!formData.shop_name}>
                      Next <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <Input
                    label="Pincode *"
                    placeholder="247662"
                    value={formData.pincode}
                    onChange={(e) => updateField('pincode', e.target.value)}
                    required
                    maxLength={6}
                  />
                  <Input
                    label="Locality / Area *"
                    placeholder="Chhutmalpur"
                    value={formData.locality}
                    onChange={(e) => updateField('locality', e.target.value)}
                    required
                  />
                  <Input
                    label="Full Address *"
                    placeholder="Shop No., Market, Road, Village"
                    value={formData.full_address}
                    onChange={(e) => updateField('full_address', e.target.value)}
                    required
                  />
                  <Input
                    label="Landmark"
                    placeholder="Near Bus Station"
                    value={formData.landmark}
                    onChange={(e) => updateField('landmark', e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>
                      Back
                    </Button>
                    <Button type="submit" className="flex-1" size="lg" loading={loading}
                      disabled={!formData.pincode || !formData.locality || !formData.full_address}>
                      Create Account <UserPlus className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
