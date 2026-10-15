'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';
import { Camera, Upload, X, FileImage, Send, CheckCircle2, Clock } from 'lucide-react';

export default function ParchaPage() {
  const { user, retailer } = useAuth();
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [slipNumber, setSlipNumber] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Max 10MB per image', variant: 'destructive' });
        return;
      }
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        toast({ title: 'Invalid file', description: 'Only images and PDFs allowed', variant: 'destructive' });
        return;
      }
      newFiles.push(file);
      if (file.type.startsWith('image/')) {
        newPreviews.push(URL.createObjectURL(file));
      } else {
        newPreviews.push('/pdf-icon.svg');
      }
    });

    setImages((prev) => [...prev, ...newFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const url = prev[index];
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !retailer || images.length === 0) {
      toast({ title: 'Please add at least one image of your parcha', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      // Upload images
      const uploadedUrls: string[] = [];
      for (const file of images) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('parcha')
          .upload(path, file, { contentType: file.type });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
          setLoading(false);
          return;
        }
        const { data: urlData } = supabase.storage.from('parcha').getPublicUrl(path);
        uploadedUrls.push(urlData.publicUrl);
      }

      // Generate slip number
      const slipNum = `SLIP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-5)}`;

      // Create parcha request
      const { error: insertError } = await supabase.from('parcha_requests').insert({
        slip_number: slipNum,
        profile_id: user.id,
        retailer_id: retailer.id,
        image_urls: uploadedUrls,
        instructions: instructions || null,
        preferred_delivery_time: deliveryTime || null,
        status: 'NEW',
      });

      if (insertError) {
        toast({ title: 'Failed to submit', description: insertError.message, variant: 'destructive' });
        setLoading(false);
        return;
      }

      setSlipNumber(slipNum);
      setSubmitted(true);
      toast({ title: 'Parcha submitted!', description: 'Our team will call you shortly', variant: 'success' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Something went wrong', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 page-transition">
        <Card className="border-0 shadow-lg text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold">Parcha Submitted!</h2>
            <p className="text-muted-foreground">
              Your order slip has been received. Our team will review it and call you to confirm the order.
            </p>
            <div className="bg-muted rounded-xl p-4">
              <p className="text-sm text-muted-foreground">Slip Number</p>
              <p className="text-lg font-bold font-mono text-primary">{slipNumber}</p>
            </div>
            <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Expected callback within 30 minutes</span>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                setSubmitted(false);
                setImages([]);
                setPreviews([]);
                setInstructions('');
                setDeliveryTime('');
              }}
            >
              Submit Another Parcha
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 page-transition">
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
          <CardTitle className="flex items-center gap-2">
            <FileImage className="w-5 h-5" />
            Order by Parcha
          </CardTitle>
          <CardDescription className="text-orange-100">
            Click a photo of your handwritten shopping list or upload an image. We&apos;ll call you to confirm and deliver!
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Image upload area */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Your Parcha / Shopping List *</label>

              {/* Upload buttons */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-20 flex-col gap-1 border-dashed border-2"
                  onClick={() => cameraRef.current?.click()}
                >
                  <Camera className="w-6 h-6 text-primary" />
                  <span className="text-xs">Take Photo</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-20 flex-col gap-1 border-dashed border-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-6 h-6 text-primary" />
                  <span className="text-xs">Upload Image</span>
                </Button>
              </div>

              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />

              {/* Image previews */}
              {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {previews.map((preview, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden border">
                      <img src={preview} alt={`Parcha ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Instructions */}
            <Textarea
              label="Special Instructions (Optional)"
              placeholder="E.g., Need Apis Honey 100g x 12 pcs, Colgate MaxFresh x 24..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
            />

            {/* Preferred time */}
            <Input
              label="Preferred Delivery Time (Optional)"
              placeholder="E.g., Before 2 PM, Evening 5-7 PM"
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
            />

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
              loading={loading}
              disabled={images.length === 0}
            >
              <Send className="w-4 h-4" />
              Submit Parcha
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              After submission, our team will call you within 30 minutes to confirm products, quantities, and prices.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
