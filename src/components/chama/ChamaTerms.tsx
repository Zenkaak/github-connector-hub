import { useState, useEffect, useRef } from 'react';
import { FileText, PenTool, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_TERMS = `CHAMA GROUP TERMS AND CONDITIONS

1. MEMBERSHIP
   a) All members must be registered and verified on the platform.
   b) New members can join through approved join requests or direct invitation by leaders.
   c) Members may voluntarily leave by submitting a leave request to the Chairperson.
   d) Leaving members are subject to the group's refund policy as configured in settings.
   e) Members who leave are deactivated, not deleted, to preserve group records.
   f) A lock-in period may apply — members cannot leave before the minimum duration set by the Chairperson.
   g) Maximum group membership is capped as configured in settings.
   h) Members who are deactivated lose voting rights and access to group resources.

2. CONTRIBUTIONS
   a) All members are required to make contributions as per the agreed schedule and amount.
   b) Contributions must be made via M-Pesa through the platform.
   c) Late contributions will be recorded as arrears and visible to all members.
   d) Partial contributions may be allowed if enabled by the Chairperson, subject to minimum thresholds.
   e) A grace period may be granted before late penalties are applied, as configured in settings.
   f) Members who consistently fail to contribute may be automatically deactivated if auto-removal is enabled.

3. LATE PAYMENT PENALTIES
   a) Members who fail to contribute on time may be subject to penalties if enabled.
   b) Penalties may be a fixed amount or a percentage of the contribution.
   c) Penalty amounts and type are configured by the Chairperson.
   d) A grace period (in days) is allowed before penalties apply.
   e) Consistent defaulters may be deactivated at the Chairperson's discretion.
   f) Penalty income is added to the group's total savings pool.

4. SAVINGS & WITHDRAWALS
   a) Withdrawals must be requested by the Treasurer and approved by all three leaders.
   b) Approved withdrawals are subject to final admin authorization.
   c) Individual savings refunds on leaving are governed by the group's refund policy.
   d) An emergency fund reserve may be maintained as configured by the Chairperson.
   e) Regular withdrawals and leave refund withdrawals are tracked separately.

5. EMERGENCY FUND
   a) If enabled, a percentage of each contribution is reserved for emergencies.
   b) Emergency fund withdrawals require Chairperson approval and admin authorization.
   c) The reserve percentage is set by the Chairperson in group settings.
   d) Emergency fund access is limited to genuine emergencies such as medical, funeral, or natural disasters.
   e) Members must provide documentation or evidence when requesting emergency fund access.

6. GROUP LOANS
   a) Internal lending is available if enabled by the Chairperson.
   b) Loan amounts, interest rates, and duration are configured by the Chairperson.
   c) Loan requests require Chairperson approval.
   d) Outstanding loans must be settled before a member can leave the group.
   e) Maximum loan amount may be limited by a multiplier of the member's total savings.
   f) A guarantor from within the group may be required if configured.
   g) Interest earned on loans is added to the group savings pool.
   h) Defaulting on a loan may result in deactivation and forfeiture of savings.

7. GOVERNANCE & DECISION-MAKING
   a) The Chairperson has overall leadership and final decision-making authority.
   b) The Secretary handles group communications and records.
   c) The Treasurer manages financial transactions.
   d) Role changes can only be made by the Chairperson.
   e) Meetings are held as per the schedule set in group settings.
   f) A quorum (minimum percentage of members) is required for valid decisions.
   g) Voting may be required for major decisions, all decisions, financial decisions, or none (Chairperson decides).
   h) All decisions made in meetings must be documented and communicated to absent members.

8. JOINING & FEES
   a) New members may request to join through the group explorer (if group is public).
   b) Join requests require approval from group leadership.
   c) A joining fee may be required as configured by the Chairperson.
   d) Private groups are not visible on the explorer and members must be added by leaders.
   e) The joining fee is non-refundable unless otherwise stated in the refund policy.

9. MEMBER EXIT & REFUNDS
   a) Members wishing to leave must submit a formal leave request.
   b) The Chairperson reviews and approves or rejects leave requests.
   c) Refund policy options: No Refund, Full Refund, or Percentage Refund.
   d) Approved refunds are processed as a withdrawal and require admin authorization.
   e) The lock-in period must have elapsed before a leave request is accepted.
   f) Members with outstanding loans cannot leave until loans are fully repaid.
   g) Refund processing may take up to 14 working days.

10. GROUP DISSOLUTION
    a) The Chairperson may initiate group dissolution with valid reason.
    b) Dissolution requires admin approval and authorization.
    c) Upon dissolution, group funds are distributed according to the dissolution policy:
       - Equal Split: Total savings divided equally among all active members.
       - Proportional: Each member receives funds proportional to their contributions.
       - Chairperson Decides: Distribution is determined by the Chairperson at dissolution.
    d) All outstanding loans must be settled before dissolution can proceed.
    e) Dissolution withdrawals are processed separately from regular withdrawals.
    f) Notice of at least 30 days must be given to all members before dissolution.

11. DISPUTE RESOLUTION
    a) Internal disputes shall first be mediated by the Chairperson.
    b) If unresolved, the matter may be escalated to platform administration.
    c) Decisions by platform administration are final and binding.
    d) Members agree not to pursue legal action before exhausting internal dispute mechanisms.
    e) Any member found to be engaging in fraud or misrepresentation shall be immediately deactivated.

12. CODE OF CONDUCT
    a) Members shall treat each other with respect and dignity.
    b) Harassment, discrimination, or abusive language is strictly prohibited.
    c) Group chat and announcements must be used for group-related matters only.
    d) Sharing group financial information with non-members is prohibited.
    e) Members shall not impersonate leaders or misrepresent group decisions.
    f) Violation of the code of conduct may result in warnings, penalties, or deactivation.

13. COMMUNICATION & RECORDS
    a) Official group communications are made through the platform's chat and announcement features.
    b) Meeting minutes and decisions shall be shared via announcements.
    c) Members are expected to regularly check group updates and notifications.
    d) Financial records are accessible to all active group members.
    e) The Secretary is responsible for maintaining accurate records.

14. INVESTMENT & GROWTH
    a) The group may set annual savings targets as configured by the Chairperson.
    b) Investment decisions require majority vote or Chairperson approval as per governance settings.
    c) All investments must be documented and reported to members.
    d) Investment returns are shared according to the group's distribution policy.
    e) High-risk investments require unanimous consent of all leaders.

15. DATA & PRIVACY
    a) Member information is kept confidential within the group.
    b) Financial records are accessible to all active group members.
    c) Deactivated members' historical data is preserved for record-keeping.
    d) Groups may be set as public or private by the Chairperson.
    e) The platform stores transaction records for audit purposes.
    f) Members consent to SMS and in-app notifications for group activities.

16. ANNUAL GENERAL MEETING (AGM)
    a) The group shall hold an AGM at least once per year.
    b) The AGM agenda shall include: financial report, election of officials, review of terms.
    c) All active members are entitled to attend and vote at the AGM.
    d) The Chairperson may call special general meetings as needed.
    e) AGM decisions override previous non-AGM decisions on the same matter.

17. ANTI-FRAUD & SECURITY
    a) Multiple payment confirmations are required for large withdrawals.
    b) All M-Pesa transactions are verified through callback confirmation before recording.
    c) Suspicious activity should be reported to the Chairperson and platform administration.
    d) Members are responsible for securing their accounts and not sharing login credentials.
    e) The platform reserves the right to freeze group funds pending investigation of fraud.

18. WELFARE FUND
    a) If enabled, a separate welfare fund is maintained for member support.
    b) Welfare contributions are fixed monthly amounts as set by the Chairperson.
    c) Welfare fund access covers: medical emergencies, bereavements, births, and other approved welfare events.
    d) Claims must be documented and approved by the Chairperson.
    e) Unused welfare funds roll over to the next period.

19. SPECIAL CONTRIBUTIONS
    a) Members may make special one-off contributions if enabled by the Chairperson.
    b) Special contributions are recorded separately but added to the member's total savings.
    c) Special contributions may be directed to specific group projects or funds.

20. NEW MEMBER PROBATION
    a) New members may be subject to a probation period as configured by the Chairperson.
    b) During probation, members cannot access loans or request withdrawals.
    c) Probationary members have full voting rights unless otherwise specified.
    d) Upon completion of probation, members gain full access to all group features.

21. MEETING ATTENDANCE
    a) Members are expected to attend all scheduled meetings.
    b) Absence penalties may apply as configured by the Chairperson.
    c) Members must notify leadership in advance if unable to attend.
    d) Meeting minutes are shared with all members via announcements.
    e) Proxy attendance or voting is not permitted unless approved by the Chairperson.

22. DIVIDEND & PROFIT SHARING
    a) Profits from group investments and loan interest are distributed as per the configured method.
    b) Distribution may be equal, proportional to savings, or as decided by the Chairperson.
    c) Distribution frequency is configured by the Chairperson (monthly, quarterly, biannually, or annually).
    d) Members must be active and in good standing to receive dividends.

23. WITHDRAWAL LIMITS
    a) Maximum monthly withdrawal limits may be set by the Chairperson.
    b) Withdrawal requests exceeding the limit will be rejected.
    c) Emergency withdrawals may override limits with Chairperson approval.

24. CONTRIBUTION ROLLOVER
    a) If enabled, excess contributions beyond the required amount carry over to the next period.
    b) Rollover credits reduce the next period's required contribution.
    c) Rollover tracking is automatic and visible in transaction records.

25. AMENDMENTS
    a) These terms may be amended by the Chairperson.
    b) All members will be notified of changes and must re-sign.
    c) Continued participation after notification constitutes acceptance.
    d) Major amendments (affecting financial obligations) require at least 7 days notice.
    e) A group vote may be initiated for significant amendments if required by governance settings.

By signing below, I agree to abide by these terms and conditions.`;

interface Props {
  groupId: string;
  group: any;
  members: Array<{ user_id: string; role: string; profile?: { full_name: string } }>;
  myRole: string;
  onRefreshGroup: () => void;
}

export function ChamaTerms({ groupId, group, members, myRole, onRefreshGroup }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [terms, setTerms] = useState(group?.terms || '');
  const [saving, setSaving] = useState(false);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [signOpen, setSignOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const isChairperson = myRole === 'chairperson';
  const isLeader = ['chairperson', 'secretary', 'treasurer'].includes(myRole);

  useEffect(() => {
    if (isLeader && !group?.terms) {
      autoCreateTerms();
    }
  }, [group?.terms, isChairperson]);

  const autoCreateTerms = async () => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('chama_groups').update({
        terms: DEFAULT_TERMS,
        terms_updated_at: now,
      }).eq('id', groupId);
      if (!error) onRefreshGroup();
    } catch {}
  };

  const fetchSignatures = async () => {
    const { data } = await supabase
      .from('chama_term_signatures')
      .select('*')
      .eq('group_id', groupId)
      .order('signed_at', { ascending: false });
    if (data) setSignatures(data);
  };

  useEffect(() => { fetchSignatures(); }, [groupId]);

  const termsVersion = group?.terms_updated_at ? new Date(group.terms_updated_at).toISOString() : '';
  const mySig = signatures.find(s => s.user_id === user?.id && new Date(s.terms_version).toISOString() === termsVersion);
  const hasSigned = !!mySig;

  const handleSaveTerms = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('chama_groups').update({
        terms: terms,
        terms_updated_at: now,
      }).eq('id', groupId);

      if (error) throw error;

      await supabase.from('notifications').insert(
        members.map(m => ({
          user_id: m.user_id,
          title: 'Terms & Conditions Updated',
          message: 'The group terms and conditions have been changed. Please review and sign the updated terms.',
        }))
      );

      toast({ title: 'Terms Saved', description: 'All members have been notified.' });
      setEditing(false);
      onRefreshGroup();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const endDraw = () => { isDrawing.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSign = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !user || !group?.terms_updated_at) return;
    setSigning(true);
    try {
      const signatureData = canvas.toDataURL('image/png');
      const { error } = await supabase.from('chama_term_signatures').insert({
        group_id: groupId,
        user_id: user.id,
        signature_data: signatureData,
        terms_version: group.terms_updated_at,
      });
      if (error) throw error;

      toast({ title: 'Terms Signed', description: `Signed at ${new Date().toLocaleString('en-KE')}` });
      setSignOpen(false);
      fetchSignatures();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText size={18} /> Terms & Conditions
          </h3>
          {isChairperson && !editing && (
            <Button variant="outline" size="sm" onClick={() => { setTerms(group?.terms_and_conditions || ''); setEditing(true); }}>
              Edit Terms
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <Textarea value={terms} onChange={e => setTerms(e.target.value)} rows={20} placeholder="Write your group's terms and conditions here..." />
            <div className="flex gap-2">
              <Button onClick={handleSaveTerms} disabled={saving}>{saving ? 'Saving...' : 'Save & Notify Members'}</Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : group?.terms_and_conditions ? (
          <div className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed max-h-[400px] overflow-y-auto">
            {group.terms_and_conditions}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No terms and conditions set yet.</p>
        )}

        {group?.terms_updated_at && (
          <p className="text-[11px] text-muted-foreground mt-3">
            Last updated: {new Date(group.terms_updated_at).toLocaleString('en-KE')}
          </p>
        )}
      </Card>

      {group?.terms_and_conditions && !hasSigned && (
        <Card className="p-4 border-accent/30 bg-accent/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">You haven't signed yet</p>
              <p className="text-xs text-muted-foreground">Review the terms above, then sign to confirm your agreement.</p>
            </div>
            <Button onClick={() => setSignOpen(true)} variant="default" className="gap-2 shrink-0">
              <PenTool size={16} /> Sign Now
            </Button>
          </div>
        </Card>
      )}
      {hasSigned && (
        <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
          <p className="text-sm text-emerald-600 flex items-center gap-2">
            <Check size={16} /> You signed on {new Date(mySig.signed_at).toLocaleString('en-KE')}
          </p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Signatures ({signatures.filter(s => new Date(s.terms_version).toISOString() === termsVersion).length}/{members.length})</h3>
        </div>
        <div className="divide-y">
          {members.map(m => {
            const sig = signatures.find(s => s.user_id === m.user_id && new Date(s.terms_version).toISOString() === termsVersion);
            return (
              <div key={m.user_id} className="p-3 flex items-center justify-between">
                <span className="text-sm">{m.profile?.full_name || 'Unknown'}</span>
                {sig ? (
                  <span className="text-[11px] text-emerald-500">Signed {new Date(sig.signed_at).toLocaleDateString('en-KE')}</span>
                ) : (
                  <span className="text-[11px] text-destructive">Not signed</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Sign Terms & Conditions</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Draw your signature below to agree to the terms.</p>
            <div className="border rounded-xl overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                width={380}
                height={200}
                className="w-full cursor-crosshair touch-none"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSign} disabled={signing} className="flex-1">
                {signing ? 'Signing...' : 'Confirm Signature'}
              </Button>
              <Button variant="outline" onClick={clearCanvas}>Clear</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
