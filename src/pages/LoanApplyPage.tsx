import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { loanApplicationSchema, LoanApplicationFormData } from '@/lib/validations';
import { LoanProduct, getLoanProductByType } from '@/lib/loan-products';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Countdown } from '@/components/Countdown';
import { ActivationModal } from '@/components/ActivationModal';
import { toast } from 'sonner';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { FeatureDisabled } from '@/components/FeatureDisabled';

export default function LoanApplyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, refreshProfile } = useAuth();
  const { isEnabled } = usePlatformSettings();

  const product = location.state?.product as LoanProduct | undefined;
  const loanDisabled = !isEnabled('loan_applications_enabled');

  const [step, setStep] = useState<'form' | 'countdown' | 'limit' | 'activation' | 'blocked'>('form');
  const [generatedLimit, setGeneratedLimit] = useState(0);
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoanApplicationFormData>({
    resolver: zodResolver(loanApplicationSchema),
    defaultValues: {
      loanType: product?.type,
      existingLoans: false,
      existingLoanAmount: 0,
    },
  });

  const existingLoans = watch('existingLoans');

  useEffect(() => {
    if (!product) {
      navigate('/dashboard/products');
      return;
    }
    if (user) checkEligibility();
  }, [product, navigate, user]);

  const checkEligibility = async () => {
    // Check profile completeness
    if (profile) {
      const requiredFields = ['full_name', 'email', 'phone', 'id_number', 'county', 'sub_county', 'ward', 'address', 'date_of_birth'];
      const missing = requiredFields.filter(f => !((profile as any)[f]));
      if (missing.length > 0) {
        setProfileIncomplete(true);
        setBlockReason('Your profile is incomplete. Please update your profile before applying for a loan.');
        setStep('blocked');
        return;
      }
    }

    // Check for active/pending loans
    const { data: activeLoanApps } = await supabase
      .from('loan_applications')
      .select('id, status')
      .eq('user_id', user!.id)
      .in('status', ['pending', 'approved']);

    if (activeLoanApps && activeLoanApps.length > 0) {
      const hasPending = activeLoanApps.some(a => a.status === 'pending');
      setBlockReason(
        hasPending
          ? 'You already have a pending loan application. Please wait for it to be reviewed before applying again.'
          : 'You already have an approved loan. Please repay your current loan before applying for a new one.'
      );
      setStep('blocked');
      return;
    }

    // Check for active disbursements with outstanding balance
    const { data: activeDisbursements } = await supabase
      .from('loan_disbursements')
      .select('id, outstanding_balance, status')
      .eq('user_id', user!.id)
      .eq('status', 'active');

    if (activeDisbursements && activeDisbursements.some(d => d.outstanding_balance > 0)) {
      setBlockReason('You have an active loan with an outstanding balance. Please repay it before applying for a new loan.');
      setStep('blocked');
      return;
    }
  };

  const generateLimit = () => {
    // Generate random limit between 9,350 and 49,720
    const limit = Math.floor(Math.random() * (49720 - 9350 + 1)) + 9350;
    // Round to nearest 50
    return Math.round(limit / 50) * 50;
  };

  const onFormSubmit = async (data: LoanApplicationFormData) => {
    setStep('countdown');
  };

  const handleCountdownComplete = () => {
    const limit = generateLimit();
    setGeneratedLimit(limit);
    setSelectedAmount(limit);
    setStep('limit');
  };

  const handleApply = async () => {
    if (!profile?.is_active) {
      setShowActivation(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = watch();

      const { data: loanData, error } = await supabase.from('loan_applications').insert({
        user_id: user?.id,
        loan_type: formData.loanType,
        generated_limit: generatedLimit,
        applied_amount: selectedAmount,
        employment_status: formData.employmentStatus,
        monthly_income: formData.monthlyIncome,
        existing_loans: formData.existingLoans,
        existing_loan_amount: formData.existingLoanAmount || 0,
        monthly_expenses: formData.monthlyExpenses,
        next_of_kin_name: formData.nextOfKinName,
        next_of_kin_phone: formData.nextOfKinPhone,
        business_sector: formData.businessSector,
        number_of_dependents: formData.numberOfDependents,
        education_level: formData.educationLevel,
      }).select('id').single();

      if (error) throw error;

      const shortId = loanData?.id?.slice(0, 8).toUpperCase() || '';

      // Create notification for user
      await supabase.from('notifications').insert({
        user_id: user?.id,
        title: 'Loan Application Submitted',
        message: `Your loan application ID #${shortId} for KES ${selectedAmount.toLocaleString()} (${formData.loanType.replace('_', ' ')}) is pending review. We'll notify you once it's processed.`,
      });

      // Notify all admins about the new application
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (adminRoles && adminRoles.length > 0) {
        const adminNotifications = adminRoles.map((role) => ({
          user_id: role.user_id,
          title: 'New Loan Application',
          message: `New ${formData.loanType.replace('_', ' ')} loan application #${shortId} for KES ${selectedAmount.toLocaleString()} from ${profile?.full_name || 'a user'}. Please review.`,
        }));
        await supabase.from('notifications').insert(adminNotifications);
      }

      // Send SMS notification
      await supabase.functions.invoke('send-sms', {
        body: {
          phone: profile?.phone,
          message: `Dear ${profile?.full_name}, your loan application for KES ${selectedAmount.toLocaleString()} has been submitted successfully. We will review and update you soon. - Nyota Foundation`,
        },
      });

      toast.success('Loan application submitted successfully!');
      navigate('/dashboard/applications');
    } catch (error: any) {
      console.error('Application error:', error);
      toast.error(error.message || 'Failed to submit application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivationSuccess = () => {
    setShowActivation(false);
    refreshProfile();
    handleApply();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loanDisabled) {
    return (
      <DashboardLayout>
        <div className="p-4 lg:p-8"><FeatureDisabled title="Loan Applications Paused" message="Loan applications are currently not being accepted. Please check back later." /></div>
      </DashboardLayout>
    );
  }

  if (!product) return null;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate('/dashboard/products')}
        >
          <ArrowLeft size={16} />
          Back to Products
        </Button>

        <Card variant="elevated">
          <CardHeader>
            <div className="flex items-center gap-4">
              <span className="text-4xl">{product.icon}</span>
              <div>
                <CardTitle>{product.name}</CardTitle>
                <CardDescription>Complete the application form below</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {step === 'form' && (
              <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
                <input type="hidden" {...register('loanType')} />

                {/* Employment Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Employment Information</h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="employmentStatus">Employment Status</Label>
                      <Select onValueChange={(value: any) => setValue('employmentStatus', value)}>
                        <SelectTrigger className={errors.employmentStatus ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employed">Employed</SelectItem>
                          <SelectItem value="self_employed">Self Employed</SelectItem>
                          <SelectItem value="not_employed">Not Employed</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.employmentStatus && (
                        <p className="text-sm text-destructive mt-1">{errors.employmentStatus.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="monthlyIncome">Monthly Income (KES)</Label>
                      <Input
                        id="monthlyIncome"
                        type="number"
                        placeholder="e.g., 50000"
                        {...register('monthlyIncome', { valueAsNumber: true })}
                        className={errors.monthlyIncome ? 'border-destructive' : ''}
                      />
                      {errors.monthlyIncome && (
                        <p className="text-sm text-destructive mt-1">{errors.monthlyIncome.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="monthlyExpenses">Monthly Expenses (KES)</Label>
                      <Input
                        id="monthlyExpenses"
                        type="number"
                        placeholder="e.g., 30000"
                        {...register('monthlyExpenses', { valueAsNumber: true })}
                        className={errors.monthlyExpenses ? 'border-destructive' : ''}
                      />
                      {errors.monthlyExpenses && (
                        <p className="text-sm text-destructive mt-1">{errors.monthlyExpenses.message}</p>
                      )}
                    </div>

                    <div>
                      <Label>Do you have existing loans?</Label>
                      <div className="flex items-center gap-4 mt-2">
                        <Switch
                          checked={existingLoans}
                          onCheckedChange={(checked) => setValue('existingLoans', checked)}
                        />
                        <span className="text-sm">{existingLoans ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>

                  {existingLoans && (
                    <div>
                      <Label htmlFor="existingLoanAmount">Total Existing Loan Amount (KES)</Label>
                      <Input
                        id="existingLoanAmount"
                        type="number"
                        placeholder="e.g., 100000"
                        {...register('existingLoanAmount', { valueAsNumber: true })}
                      />
                    </div>
                  )}
                </div>

                {/* Next of Kin Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Next of Kin</h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="nextOfKinName">Full Name</Label>
                      <Input
                        id="nextOfKinName"
                        placeholder="Enter full name"
                        {...register('nextOfKinName')}
                        className={errors.nextOfKinName ? 'border-destructive' : ''}
                      />
                      {errors.nextOfKinName && (
                        <p className="text-sm text-destructive mt-1">{errors.nextOfKinName.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="nextOfKinPhone">Phone Number</Label>
                      <Input
                        id="nextOfKinPhone"
                        placeholder="0712345678"
                        {...register('nextOfKinPhone')}
                        className={errors.nextOfKinPhone ? 'border-destructive' : ''}
                      />
                      {errors.nextOfKinPhone && (
                        <p className="text-sm text-destructive mt-1">{errors.nextOfKinPhone.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Optional Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Additional Information (Optional)</h3>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="businessSector">Business Sector</Label>
                      <Input
                        id="businessSector"
                        placeholder="e.g., Retail"
                        {...register('businessSector')}
                      />
                    </div>

                    <div>
                      <Label htmlFor="numberOfDependents">Number of Dependents</Label>
                      <Input
                        id="numberOfDependents"
                        type="number"
                        placeholder="e.g., 3"
                        {...register('numberOfDependents', { valueAsNumber: true })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="educationLevel">Education Level</Label>
                      <Select onValueChange={(value) => setValue('educationLevel', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">Primary</SelectItem>
                          <SelectItem value="secondary">Secondary</SelectItem>
                          <SelectItem value="diploma">Diploma</SelectItem>
                          <SelectItem value="degree">Bachelor's Degree</SelectItem>
                          <SelectItem value="masters">Master's Degree</SelectItem>
                          <SelectItem value="phd">PhD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Button type="submit" variant="gold" className="w-full">
                  Generate Loan Limit
                  <ArrowRight size={16} />
                </Button>
              </form>
            )}

            {step === 'countdown' && (
              <div className="py-12 text-center">
                <h3 className="font-display text-xl font-semibold mb-4">
                  Calculating Your Loan Limit
                </h3>
                <p className="text-muted-foreground mb-8">
                  Please wait while we analyze your information...
                </p>
                <div className="flex justify-center">
                  <Countdown duration={5} onComplete={handleCountdownComplete} />
                </div>
              </div>
            )}

            {step === 'limit' && (
              <div className="py-8 space-y-8">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Your Approved Limit</p>
                  <p className="text-4xl font-display font-bold text-success">
                    {formatCurrency(generatedLimit)}
                  </p>
                </div>

                <div className="space-y-4">
                  <Label>Select Amount to Apply</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="range"
                      min={product.minAmount}
                      max={generatedLimit}
                      step={100}
                      value={selectedAmount}
                      onChange={(e) => setSelectedAmount(Number(e.target.value))}
                      className="flex-1"
                    />
                    <div className="w-32 text-right">
                      <p className="font-bold text-lg">{formatCurrency(selectedAmount)}</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Min: {formatCurrency(product.minAmount)}</span>
                    <span>Max: {formatCurrency(generatedLimit)}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep('form')}
                  >
                    <ArrowLeft size={16} />
                    Back
                  </Button>
                  <Button
                    variant="gold"
                    className="flex-1"
                    onClick={handleApply}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Apply for {formatCurrency(selectedAmount)}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            {step === 'blocked' && (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="text-destructive" size={32} />
                </div>
                <h3 className="font-display text-xl font-semibold">Cannot Apply</h3>
                <p className="text-muted-foreground max-w-md mx-auto">{blockReason}</p>
                <div className="flex gap-3 justify-center pt-2">
                  {profileIncomplete ? (
                    <Button variant="gold" onClick={() => navigate('/dashboard/account')}>
                      Update Profile
                    </Button>
                  ) : (
                    <Button variant="gold" onClick={() => navigate('/dashboard/applications')}>
                      View My Applications
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <ActivationModal
          open={showActivation}
          onClose={() => setShowActivation(false)}
          onSuccess={handleActivationSuccess}
        />
      </div>
    </DashboardLayout>
  );
}
