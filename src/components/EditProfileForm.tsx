import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { kenyaCounties } from '@/lib/loan-products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().regex(/^(?:\+254|0)7\d{8}$/, 'Enter a valid Kenyan phone number'),
  county: z.string().min(1, 'County is required'),
  subCounty: z.string().min(1, 'Sub-county is required'),
  ward: z.string().min(1, 'Ward is required'),
  address: z.string().min(2, 'Address is required'),
  idNumber: z.string().regex(/^\d{7,8}$/, 'Enter a valid ID number (7-8 digits)'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface EditProfileFormProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export function EditProfileForm({ onComplete, onCancel }: EditProfileFormProps) {
  const { profile, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name || '',
      email: profile?.email || user?.email || '',
      phone: profile?.phone || '',
      county: profile?.county || '',
      subCounty: profile?.sub_county || '',
      ward: profile?.ward || '',
      address: profile?.address || '',
      idNumber: profile?.id_number || '',
      dateOfBirth: profile?.date_of_birth || '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsLoading(true);
    try {
      let phone = data.phone;
      if (phone.startsWith('0')) phone = '+254' + phone.slice(1);
      else if (!phone.startsWith('+')) phone = '+254' + phone;

      const profileData = {
        user_id: user.id,
        full_name: data.fullName,
        email: data.email,
        phone,
        county: data.county,
        sub_county: data.subCounty,
        ward: data.ward,
        address: data.address,
        id_number: data.idNumber,
        date_of_birth: data.dateOfBirth,
        is_verified: true,
      };

      if (profile) {
        const { error } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('user_id', user.id);
        if (error) throw error;
        toast.success('Profile updated successfully!');
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert(profileData);
        if (error) throw error;
        toast.success('Profile completed successfully!');
      }

      onComplete();
    } catch (error: any) {
      console.error('Profile save error:', error);
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  const isNew = !profile;
  const isLocked = !isNew; // Existing profiles have locked identity fields

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">
          {isNew ? 'Complete Your Profile' : 'Edit Profile'}
        </CardTitle>
        {isLocked && (
          <p className="text-xs text-muted-foreground mt-1">Name, ID, Phone, and Email cannot be edited. Contact admin via WhatsApp (+254725336731) for changes.</p>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name (as per ID)</Label>
              <Input {...register('fullName')} placeholder="John Doe" disabled={isLocked} className={`mt-1.5 ${errors.fullName ? 'border-destructive' : ''} ${isLocked ? 'bg-muted cursor-not-allowed' : ''}`} />
              {errors.fullName && <p className="text-xs text-destructive mt-1">{errors.fullName.message}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Address</Label>
              <Input {...register('email')} type="email" placeholder="john@example.com" disabled={isLocked} className={`mt-1.5 ${errors.email ? 'border-destructive' : ''} ${isLocked ? 'bg-muted cursor-not-allowed' : ''}`} />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone Number</Label>
              <Input {...register('phone')} placeholder="0712345678" disabled={isLocked} className={`mt-1.5 ${errors.phone ? 'border-destructive' : ''} ${isLocked ? 'bg-muted cursor-not-allowed' : ''}`} />
              {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">National ID Number</Label>
              <Input {...register('idNumber')} placeholder="12345678" disabled={isLocked} className={`mt-1.5 ${errors.idNumber ? 'border-destructive' : ''} ${isLocked ? 'bg-muted cursor-not-allowed' : ''}`} />
              {errors.idNumber && <p className="text-xs text-destructive mt-1">{errors.idNumber.message}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date of Birth</Label>
              <Input {...register('dateOfBirth')} type="date" disabled={isLocked} className={`mt-1.5 ${errors.dateOfBirth ? 'border-destructive' : ''} ${isLocked ? 'bg-muted cursor-not-allowed' : ''}`} />
              {errors.dateOfBirth && <p className="text-xs text-destructive mt-1">{errors.dateOfBirth.message}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">County</Label>
              <Select defaultValue={profile?.county} onValueChange={(v) => setValue('county', v)}>
                <SelectTrigger className={`mt-1.5 ${errors.county ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Select county" />
                </SelectTrigger>
                <SelectContent>
                  {kenyaCounties.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.county && <p className="text-xs text-destructive mt-1">{errors.county.message}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sub-County</Label>
              <Input {...register('subCounty')} placeholder="Enter sub-county" className={`mt-1.5 ${errors.subCounty ? 'border-destructive' : ''}`} />
              {errors.subCounty && <p className="text-xs text-destructive mt-1">{errors.subCounty.message}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ward</Label>
              <Input {...register('ward')} placeholder="Enter ward" className={`mt-1.5 ${errors.ward ? 'border-destructive' : ''}`} />
              {errors.ward && <p className="text-xs text-destructive mt-1">{errors.ward.message}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Physical Address</Label>
              <Input {...register('address')} placeholder="Street, Building, etc." className={`mt-1.5 ${errors.address ? 'border-destructive' : ''}`} />
              {errors.address && <p className="text-xs text-destructive mt-1">{errors.address.message}</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            {onCancel && (
              <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" variant="gold" className="flex-1" disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="animate-spin" size={16} /> Saving...</>
              ) : (
                <><Save size={16} /> {isNew ? 'Complete Profile' : 'Save Changes'}</>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
