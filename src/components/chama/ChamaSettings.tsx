import { useState } from 'react';
import { Save, DollarSign, Users, Landmark, Shield, Calendar, AlertTriangle, Percent, Clock, Trash2, Bell, Target, Award, Gavel, FileText, Heart, Gift, TrendingUp, HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  groupId: string;
  group: any;
  members: Array<{ user_id: string }>;
  onRefreshGroup: () => void;
}

const FREQUENCY_LABELS: Record<string, string> = {
  every_2_hours: 'Every 2 Hours',
  daily: 'Daily',
  every_2_days: 'Every 2 Days',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

const MEETING_FREQ: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 Weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  none: 'No Regular Meetings',
};

const DAYS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export function ChamaSettings({ groupId, group, members, onRefreshGroup }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Savings
  const [frequency, setFrequency] = useState(group?.contribution_frequency || 'monthly');
  const [savingsAmount, setSavingsAmount] = useState(group?.contribution_amount?.toString() || '0');
  const [allowPartial, setAllowPartial] = useState(group?.allow_partial_contributions || false);
  const [minContribution, setMinContribution] = useState(group?.min_contribution_amount?.toString() || '0');
  const [annualTarget, setAnnualTarget] = useState(group?.annual_savings_target?.toString() || '0');

  // Membership
  const [joiningFee, setJoiningFee] = useState(group?.joining_fee?.toString() || '0');
  const [refundPolicy, setRefundPolicy] = useState(group?.refund_policy || 'no_refund');
  const [refundPercentage, setRefundPercentage] = useState(group?.refund_percentage?.toString() || '0');
  const [maxMembers, setMaxMembers] = useState(group?.max_members?.toString() || '50');
  const [isPublic, setIsPublic] = useState(group?.is_public !== false);
  const [lockPeriod, setLockPeriod] = useState(group?.lock_period_months?.toString() || '0');
  const [chairCanRemove, setChairCanRemove] = useState(group?.chairperson_can_remove_members || false);
  const [autoRemoveAfterMissed, setAutoRemoveAfterMissed] = useState(group?.auto_remove_after_missed?.toString() || '0');
  const [regNumber, setRegNumber] = useState(group?.group_registration_number || '');
  const [description, setDescription] = useState(group?.description || '');

  // Penalties
  const [penaltyEnabled, setPenaltyEnabled] = useState(group?.late_penalty_enabled || false);
  const [penaltyAmount, setPenaltyAmount] = useState(group?.late_penalty_amount?.toString() || '0');
  const [penaltyType, setPenaltyType] = useState(group?.late_penalty_type || 'fixed');
  const [gracePeriod, setGracePeriod] = useState(group?.grace_period_days?.toString() || '0');

  // Loans
  const [loanEnabled, setLoanEnabled] = useState(group?.loan_enabled || false);
  const [loanMaxAmount, setLoanMaxAmount] = useState(group?.loan_max_amount?.toString() || '0');
  const [loanInterestRate, setLoanInterestRate] = useState(group?.loan_interest_rate?.toString() || '5');
  const [loanMaxDuration, setLoanMaxDuration] = useState(group?.loan_max_duration_months?.toString() || '3');
  const [requireGuarantor, setRequireGuarantor] = useState(group?.require_guarantor_for_loans || false);
  const [maxLoanMultiplier, setMaxLoanMultiplier] = useState(group?.max_loan_multiplier?.toString() || '3');

  // Meetings & Governance
  const [meetingFrequency, setMeetingFrequency] = useState(group?.meeting_frequency || 'monthly');
  const [meetingDay, setMeetingDay] = useState(group?.meeting_day || '');
  const [quorumPercentage, setQuorumPercentage] = useState(group?.quorum_percentage?.toString() || '50');
  const [votingRequired, setVotingRequired] = useState(group?.voting_required_for || 'major_decisions');

  // Emergency Fund
  const [emergencyFundEnabled, setEmergencyFundEnabled] = useState(group?.emergency_fund_enabled || false);
  const [emergencyFundPercentage, setEmergencyFundPercentage] = useState(group?.emergency_fund_percentage?.toString() || '10');

  // Notifications
  const [notifSavingsReminder, setNotifSavingsReminder] = useState(group?.notification_savings_reminder !== false);
  const [notifMeetingReminder, setNotifMeetingReminder] = useState(group?.notification_meeting_reminder !== false);

  // Dissolution
  const [dissolutionPolicy, setDissolutionPolicy] = useState(group?.dissolution_policy || 'equal_split');

  // New settings
  const [meetingAbsencePenalty, setMeetingAbsencePenalty] = useState(group?.meeting_absence_penalty?.toString() || '0');
  const [maxWithdrawalPerMonth, setMaxWithdrawalPerMonth] = useState(group?.max_withdrawal_per_month?.toString() || '0');
  const [contributionRollover, setContributionRollover] = useState(group?.contribution_rollover_enabled || false);
  const [probationMonths, setProbationMonths] = useState(group?.new_member_probation_months?.toString() || '0');
  const [dividendFrequency, setDividendFrequency] = useState(group?.dividend_distribution_frequency || 'annually');
  const [profitSharing, setProfitSharing] = useState(group?.profit_sharing_method || 'proportional');
  const [specialContribution, setSpecialContribution] = useState(group?.special_contribution_enabled || false);
  const [welfareFundEnabled, setWelfareFundEnabled] = useState(group?.welfare_fund_enabled || false);
  const [welfareFundAmount, setWelfareFundAmount] = useState(group?.welfare_fund_amount?.toString() || '0');
  const [harambeeEnabled, setHarambeeEnabled] = useState(group?.harambee_enabled || false);
  const [requireBackdatedSavings, setRequireBackdatedSavings] = useState(group?.require_backdated_savings || false);

  // New settings
  const [loanProcessingFee, setLoanProcessingFee] = useState(group?.loan_processing_fee?.toString() || '0');
  const [loanInsurancePercentage, setLoanInsurancePercentage] = useState(group?.loan_insurance_percentage?.toString() || '0');
  const [minSavingsBeforeLoan, setMinSavingsBeforeLoan] = useState(group?.min_savings_before_loan?.toString() || '0');
  const [allowEarlyWithdrawal, setAllowEarlyWithdrawal] = useState(group?.allow_early_withdrawal || false);
  const [earlyWithdrawalPenalty, setEarlyWithdrawalPenalty] = useState(group?.early_withdrawal_penalty?.toString() || '0');
  const [merryGoRoundEnabled, setMerryGoRoundEnabled] = useState(group?.merry_go_round_enabled || false);
  const [investmentEnabled, setInvestmentEnabled] = useState(group?.investment_enabled || false);
  const [investmentTypes, setInvestmentTypes] = useState(group?.investment_types || 'none');
  const [shareTransferAllowed, setShareTransferAllowed] = useState(group?.share_transfer_allowed || false);
  const [minBalanceRequired, setMinBalanceRequired] = useState(group?.min_balance_required?.toString() || '0');

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('chama_groups').update({
        description: description || null,
        contribution_frequency: frequency,
        contribution_amount: parseInt(savingsAmount) || 0,
        joining_fee: parseInt(joiningFee) || 0,
        max_members: parseInt(maxMembers) || 50,
        is_public: isPublic,
        meeting_day: meetingDay || null,
        late_contribution_penalty: parseInt(penaltyAmount) || 0,
        meeting_absence_penalty: parseInt(meetingAbsencePenalty) || 0,
        terms: group?.terms || null,
      }).eq('id', groupId);

      if (error) throw error;

      await supabase.from('notifications').insert(
        members.map(m => ({
          user_id: m.user_id,
          title: 'Group Settings Updated',
          message: `The group settings have been updated by the Chairperson. Please review the changes.`,
        }))
      );

      toast({ title: 'Settings Saved', description: 'All members have been notified.' });
      onRefreshGroup();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Group Identity */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <FileText size={18} className="text-muted-foreground" /> Group Identity
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Group Description</Label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe your chama group..."
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
              maxLength={500}
            />
            <p className="text-[11px] text-muted-foreground mt-1">Brief description of your group's purpose ({description.length}/500)</p>
          </div>
          <div>
            <Label>Registration Number (Optional)</Label>
            <Input value={regNumber} onChange={e => setRegNumber(e.target.value)} placeholder="e.g. CMA/2024/001" className="mt-1" />
            <p className="text-[11px] text-muted-foreground mt-1">Official group registration number if registered</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            <div>
              <Label>Publicly Visible</Label>
              <p className="text-[11px] text-muted-foreground">Show group in Explore page for new members to find</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Savings Configuration */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <DollarSign size={18} className="text-primary" /> Savings Configuration
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Contribution Amount (KES)</Label>
            <Input type="number" value={savingsAmount} onChange={e => setSavingsAmount(e.target.value)} min={0} className="mt-1" />
          </div>
          <div>
            <Label>Contribution Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Annual Savings Target (KES)</Label>
            <Input type="number" value={annualTarget} onChange={e => setAnnualTarget(e.target.value)} min={0} className="mt-1" />
            <p className="text-[11px] text-muted-foreground mt-1">Target amount to collectively save per year. 0 = no target.</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={allowPartial} onCheckedChange={setAllowPartial} />
            <div>
              <Label>Allow Partial Contributions</Label>
              <p className="text-[11px] text-muted-foreground">Members can pay less than the full amount</p>
            </div>
          </div>
          {allowPartial && (
            <div>
              <Label>Minimum Contribution (KES)</Label>
              <Input type="number" value={minContribution} onChange={e => setMinContribution(e.target.value)} min={0} className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Minimum amount accepted per period</p>
            </div>
          )}
        </div>
      </Card>

      {/* Late Payment Penalties */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-accent" /> Late Payment Penalties
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <Switch checked={penaltyEnabled} onCheckedChange={setPenaltyEnabled} />
          <Label>Enable late payment penalties</Label>
        </div>
        {penaltyEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Grace Period (Days)</Label>
              <Input type="number" value={gracePeriod} onChange={e => setGracePeriod(e.target.value)} min={0} max={30} className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Days after deadline before penalty applies. 0 = immediate.</p>
            </div>
            <div>
              <Label>Penalty Type</Label>
              <Select value={penaltyType} onValueChange={setPenaltyType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Amount (KES)</SelectItem>
                  <SelectItem value="percentage">Percentage of Contribution</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{penaltyType === 'fixed' ? 'Penalty Amount (KES)' : 'Penalty Percentage (%)'}</Label>
              <Input type="number" value={penaltyAmount} onChange={e => setPenaltyAmount(e.target.value)} min={0} className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">
                {penaltyType === 'fixed' ? 'Flat fee charged per missed period' : 'e.g. 10 means 10% of the contribution amount'}
              </p>
            </div>
            <div>
              <Label>Auto-Remove After Missed Payments</Label>
              <Input type="number" value={autoRemoveAfterMissed} onChange={e => setAutoRemoveAfterMissed(e.target.value)} min={0} max={12} className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Deactivate member after X consecutive missed payments. 0 = never.</p>
            </div>
          </div>
        )}
      </Card>

      {/* Membership Settings */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Users size={18} className="text-blue-500" /> Membership Settings
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Joining Fee (KES)</Label>
            <Input type="number" value={joiningFee} onChange={e => setJoiningFee(e.target.value)} min={0} className="mt-1" />
            <p className="text-[11px] text-muted-foreground mt-1">
              One-time fee new members must pay to join. This goes to the separate Joining Fee Wallet. Set to 0 for free joining.
            </p>
          </div>
          <div>
            <Label>Maximum Members</Label>
            <Input type="number" value={maxMembers} onChange={e => setMaxMembers(e.target.value)} min={3} max={500} className="mt-1" />
          </div>
          <div>
            <Label>Lock-in Period (Months)</Label>
            <Input type="number" value={lockPeriod} onChange={e => setLockPeriod(e.target.value)} min={0} max={60} className="mt-1" />
            <p className="text-[11px] text-muted-foreground mt-1">Minimum months before a member can leave. 0 = no lock.</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={chairCanRemove} onCheckedChange={setChairCanRemove} />
            <div>
              <Label>Chairperson Can Remove Members</Label>
              <p className="text-[11px] text-muted-foreground">Allow chairperson to directly deactivate members</p>
            </div>
          </div>
          <div>
            <Label>Refund Policy on Leaving</Label>
            <Select value={refundPolicy} onValueChange={setRefundPolicy}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no_refund">No Refund</SelectItem>
                <SelectItem value="full_refund">Full Refund</SelectItem>
                <SelectItem value="percentage">Percentage Refund</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {refundPolicy === 'percentage' && (
            <div>
              <Label>Refund Percentage (%)</Label>
              <Input type="number" value={refundPercentage} onChange={e => setRefundPercentage(e.target.value)} min={0} max={100} className="mt-1" />
            </div>
          )}
        </div>
      </Card>

      {/* Governance & Meetings */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Gavel size={18} className="text-purple-500" /> Governance & Meetings
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Meeting Frequency</Label>
            <Select value={meetingFrequency} onValueChange={setMeetingFrequency}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(MEETING_FREQ).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {meetingFrequency !== 'none' && (
            <div>
              <Label>Preferred Day</Label>
              <Select value={meetingDay} onValueChange={setMeetingDay}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select day" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DAYS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Quorum Percentage (%)</Label>
            <Input type="number" value={quorumPercentage} onChange={e => setQuorumPercentage(e.target.value)} min={10} max={100} className="mt-1" />
            <p className="text-[11px] text-muted-foreground mt-1">Minimum % of members needed for valid decisions</p>
          </div>
          <div>
            <Label>Voting Required For</Label>
            <Select value={votingRequired} onValueChange={setVotingRequired}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="major_decisions">Major Decisions Only</SelectItem>
                <SelectItem value="all_decisions">All Decisions</SelectItem>
                <SelectItem value="financial_only">Financial Decisions Only</SelectItem>
                <SelectItem value="chairperson_decides">Chairperson Decides (No Voting)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">When member voting is required</p>
          </div>
        </div>
      </Card>

      {/* Emergency Fund */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Shield size={18} className="text-red-500" /> Emergency Fund
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <Switch checked={emergencyFundEnabled} onCheckedChange={setEmergencyFundEnabled} />
          <div>
            <Label>Enable Emergency Fund</Label>
            <p className="text-[11px] text-muted-foreground">Auto-reserve a % of each contribution for emergencies</p>
          </div>
        </div>
        {emergencyFundEnabled && (
          <div className="max-w-xs">
            <Label>Reserve Percentage (%)</Label>
            <Input type="number" value={emergencyFundPercentage} onChange={e => setEmergencyFundPercentage(e.target.value)} min={1} max={50} className="mt-1" />
            <p className="text-[11px] text-muted-foreground mt-1">e.g. 10 means 10% of each contribution goes to emergency fund</p>
          </div>
        )}
      </Card>

      {/* Loan Settings */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Landmark size={18} className="text-emerald-500" /> Internal Loans
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <Switch checked={loanEnabled} onCheckedChange={setLoanEnabled} />
          <Label>Enable group lending</Label>
        </div>
        {loanEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Max Loan Amount (KES)</Label>
              <Input type="number" value={loanMaxAmount} onChange={e => setLoanMaxAmount(e.target.value)} min={0} className="mt-1" />
            </div>
            <div>
              <Label>Interest Rate (%)</Label>
              <Input type="number" value={loanInterestRate} onChange={e => setLoanInterestRate(e.target.value)} min={0} className="mt-1" />
            </div>
            <div>
              <Label>Max Duration (Months)</Label>
              <Input type="number" value={loanMaxDuration} onChange={e => setLoanMaxDuration(e.target.value)} min={1} max={24} className="mt-1" />
            </div>
            <div>
              <Label>Max Loan Multiplier (x Savings)</Label>
              <Input type="number" value={maxLoanMultiplier} onChange={e => setMaxLoanMultiplier(e.target.value)} min={1} max={10} step={0.5} className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Max loan = member's savings × this multiplier</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={requireGuarantor} onCheckedChange={setRequireGuarantor} />
              <div>
                <Label>Require Guarantor</Label>
                <p className="text-[11px] text-muted-foreground">Borrower must have another member as guarantor</p>
              </div>
            </div>
            <div>
              <Label>Loan Processing Fee (KES)</Label>
              <Input type="number" value={loanProcessingFee} onChange={e => setLoanProcessingFee(e.target.value)} min={0} className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">One-time fee charged when loan is disbursed. 0 = no fee.</p>
            </div>
            <div>
              <Label>Loan Insurance (%)</Label>
              <Input type="number" value={loanInsurancePercentage} onChange={e => setLoanInsurancePercentage(e.target.value)} min={0} max={20} step={0.5} className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Insurance percentage deducted from loan amount. 0 = none.</p>
            </div>
            <div>
              <Label>Min Savings Before Loan (KES)</Label>
              <Input type="number" value={minSavingsBeforeLoan} onChange={e => setMinSavingsBeforeLoan(e.target.value)} min={0} className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Member must have saved at least this amount before applying. 0 = no minimum.</p>
            </div>
          </div>
        )}
      </Card>

      {/* Notifications */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Bell size={18} className="text-accent" /> Notification Preferences
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={notifSavingsReminder} onCheckedChange={setNotifSavingsReminder} />
            <div>
              <Label>Savings Reminders</Label>
              <p className="text-[11px] text-muted-foreground">Send reminders before contribution deadlines</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={notifMeetingReminder} onCheckedChange={setNotifMeetingReminder} />
            <div>
              <Label>Meeting Reminders</Label>
              <p className="text-[11px] text-muted-foreground">Send reminders before scheduled meetings</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Welfare Fund */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Heart size={18} className="text-pink-500" /> Welfare Fund
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <Switch checked={welfareFundEnabled} onCheckedChange={setWelfareFundEnabled} />
          <div>
            <Label>Enable Welfare Fund</Label>
            <p className="text-[11px] text-muted-foreground">Separate fund for member welfare (medical, bereavement, etc.)</p>
          </div>
        </div>
        {welfareFundEnabled && (
          <div className="max-w-xs">
            <Label>Monthly Welfare Contribution (KES)</Label>
            <Input type="number" value={welfareFundAmount} onChange={e => setWelfareFundAmount(e.target.value)} min={0} className="mt-1" />
            <p className="text-[11px] text-muted-foreground mt-1">Fixed amount per member per month for welfare</p>
          </div>
        )}
      </Card>

      {/* Advanced Membership */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Gift size={18} className="text-indigo-500" /> Advanced Membership
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>New Member Probation (Months)</Label>
            <Input type="number" value={probationMonths} onChange={e => setProbationMonths(e.target.value)} min={0} max={12} className="mt-1" />
            <p className="text-[11px] text-muted-foreground mt-1">Period before new member can access loans/withdrawals. 0 = none.</p>
          </div>
          <div>
            <Label>Meeting Absence Penalty (KES)</Label>
            <Input type="number" value={meetingAbsencePenalty} onChange={e => setMeetingAbsencePenalty(e.target.value)} min={0} className="mt-1" />
            <p className="text-[11px] text-muted-foreground mt-1">Fine for missing a scheduled meeting. 0 = no penalty.</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={specialContribution} onCheckedChange={setSpecialContribution} />
            <div>
              <Label>Special Contributions</Label>
              <p className="text-[11px] text-muted-foreground">Allow one-off contributions beyond regular schedule</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={contributionRollover} onCheckedChange={setContributionRollover} />
            <div>
              <Label>Contribution Rollover</Label>
              <p className="text-[11px] text-muted-foreground">Excess contributions carry over to next period</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Profit & Dividends */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-emerald-500" /> Profit & Dividends
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Max Withdrawal Per Month (KES)</Label>
            <Input type="number" value={maxWithdrawalPerMonth} onChange={e => setMaxWithdrawalPerMonth(e.target.value)} min={0} className="mt-1" />
            <p className="text-[11px] text-muted-foreground mt-1">Maximum a member can withdraw monthly. 0 = unlimited.</p>
          </div>
          <div>
            <Label>Dividend Distribution</Label>
            <Select value={dividendFrequency} onValueChange={setDividendFrequency}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="biannually">Every 6 Months</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
                <SelectItem value="none">No Dividends</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Profit Sharing Method</Label>
            <Select value={profitSharing} onValueChange={setProfitSharing}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">Equal Split</SelectItem>
                <SelectItem value="proportional">Proportional to Savings</SelectItem>
                <SelectItem value="chairperson_decides">Chairperson Decides</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Backdated Savings Policy */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Clock size={18} className="text-orange-500" /> New Member Savings Policy
        </h3>
        <div className="flex items-center gap-3">
          <Switch checked={requireBackdatedSavings} onCheckedChange={setRequireBackdatedSavings} />
          <div>
            <Label>Require Backdated Savings</Label>
            <p className="text-[11px] text-muted-foreground">
              {requireBackdatedSavings
                ? 'New members must pay all missed contributions from the group start date before they can participate.'
                : 'New members start contributing from their join date — no backdated payments required.'}
            </p>
          </div>
        </div>
      </Card>

      {/* Harambee */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <HandCoins size={18} className="text-accent" /> Harambee (Fundraising)
        </h3>
        <div className="flex items-center gap-3">
          <Switch checked={harambeeEnabled} onCheckedChange={setHarambeeEnabled} />
          <div>
            <Label>Enable Harambee</Label>
            <p className="text-[11px] text-muted-foreground">Allow leaders to create fundraising campaigns. Cross-chama harambees notify all platform chairpersons.</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Trash2 size={18} className="text-destructive" /> Group Dissolution Policy
        </h3>
        <p className="text-xs text-muted-foreground mb-3">How group funds should be distributed if the group is dissolved.</p>
        <div className="max-w-sm">
          <Label>Dissolution Policy</Label>
          <Select value={dissolutionPolicy} onValueChange={setDissolutionPolicy}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="equal_split">Equal Split Among All Members</SelectItem>
              <SelectItem value="proportional">Proportional to Individual Savings</SelectItem>
              <SelectItem value="chairperson_decides">Chairperson Decides at Dissolution</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground mt-2">
            {dissolutionPolicy === 'equal_split' && 'Total group savings divided equally among all active members.'}
            {dissolutionPolicy === 'proportional' && 'Each member gets back what they saved (proportional to contributions).'}
            {dissolutionPolicy === 'chairperson_decides' && 'Chairperson will decide distribution at the time of dissolution.'}
          </p>
        </div>
      </Card>

      {/* Withdrawal Rules */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <DollarSign size={18} className="text-orange-500" /> Withdrawal Rules
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={allowEarlyWithdrawal} onCheckedChange={setAllowEarlyWithdrawal} />
            <div>
              <Label>Allow Early Withdrawal</Label>
              <p className="text-[11px] text-muted-foreground">Members can withdraw before lock-in period ends</p>
            </div>
          </div>
          {allowEarlyWithdrawal && (
            <div>
              <Label>Early Withdrawal Penalty (%)</Label>
              <Input type="number" value={earlyWithdrawalPenalty} onChange={e => setEarlyWithdrawalPenalty(e.target.value)} min={0} max={50} step={0.5} className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">Percentage deducted from withdrawal amount as penalty</p>
            </div>
          )}
          <div>
            <Label>Minimum Balance Required (KES)</Label>
            <Input type="number" value={minBalanceRequired} onChange={e => setMinBalanceRequired(e.target.value)} min={0} className="mt-1" />
            <p className="text-[11px] text-muted-foreground mt-1">Minimum savings balance a member must maintain. 0 = none.</p>
          </div>
        </div>
      </Card>

      {/* Merry-Go-Round & Investments */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-blue-500" /> Merry-Go-Round & Investments
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={merryGoRoundEnabled} onCheckedChange={setMerryGoRoundEnabled} />
            <div>
              <Label>Merry-Go-Round</Label>
              <p className="text-[11px] text-muted-foreground">Rotating fund where members take turns receiving the pool</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={investmentEnabled} onCheckedChange={setInvestmentEnabled} />
            <div>
              <Label>Group Investments</Label>
              <p className="text-[11px] text-muted-foreground">Allow group to invest in external opportunities</p>
            </div>
          </div>
          {investmentEnabled && (
            <div>
              <Label>Investment Types</Label>
              <Select value={investmentTypes} onValueChange={setInvestmentTypes}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="money_market">Money Market Funds</SelectItem>
                  <SelectItem value="real_estate">Real Estate</SelectItem>
                  <SelectItem value="business">Business Ventures</SelectItem>
                  <SelectItem value="mixed">Mixed Portfolio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Switch checked={shareTransferAllowed} onCheckedChange={setShareTransferAllowed} />
            <div>
              <Label>Share Transfer</Label>
              <p className="text-[11px] text-muted-foreground">Allow members to transfer their shares to other members</p>
            </div>
          </div>
        </div>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
        <Save size={16} /> {saving ? 'Saving...' : 'Save All Settings'}
      </Button>
    </div>
  );
}
