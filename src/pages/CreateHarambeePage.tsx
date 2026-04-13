import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HeartHandshake, ArrowRight, ArrowLeft, Upload, X, Loader2, CheckCircle2,
  AlertCircle, FileText, Camera, User, Phone, Heart, GraduationCap, Stethoscope,
  HelpCircle, Image as ImageIcon, Shield, Wallet, Eye, Plus, Clock, CheckCircle, XCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ─── Category definitions ───
const CATEGORIES = [
  { id: 'funeral', label: 'Funeral / Burial', icon: Heart, color: 'text-red-400', bg: 'bg-red-500/10', desc: 'Fundraise for burial expenses and related costs' },
  { id: 'school_fees', label: 'School Fees', icon: GraduationCap, color: 'text-blue-400', bg: 'bg-blue-500/10', desc: 'Education support for students at any level' },
  { id: 'medical', label: 'Medical Emergency', icon: Stethoscope, color: 'text-emerald-400', bg: 'bg-emerald-500/10', desc: 'Hospital bills and medical treatment costs' },
  { id: 'other', label: 'Other Cause', icon: HelpCircle, color: 'text-accent', bg: 'bg-accent/10', desc: 'Any other verified fundraising need' },
];

interface DocRequirement {
  key: string;
  label: string;
  required: boolean;
}

const FUNERAL_DOCS: DocRequirement[] = [
  { key: 'burial_permit', label: 'Burial Permit', required: true },
  { key: 'death_certificate', label: 'Death Certificate', required: true },
  { key: 'medical_report', label: 'Hospital Medical Report (Stamped)', required: true },
  { key: 'id_front', label: 'Initiator ID — Front', required: true },
  { key: 'id_back', label: 'Initiator ID — Back', required: true },
];

const SCHOOL_NEW_DOCS: DocRequirement[] = [
  { key: 'admission_letter', label: 'Admission Letter', required: true },
  { key: 'kcse_result', label: 'KCSE Result Slip', required: true },
  { key: 'parent_id', label: "Parent's ID Card", required: true },
  { key: 'birth_certificate', label: 'Birth Certificate of Beneficiary', required: true },
  { key: 'id_front', label: 'Initiator ID — Front', required: true },
  { key: 'id_back', label: 'Initiator ID — Back', required: true },
];

const SCHOOL_CONTINUING_DOCS: DocRequirement[] = [
  { key: 'admission_letter', label: 'Admission Letter', required: true },
  { key: 'fee_statement', label: 'Proof of Arrears / Fee Statement', required: true },
  { key: 'student_id', label: 'Student ID Card', required: true },
  { key: 'welfare_letter', label: 'Stamped Letter (Dean of Students / Chief / Welfare)', required: true },
  { key: 'id_front', label: 'Initiator ID — Front', required: true },
  { key: 'id_back', label: 'Initiator ID — Back', required: true },
];

const MEDICAL_DOCS: DocRequirement[] = [
  { key: 'medical_report', label: 'Medical Report (Hospital Stamped)', required: true },
  { key: 'hospital_bill', label: 'Hospital Bill / Invoice', required: true },
  { key: 'id_front', label: 'Initiator ID — Front', required: true },
  { key: 'id_back', label: 'Initiator ID — Back', required: true },
];

const OTHER_DOCS: DocRequirement[] = [
  { key: 'supporting_image_1', label: 'Supporting Image 1 (Mandatory)', required: true },
  { key: 'supporting_image_2', label: 'Supporting Image 2', required: false },
  { key: 'supporting_doc', label: 'Any Supporting Document', required: false },
  { key: 'id_front', label: 'Initiator ID — Front', required: true },
  { key: 'id_back', label: 'Initiator ID — Back', required: true },
];

function getDocsForCategory(category: string, studentType?: string): DocRequirement[] {
  switch (category) {
    case 'funeral': return FUNERAL_DOCS;
    case 'school_fees': return studentType === 'continuing' ? SCHOOL_CONTINUING_DOCS : SCHOOL_NEW_DOCS;
    case 'medical': return MEDICAL_DOCS;
    default: return OTHER_DOCS;
  }
}

// ─── Main Component ───
export default function CreateHarambeePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('create');
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && activeTab === 'my_apps') {
      setLoadingApps(true);
      supabase
        .from('harambee_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setMyApplications(data);
          setLoadingApps(false);
        });
    }
  }, [user, activeTab]);

  // Step 1
  const [category, setCategory] = useState('');

  // Step 2 - Common
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryPhone, setBeneficiaryPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');

  // Payout details
  const [payoutMethod, setPayoutMethod] = useState('');
  const [payoutPhone, setPayoutPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankBranch, setBankBranch] = useState('');

  // Category-specific answers
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const setAnswer = (key: string, val: string) => setAnswers(prev => ({ ...prev, [key]: val }));

  // Step 3 - Documents
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { file: File; preview: string }>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocKey, setActiveDocKey] = useState('');

  const totalSteps = 4;
  const docs = getDocsForCategory(category, answers.student_type);
  const requiredDocs = docs.filter(d => d.required);

  // ─── Validation ───
  const canProceedStep2 = () => {
    if (!beneficiaryName.trim() || !relationship.trim()) return false;
    // Description: min 400 chars
    if (!description.trim() || description.trim().length < 400) return false;
    const amt = Number(targetAmount);
    if (!amt || amt < 500) return false;
    // Deadline is mandatory
    if (!deadline) return false;

    if (category === 'funeral') {
      if (!answers.deceased_name || !answers.date_of_death || !answers.burial_date || !answers.burial_location) return false;
    }
    if (category === 'school_fees') {
      if (!answers.student_type || !answers.student_name || !answers.school_name || !answers.education_level) return false;
      if (answers.student_type === 'continuing' && !answers.fee_balance) return false;
    }
    if (category === 'medical') {
      if (!answers.patient_name || !answers.hospital_name || !answers.diagnosis) return false;
    }
    if (category === 'other') {
      if (!answers.reason_detail) return false;
    }
    // Payout details required
    if (!payoutMethod) return false;
    if (payoutMethod === 'mpesa' && !payoutPhone) return false;
    if (payoutMethod === 'bank' && (!bankName || !bankAccountNumber || !bankAccountName || !bankBranch)) return false;
    return true;
  };

  const canProceedStep3 = () => {
    return requiredDocs.every(d => uploadedDocs[d.key]);
  };

  // ─── File handling ───
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDocKey) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedDocs(prev => ({
        ...prev,
        [activeDocKey]: { file, preview: ev.target?.result as string }
      }));
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeDoc = (key: string) => {
    setUploadedDocs(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  // ─── Submit ───
  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);

    try {
      // 1. Create application
      // Validate payout account name matches profile
      if (payoutMethod === 'bank' && profile?.full_name && bankAccountName.trim().toLowerCase() !== profile.full_name.trim().toLowerCase()) {
        toast.error('Bank account name must match your verified profile name: ' + profile.full_name);
        setSubmitting(false);
        return;
      }

      const { data: app, error: appError } = await supabase
        .from('harambee_applications')
        .insert({
          user_id: user.id,
          category,
          beneficiary_name: beneficiaryName.trim(),
          beneficiary_phone: beneficiaryPhone.trim() || null,
          beneficiary_relationship: relationship.trim(),
          description: description.trim(),
          target_amount: Number(targetAmount),
          deadline: deadline || null,
          category_answers: answers,
          platform_fee_percent: 3,
          is_public: true,
          status: 'pending_review',
          payout_method: payoutMethod,
          payout_phone: payoutMethod === 'mpesa' ? payoutPhone : null,
          bank_name: payoutMethod === 'bank' ? bankName : null,
          bank_account_number: payoutMethod === 'bank' ? bankAccountNumber : null,
          bank_account_name: payoutMethod === 'bank' ? bankAccountName : null,
          bank_branch: payoutMethod === 'bank' ? bankBranch : null,
        })
        .select('id')
        .single();

      if (appError) throw appError;

      // 2. Upload documents
      const docEntries = Object.entries(uploadedDocs);
      for (const [docType, { file }] of docEntries) {
        const ext = file.name.split('.').pop();
        const path = `${user.id}/${app.id}/${docType}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('harambee-verification').upload(path, file);
        if (uploadError) {
          console.error(`Upload error for ${docType}:`, uploadError);
          continue;
        }

        await supabase.from('harambee_application_documents').insert({
          application_id: app.id,
          user_id: user.id,
          document_type: docType,
          file_path: path,
          file_name: file.name,
          file_size: file.size,
        });
      }

      // 3. Notify admins
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (admins?.length) {
        await supabase.from('notifications').insert(
          admins.map(a => ({
            user_id: a.user_id,
            title: '🆕 New Harambee Application',
            message: `${profile?.full_name || 'A user'} submitted a ${category.replace('_', ' ')} fundraiser for ${beneficiaryName}. Target: KES ${Number(targetAmount).toLocaleString()}. Requires verification.`,
            type: 'harambee',
          }))
        );
      }

      toast.success('Fundraiser application submitted! It will be reviewed by our team within 24 hours.');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Category-specific questions ───
  const renderCategoryQuestions = () => {
    switch (category) {
      case 'funeral':
        return (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
              <p className="text-[11px] font-bold text-red-400 flex items-center gap-2"><AlertCircle size={12} /> Funeral-specific details required</p>
            </div>
            <Field label="Full Name of the Deceased *" value={answers.deceased_name || ''} onChange={v => setAnswer('deceased_name', v)} placeholder="As per official documents" />
            <Field label="Cause of Death" value={answers.cause_of_death || ''} onChange={v => setAnswer('cause_of_death', v)} placeholder="e.g. Illness, accident" />
            <Field label="Date of Death *" value={answers.date_of_death || ''} onChange={v => setAnswer('date_of_death', v)} type="date" />
            <Field label="Planned Burial Date *" value={answers.burial_date || ''} onChange={v => setAnswer('burial_date', v)} type="date" />
            <Field label="Burial Location (County, Town) *" value={answers.burial_location || ''} onChange={v => setAnswer('burial_location', v)} placeholder="e.g. Kisumu, Ahero" />
            <Field label="Name of Hospital / Mortuary" value={answers.hospital_mortuary || ''} onChange={v => setAnswer('hospital_mortuary', v)} placeholder="Where the body is held" />
            <Field label="Number of Dependents Left Behind" value={answers.dependents_count || ''} onChange={v => setAnswer('dependents_count', v)} type="number" placeholder="0" />
          </div>
        );

      case 'school_fees':
        return (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <p className="text-[11px] font-bold text-blue-400 flex items-center gap-2"><GraduationCap size={12} /> Education fundraiser details</p>
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Student Type *</Label>
              <Select value={answers.student_type || ''} onValueChange={v => setAnswer('student_type', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New Student (Yet to Join)</SelectItem>
                  <SelectItem value="continuing">Continuing Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field label="Full Name of Student *" value={answers.student_name || ''} onChange={v => setAnswer('student_name', v)} placeholder="As per school records" />
            <Field label="School / Institution Name *" value={answers.school_name || ''} onChange={v => setAnswer('school_name', v)} placeholder="Full name of school" />
            <div>
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Education Level *</Label>
              <Select value={answers.education_level || ''} onValueChange={v => setAnswer('education_level', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary School</SelectItem>
                  <SelectItem value="secondary">Secondary School</SelectItem>
                  <SelectItem value="college">College / TVET</SelectItem>
                  <SelectItem value="university">University</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {answers.student_type === 'continuing' && (
              <>
                <Field label="Year / Form of Study" value={answers.year_of_study || ''} onChange={v => setAnswer('year_of_study', v)} placeholder="e.g. Form 3, Year 2" />
                <Field label="Outstanding Fee Balance (KES) *" value={answers.fee_balance || ''} onChange={v => setAnswer('fee_balance', v)} type="number" placeholder="Amount owed" />
                <Field label="Admission Number" value={answers.admission_number || ''} onChange={v => setAnswer('admission_number', v)} placeholder="Student admission number" />
              </>
            )}
            {answers.student_type === 'new' && (
              <>
                <Field label="Admission Year" value={answers.admission_year || ''} onChange={v => setAnswer('admission_year', v)} placeholder="e.g. 2026" />
                <Field label="KCSE Score (if applicable)" value={answers.kcse_score || ''} onChange={v => setAnswer('kcse_score', v)} placeholder="e.g. B+" />
              </>
            )}
            <Field label="Why does this student need financial help?" value={answers.reason_detail || ''} onChange={v => setAnswer('reason_detail', v)} multiline placeholder="Explain the family's financial situation..." />
          </div>
        );

      case 'medical':
        return (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-[11px] font-bold text-emerald-400 flex items-center gap-2"><Stethoscope size={12} /> Medical emergency details</p>
            </div>
            <Field label="Full Name of Patient *" value={answers.patient_name || ''} onChange={v => setAnswer('patient_name', v)} placeholder="As per hospital records" />
            <Field label="Hospital / Facility Name *" value={answers.hospital_name || ''} onChange={v => setAnswer('hospital_name', v)} placeholder="Where treatment is being done" />
            <Field label="Diagnosis / Condition *" value={answers.diagnosis || ''} onChange={v => setAnswer('diagnosis', v)} placeholder="e.g. Kidney failure, cancer treatment" />
            <Field label="Treatment Required" value={answers.treatment_needed || ''} onChange={v => setAnswer('treatment_needed', v)} placeholder="e.g. Surgery, dialysis, chemotherapy" />
            <Field label="Estimated Medical Cost (KES)" value={answers.estimated_cost || ''} onChange={v => setAnswer('estimated_cost', v)} type="number" placeholder="Total bill estimate" />
            <Field label="Insurance Status" value={answers.insurance_status || ''} onChange={v => setAnswer('insurance_status', v)} placeholder="e.g. NHIF active, no cover" />
            <Field label="How long has the patient been admitted?" value={answers.admission_duration || ''} onChange={v => setAnswer('admission_duration', v)} placeholder="e.g. 2 weeks" />
          </div>
        );

      case 'other':
        return (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-accent/5 border border-accent/10">
              <p className="text-[11px] font-bold text-accent flex items-center gap-2"><HelpCircle size={12} /> Provide detailed information about your cause</p>
            </div>
            <Field label="What exactly do you need funds for? *" value={answers.reason_detail || ''} onChange={v => setAnswer('reason_detail', v)} multiline placeholder="Be specific and detailed — this helps build trust with contributors..." />
            <Field label="How will the funds be used?" value={answers.fund_usage || ''} onChange={v => setAnswer('fund_usage', v)} multiline placeholder="Breakdown of how money will be spent" />
            <Field label="Have you tried other means of raising funds?" value={answers.other_efforts || ''} onChange={v => setAnswer('other_efforts', v)} multiline placeholder="Explain what else you've done" />
            <Field label="Any reference person who can verify? (Name & Phone)" value={answers.reference_person || ''} onChange={v => setAnswer('reference_person', v)} placeholder="e.g. Chief John - 0722xxxxxx" />
          </div>
        );

      default: return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="font-display text-xl lg:text-2xl font-bold text-foreground">Create Fundraiser</h1>
            <p className="text-xs text-muted-foreground">Step {step} of {totalSteps}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="create" className="gap-1.5 text-xs"><Plus size={14} /> New Fundraiser</TabsTrigger>
            <TabsTrigger value="my_apps" className="gap-1.5 text-xs"><Eye size={14} /> My Applications</TabsTrigger>
          </TabsList>

          <TabsContent value="my_apps" className="mt-4 space-y-3">
            {loadingApps ? (
              <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></div>
            ) : myApplications.length === 0 ? (
              <Card className="p-8 text-center">
                <HeartHandshake size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium">No Applications Yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first fundraiser to get started.</p>
              </Card>
            ) : (
              myApplications.map(app => (
                <Card key={app.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{app.beneficiary_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{app.category?.replace('_', ' ')} · {format(new Date(app.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                      app.status === 'approved' || app.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' :
                      app.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                      'bg-accent/10 text-accent'
                    }`}>
                      {app.status === 'pending_review' ? 'Under Review' : app.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{app.description}</p>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-sm font-bold">KES {app.target_amount?.toLocaleString()}</p>
                    {app.deadline && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock size={10} /> Deadline: {format(new Date(app.deadline), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                  {app.payout_method && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Payout: {app.payout_method === 'mpesa' ? `M-Pesa (${app.payout_phone || 'N/A'})` : `Bank (${app.bank_name || 'N/A'})`}
                    </p>
                  )}
                  {app.admin_notes && (
                    <p className="text-[10px] text-muted-foreground mt-2 italic bg-muted/20 p-2 rounded">Admin: {app.admin_notes}</p>
                  )}
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="create" className="mt-4 space-y-4">
            {/* Progress bar */}
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? 'bg-accent' : 'bg-muted/30'}`} />
              ))}
            </div>

            {/* ─── STEP 1: Category ─── */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-accent/5 border border-accent/10">
                  <p className="text-xs font-bold text-accent flex items-center gap-2"><Shield size={14} /> All fundraisers are verified before going live. A 3% platform fee applies on collected funds.</p>
                </div>
                <h2 className="text-lg font-bold">What is this fundraiser for?</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => { setCategory(cat.id); setStep(2); }}
                      className={`text-left p-5 rounded-2xl border transition-all duration-200 group hover:shadow-md ${
                        category === cat.id ? 'border-accent bg-accent/5' : 'border-border/40 bg-card hover:border-accent/30'
                      }`}>
                      <div className={`w-11 h-11 rounded-xl ${cat.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        <cat.icon size={20} className={cat.color} />
                      </div>
                      <h3 className="font-bold text-sm">{cat.label}</h3>
                      <p className="text-[11px] text-muted-foreground mt-1">{cat.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

        {/* ─── STEP 2: Details & Questions ─── */}
        {step === 2 && (
          <div className="space-y-6">
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <User size={14} className="text-primary" /> Beneficiary Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Beneficiary Full Name *" value={beneficiaryName} onChange={setBeneficiaryName} placeholder="Full legal name of person receiving help" />
                <Field label="Beneficiary Phone" value={beneficiaryPhone} onChange={setBeneficiaryPhone} placeholder="07xxxxxxxx (optional)" />
                <div>
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Your Relationship to Beneficiary *</Label>
                  <Select value={relationship} onValueChange={setRelationship}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select relationship" /></SelectTrigger>
                    <SelectContent>
                      {['Self', 'Parent', 'Child', 'Spouse', 'Sibling', 'Relative', 'Friend', 'Colleague', 'Community Member', 'Organization'].map(r => (
                        <SelectItem key={r} value={r.toLowerCase()}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileText size={14} className="text-primary" /> Fundraiser Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Description / Story * (min 400, max 800 characters)</Label>
                  <Textarea value={description} onChange={e => { if (e.target.value.length <= 800) setDescription(e.target.value); }} placeholder="Tell contributors why this fundraiser matters. Be honest and detailed..." className="mt-1 font-medium min-h-[120px]" />
                  <p className={`text-[10px] mt-1 ${description.length < 400 ? 'text-destructive' : description.length > 750 ? 'text-accent' : 'text-muted-foreground'}`}>
                    {description.length}/800 characters {description.length < 400 && `(${400 - description.length} more needed)`}
                  </p>
                </div>
                <Field label="Target Amount (KES) *" value={targetAmount} onChange={setTargetAmount} type="number" placeholder="Minimum KES 500" />
                {Number(targetAmount) >= 500 && (
                  <p className="text-[10px] text-muted-foreground bg-muted/20 p-2 rounded-lg">
                    💡 Platform fee: 3% of collected = <strong className="text-accent">KES {Math.round(Number(targetAmount) * 0.03).toLocaleString()}</strong> if fully funded
                  </p>
                )}
                <Field label="Deadline *" value={deadline} onChange={setDeadline} type="date" />
              </CardContent>
            </Card>

            {/* Payout Details */}
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Wallet size={14} className="text-primary" /> Payout Details *
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Payout Method *</Label>
                  <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="How should funds be sent?" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {payoutMethod === 'mpesa' && (
                  <Field label="M-Pesa Phone Number *" value={payoutPhone} onChange={setPayoutPhone} placeholder="07xxxxxxxx" />
                )}
                {payoutMethod === 'bank' && (
                  <>
                    <Field label="Bank Name *" value={bankName} onChange={setBankName} placeholder="e.g. KCB, Equity, Co-op" />
                    <Field label="Account Number *" value={bankAccountNumber} onChange={setBankAccountNumber} placeholder="Bank account number" />
                    <Field label="Account Name * (must match your profile name)" value={bankAccountName} onChange={setBankAccountName} placeholder={profile?.full_name || 'Full name on bank account'} />
                    <Field label="Branch *" value={bankBranch} onChange={setBankBranch} placeholder="e.g. Nairobi CBD" />
                    {profile?.full_name && bankAccountName && bankAccountName.trim().toLowerCase() !== profile.full_name.trim().toLowerCase() && (
                      <p className="text-[10px] text-destructive bg-destructive/5 p-2 rounded-lg">
                        ⚠️ Account name must match your verified profile name: <strong>{profile.full_name}</strong>
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  {CATEGORIES.find(c => c.id === category)?.icon && (() => {
                    const Icon = CATEGORIES.find(c => c.id === category)!.icon;
                    return <Icon size={14} className="text-primary" />;
                  })()}
                  {CATEGORIES.find(c => c.id === category)?.label} Questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderCategoryQuestions()}
              </CardContent>
            </Card>

            <Button className="w-full h-12 font-bold shadow-md" disabled={!canProceedStep2()} onClick={() => setStep(3)}>
              Continue to Documents <ArrowRight size={16} />
            </Button>
          </div>
        )}

        {/* ─── STEP 3: Document Uploads ─── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-accent/5 border border-accent/10">
              <p className="text-xs font-bold text-accent flex items-center gap-2"><Camera size={14} /> Upload clear, legible photos or scans of each document</p>
              <p className="text-[10px] text-muted-foreground mt-1">Documents marked with * are mandatory. Max 10MB per file.</p>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />

            <div className="space-y-3">
              {docs.map(doc => {
                const uploaded = uploadedDocs[doc.key];
                return (
                  <div key={doc.key} className={`p-4 rounded-xl border transition-all ${
                    uploaded ? 'border-emerald-500/30 bg-emerald-500/5' : doc.required ? 'border-border/40 bg-card' : 'border-border/20 bg-muted/10'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {uploaded ? (
                          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center">
                            <ImageIcon size={16} className="text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-bold">{doc.label}{doc.required ? ' *' : ''}</p>
                          {uploaded && <p className="text-[10px] text-emerald-400 font-medium">{uploaded.file.name}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {uploaded && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeDoc(doc.key)}>
                            <X size={14} />
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold" onClick={() => { setActiveDocKey(doc.key); fileInputRef.current?.click(); }}>
                          <Upload size={12} className="mr-1" /> {uploaded ? 'Replace' : 'Upload'}
                        </Button>
                      </div>
                    </div>
                    {uploaded && uploaded.preview.startsWith('data:image') && (
                      <img src={uploaded.preview} alt={doc.label} className="mt-3 w-full max-h-40 object-contain rounded-lg border border-border/20" />
                    )}
                  </div>
                );
              })}
            </div>

            <Button className="w-full h-12 font-bold shadow-md" disabled={!canProceedStep3()} onClick={() => setStep(4)}>
              Review Application <ArrowRight size={16} />
            </Button>
          </div>
        )}

        {/* ─── STEP 4: Review & Submit ─── */}
        {step === 4 && (
          <div className="space-y-4">
            <Card className="border-accent/20 bg-accent/5">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                    <HeartHandshake size={24} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{beneficiaryName}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{category.replace('_', ' ')} Fundraiser</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-[9px] font-bold uppercase text-muted-foreground">Target</p>
                    <p className="text-xl font-bold text-accent">KES {Number(targetAmount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase text-muted-foreground">Platform Fee</p>
                    <p className="text-xl font-bold text-foreground">3%</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>

                <div className="pt-3 border-t border-border/20 space-y-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Documents Attached</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(uploadedDocs).map(([key, val]) => (
                      <span key={key} className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                        <CheckCircle2 size={10} /> {docs.find(d => d.key === key)?.label || key}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="p-4 rounded-xl bg-muted/20 border border-border/30 space-y-2">
              <p className="text-xs font-bold flex items-center gap-2"><Shield size={12} className="text-primary" /> What happens next?</p>
              <ol className="text-[11px] text-muted-foreground space-y-1.5 list-decimal ml-4">
                <li>Our team reviews your application and documents within <strong>24 hours</strong></li>
                <li>If approved, your fundraiser goes live with a unique shareable link</li>
                <li>Contributors donate via M-Pesa directly through the platform</li>
                <li>A <strong>3% platform fee</strong> is deducted from total collected funds</li>
                <li>Remaining funds are disbursed to the beneficiary</li>
              </ol>
            </div>

            <Button className="w-full h-14 text-lg font-bold shadow-xl bg-emerald-600 hover:bg-emerald-700" disabled={submitting} onClick={handleSubmit}>
              {submitting ? <Loader2 className="animate-spin mr-2" /> : <HeartHandshake size={20} className="mr-2" />}
              {submitting ? 'Submitting...' : 'Submit for Verification'}
            </Button>

            <p className="text-[10px] text-center text-muted-foreground italic">
              By submitting, you confirm all information and documents are genuine. False applications will be reported.
            </p>
          </div>
          </div>
        )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ─── Reusable Field Component ───
function Field({ label, value, onChange, placeholder, type = 'text', multiline = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; multiline?: boolean;
}) {
  return (
    <div>
      <Label className="text-[10px] font-bold uppercase text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="mt-1 font-medium min-h-[80px]" />
      ) : (
        <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="mt-1 h-11 font-medium" />
      )}
    </div>
  );
}
