import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  Send,
  Eye,
  Search,
  Shield,
  Loader2,
  BadgeCheck,
  Ban,
  Wallet,
  Smartphone,
  Pencil,
  ClipboardList,
  MessageSquare,
  ArrowDownLeft,
  PiggyBank,
  Crown,
  AlertTriangle,
  HandCoins,
  LogOut,
  DollarSign,
  Landmark,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  county: string;
  sub_county: string;
  ward: string;
  address: string;
  id_number: string;
  date_of_birth: string;
  is_active: boolean;
  is_verified: boolean;
  disable_reason: string | null;
  created_at: string;
}

interface UserDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

interface LoanApp {
  id: string;
  user_id: string;
  loan_type: string;
  applied_amount: number;
  generated_limit: number;
  employment_status: string;
  monthly_income: number;
  monthly_expenses: number;
  next_of_kin_name: string;
  next_of_kin_phone: string;
  number_of_dependents: number | null;
  existing_loans: boolean | null;
  existing_loan_amount: number | null;
  business_sector: string | null;
  education_level: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'disbursed';
  admin_message: string | null;
  created_at: string;
}

interface StkTransaction {
  id: string;
  user_id: string;
  phone: string;
  amount: number;
  reference: string;
  status: 'pending' | 'success' | 'failed';
  mpesa_receipt: string | null;
  merchant_request_id: string | null;
  checkout_request_id: string | null;
  result_code: string | null;
  result_desc: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditLog {
  id: string;
  admin_id: string | null;
  user_id: string | null;
  loan_id: string | null;
  action: string;
  details: any;
  created_at: string;
}

interface SupportMessage {
  id: string;
  user_id: string;
  sender_type: 'user' | 'admin';
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface AdminDashboardProps {
  defaultTab?: string;
}

export default function AdminDashboardPage({ defaultTab = 'users' }: AdminDashboardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tabRouteMap: Record<string, string> = {
    users: '/dashboard/admin/users',
    loans: '/dashboard/admin/loans',
    transactions: '/dashboard/admin/transactions',
    transfers: '/dashboard/admin/transfers',
    savings: '/dashboard/admin/savings',
    messages: '/dashboard/admin/messages',
    withdrawals: '/dashboard/admin/withdrawals',
    audit: '/dashboard/admin/audit',
    chama: '/dashboard/admin/chama',
    reports: '/dashboard/admin/reports',
    removals: '/dashboard/admin/removals',
  };
  const handleTabChange = useCallback((value: string) => {
    const route = tabRouteMap[value] || '/dashboard/admin';
    navigate(route, { replace: true });
  }, [navigate]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loans, setLoans] = useState<LoanApp[]>([]);
  const [transactions, setTransactions] = useState<StkTransaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [conversationUserId, setConversationUserId] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<StkTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [loanFilter, setLoanFilter] = useState<string>('all');
  const [userSearch, setUserSearch] = useState('');
  const [selectedLoan, setSelectedLoan] = useState<LoanApp | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminMsg, setAdminMsg] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');
  const [messageDialog, setMessageDialog] = useState<{ open: boolean; userId: string; name: string }>({ open: false, userId: '', name: '' });
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageType, setMessageType] = useState('general');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userDocs, setUserDocs] = useState<UserDocument[]>([]);
  const [userTransactions, setUserTransactions] = useState<StkTransaction[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [stkDialog, setStkDialog] = useState<{ open: boolean; userId: string; phone: string; name: string }>({ open: false, userId: '', phone: '', name: '' });
  const [stkAmount, setStkAmount] = useState('349');
  const [stkMessage, setStkMessage] = useState('');
  const [stkLoading, setStkLoading] = useState(false);
  const [togglingUser, setTogglingUser] = useState<string | null>(null);
  // Disable dialog
  const [disableDialog, setDisableDialog] = useState<{ open: boolean; profile: Profile | null }>({ open: false, profile: null });
  const [disableReason, setDisableReason] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  // Withdrawals
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any | null>(null);
  const [withdrawalStatus, setWithdrawalStatus] = useState('');
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  // Edit user dialog
  const [editDialog, setEditDialog] = useState<{ open: boolean; profile: Profile | null }>({ open: false, profile: null });
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [editLoading, setEditLoading] = useState(false);
  // Chama
  const [chamaGroups, setChamaGroups] = useState<any[]>([]);
  const [chamaWithdrawals, setChamaWithdrawals] = useState<any[]>([]);
  const [chamaMembers, setChamaMembers] = useState<any[]>([]);
  const [selectedChamaWd, setSelectedChamaWd] = useState<any | null>(null);
  const [chamaWdAction, setChamaWdAction] = useState('');
  const [chamaWdReason, setChamaWdReason] = useState('');
  const [chamaWdLoading, setChamaWdLoading] = useState(false);
  const [chamaWdDocRequest, setChamaWdDocRequest] = useState(false);
  const [chamaWdFeeAmount, setChamaWdFeeAmount] = useState('');
  // Enhanced withdrawal review (user + chama)
  const [wdDocRequest, setWdDocRequest] = useState(false);
  const [wdFeeAmount, setWdFeeAmount] = useState('');
  // Transaction reports
  const [txReports, setTxReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [reportResponse, setReportResponse] = useState('');
  const [reportStatus, setReportStatus] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  // Member removal requests
  const [removalRequests, setRemovalRequests] = useState<any[]>([]);
  const [selectedRemoval, setSelectedRemoval] = useState<any | null>(null);
  const [removalAction, setRemovalAction] = useState('');
  const [removalReason, setRemovalReason] = useState('');
  const [removalLoading, setRemovalLoading] = useState(false);
  // Wallet Transfers & Money Requests
  const [walletTransfers, setWalletTransfers] = useState<any[]>([]);
  const [moneyRequests, setMoneyRequests] = useState<any[]>([]);
  // Personal Savings
  const [personalSavings, setPersonalSavings] = useState<any[]>([]);
  const [savingsWithdrawals, setSavingsWithdrawals] = useState<any[]>([]);
  const [selectedSavingsWd, setSelectedSavingsWd] = useState<any | null>(null);
  const [savingsWdStatus, setSavingsWdStatus] = useState('');
  const [savingsWdReason, setSavingsWdReason] = useState('');
  const [savingsWdLoading, setSavingsWdLoading] = useState(false);
  // Chama Leave Requests & Loans
  const [chamaLeaveRequests, setChamaLeaveRequests] = useState<any[]>([]);
  const [chamaLoans, setChamaLoans] = useState<any[]>([]);
  const [selectedChamaLeave, setSelectedChamaLeave] = useState<any | null>(null);
  const [chamaLeaveAction, setChamaLeaveAction] = useState('');
  const [chamaLeaveReason, setChamaLeaveReason] = useState('');
  const [chamaLeaveLoading, setChamaLeaveLoading] = useState(false);
  // Additional data
  const [chamaHarambees, setChamaHarambees] = useState<any[]>([]);
  const [chamaSavings, setChamaSavings] = useState<any[]>([]);
  const [chamaPenalties, setChamaPenalties] = useState<any[]>([]);
  const [chamaJoiningFees, setChamaJoiningFees] = useState<any[]>([]);
  const [chamaPlatformFees, setChamaPlatformFees] = useState<any[]>([]);
  const [loanDisbursements, setLoanDisbursements] = useState<any[]>([]);
  const [savingsDeposits, setSavingsDeposits] = useState<any[]>([]);
  const [txSearch, setTxSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profilesRes, loansRes, txRes, auditRes, msgRes, wdRes, chamaGRes, chamaWdRes, chamaMRes, reportsRes, removalsRes, transfersRes, requestsRes, pSavingsRes, savWdRes, chamaLeaveRes, chamaLoansRes, harambeesRes, chamaSavRes, penaltiesRes, joiningFeesRes, platformFeesRes, disbursementsRes, depositsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('loan_applications').select('*').order('created_at', { ascending: false }),
        supabase.from('stk_transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('support_messages').select('*').order('created_at', { ascending: false }),
        supabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('chama_groups').select('*').order('created_at', { ascending: false }),
        supabase.from('chama_withdrawals').select('*').order('created_at', { ascending: false }),
        supabase.from('chama_members').select('*'),
        supabase.from('transaction_reports' as any).select('*').order('created_at', { ascending: false }),
        supabase.from('chama_member_removal_requests' as any).select('*').order('created_at', { ascending: false }),
        supabase.from('wallet_transfers').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('money_requests').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('personal_savings').select('*').order('created_at', { ascending: false }),
        supabase.from('savings_withdrawal_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('chama_leave_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('chama_loans').select('*').order('created_at', { ascending: false }),
        supabase.from('chama_harambees').select('*').order('created_at', { ascending: false }),
        supabase.from('chama_savings').select('*').order('created_at', { ascending: false }),
        supabase.from('chama_penalties').select('*').order('created_at', { ascending: false }),
        supabase.from('chama_joining_fees').select('*').order('created_at', { ascending: false }),
        supabase.from('chama_platform_fees').select('*').order('created_at', { ascending: false }),
        supabase.from('loan_disbursements').select('*').order('created_at', { ascending: false }),
        supabase.from('personal_savings_deposits').select('*').order('created_at', { ascending: false }),
      ]);
      if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
      if (loansRes.data) setLoans(loansRes.data as LoanApp[]);
      if (txRes.data) setTransactions(txRes.data as StkTransaction[]);
      if (auditRes.data) setAuditLogs(auditRes.data as AuditLog[]);
      if (msgRes.data) setSupportMessages(msgRes.data as SupportMessage[]);
      if (wdRes.data) setWithdrawalRequests(wdRes.data);
      if (chamaGRes.data) setChamaGroups(chamaGRes.data);
      if (chamaWdRes.data) setChamaWithdrawals(chamaWdRes.data);
      if (chamaMRes.data) setChamaMembers(chamaMRes.data);
      if (reportsRes.data) setTxReports(reportsRes.data);
      if (removalsRes.data) setRemovalRequests(removalsRes.data);
      if (transfersRes.data) setWalletTransfers(transfersRes.data);
      if (requestsRes.data) setMoneyRequests(requestsRes.data);
      if (pSavingsRes.data) setPersonalSavings(pSavingsRes.data);
      if (savWdRes.data) setSavingsWithdrawals(savWdRes.data);
      if (chamaLeaveRes.data) setChamaLeaveRequests(chamaLeaveRes.data);
      if (chamaLoansRes.data) setChamaLoans(chamaLoansRes.data);
      if (harambeesRes.data) setChamaHarambees(harambeesRes.data);
      if (chamaSavRes.data) setChamaSavings(chamaSavRes.data);
      if (penaltiesRes.data) setChamaPenalties(penaltiesRes.data);
      if (joiningFeesRes.data) setChamaJoiningFees(joiningFeesRes.data);
      if (platformFeesRes.data) setChamaPlatformFees(platformFeesRes.data);
      if (disbursementsRes.data) setLoanDisbursements(disbursementsRes.data);
      if (depositsRes.data) setSavingsDeposits(depositsRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ===== LOAN ACTIONS =====
  const handleLoanAction = async () => {
    if (!selectedLoan || !newStatus) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('loan_applications')
        .update({ status: newStatus as any, admin_message: adminMsg || null })
        .eq('id', selectedLoan.id);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        admin_id: user?.id,
        user_id: selectedLoan.user_id,
        loan_id: selectedLoan.id,
        action: `loan_${newStatus}`,
        details: { previous_status: selectedLoan.status, new_status: newStatus, message: adminMsg },
      });

      const shortLoanId = selectedLoan.id.slice(0, 8).toUpperCase();
      const statusLabel = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
      const reasonText = adminMsg ? ` Reason: ${adminMsg}` : '';
      await supabase.from('notifications').insert({
        user_id: selectedLoan.user_id,
        title: `Loan ${statusLabel}`,
        message: `Your loan ID #${shortLoanId} (${selectedLoan.loan_type.replace('_', ' ')} - ${formatCurrency(selectedLoan.applied_amount)}) has been ${newStatus}.${reasonText}`,
      });

      // If approved, credit wallet using server-side function
      if (newStatus === 'approved') {
        const { data: rpcResult, error: rpcErr } = await supabase.rpc('credit_wallet_on_loan_approval', {
          _user_id: selectedLoan.user_id,
          _loan_id: selectedLoan.id,
          _amount: selectedLoan.applied_amount,
          _interest_rate: 4.0,
        });
        if (rpcErr) {
          console.error('Wallet credit RPC failed:', rpcErr);
          toast.error('Loan approved but wallet credit failed: ' + rpcErr.message);
        } else {
          console.log('Wallet credited via RPC:', rpcResult);
        }
      }

      // Send SMS notification for loan status change
      const loanUserProfile = profiles.find(p => p.user_id === selectedLoan.user_id);
      if (loanUserProfile?.phone) {
        const smsMessage = newStatus === 'approved'
          ? `Dear ${loanUserProfile.full_name}, your loan of KES ${selectedLoan.applied_amount.toLocaleString()} has been approved and credited to your wallet. Log in to access your funds.`
          : newStatus === 'rejected'
          ? `Dear ${loanUserProfile.full_name}, your loan application for KES ${selectedLoan.applied_amount.toLocaleString()} was not approved.${adminMsg ? ' Reason: ' + adminMsg : ''} Contact support for assistance.`
          : `Dear ${loanUserProfile.full_name}, your loan status has been updated to ${newStatus}. Log in for details.`;
        
        supabase.functions.invoke('send-sms', {
          body: { phone: loanUserProfile.phone, message: smsMessage },
        }).catch(err => console.error('SMS send failed:', err));
      }

      toast.success(`Loan ${newStatus} successfully`);
      setSelectedLoan(null);
      setAdminMsg('');
      setNewStatus('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ===== DISABLE ACCOUNT WITH REASON =====
  const handleDisableAccount = async () => {
    if (!disableDialog.profile || !disableReason.trim()) return;
    setDisableLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false, disable_reason: disableReason.trim() })
        .eq('user_id', disableDialog.profile.user_id);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        admin_id: user?.id,
        user_id: disableDialog.profile.user_id,
        action: 'account_disabled',
        details: { full_name: disableDialog.profile.full_name, reason: disableReason },
      });

      await supabase.from('notifications').insert({
        user_id: disableDialog.profile.user_id,
        title: 'Account Disabled',
        message: `Your account has been disabled. Reason: ${disableReason}`,
      });

      toast.success(`${disableDialog.profile.full_name}'s account disabled`);
      setProfiles((prev) => prev.map((p) => p.user_id === disableDialog.profile!.user_id ? { ...p, is_active: false, disable_reason: disableReason } : p));
      if (selectedUser?.user_id === disableDialog.profile.user_id) {
        setSelectedUser({ ...selectedUser, is_active: false, disable_reason: disableReason });
      }
      setDisableDialog({ open: false, profile: null });
      setDisableReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to disable account');
    } finally {
      setDisableLoading(false);
    }
  };

  // ===== ACTIVATE ACCOUNT =====
  const handleActivateAccount = async (profile: Profile) => {
    setTogglingUser(profile.user_id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: true, disable_reason: null })
        .eq('user_id', profile.user_id);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        admin_id: user?.id,
        user_id: profile.user_id,
        action: 'account_activated',
        details: { full_name: profile.full_name },
      });

      await supabase.from('notifications').insert({
        user_id: profile.user_id,
        title: 'Account Activated',
        message: 'Your account has been activated. You can now access all features.',
      });

      toast.success(`${profile.full_name} activated`);
      setProfiles((prev) => prev.map((p) => p.user_id === profile.user_id ? { ...p, is_active: true, disable_reason: null } : p));
      if (selectedUser?.user_id === profile.user_id) {
        setSelectedUser({ ...selectedUser, is_active: true, disable_reason: null });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally {
      setTogglingUser(null);
    }
  };

  const handleToggleVerified = async (profile: Profile) => {
    setTogglingUser(profile.user_id);
    try {
      const newVerified = !profile.is_verified;
      const { error } = await supabase.from('profiles').update({ is_verified: newVerified }).eq('user_id', profile.user_id);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        admin_id: user?.id,
        user_id: profile.user_id,
        action: newVerified ? 'user_verified' : 'user_unverified',
        details: { full_name: profile.full_name },
      });

      toast.success(`${profile.full_name} ${newVerified ? 'verified' : 'unverified'}`);
      setProfiles((prev) => prev.map((p) => p.user_id === profile.user_id ? { ...p, is_verified: newVerified } : p));
      if (selectedUser?.user_id === profile.user_id) {
        setSelectedUser({ ...selectedUser, is_verified: newVerified });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally {
      setTogglingUser(null);
    }
  };

  // ===== EDIT USER =====
  const openEditDialog = (profile: Profile) => {
    setEditForm({
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      id_number: profile.id_number,
      date_of_birth: profile.date_of_birth,
      county: profile.county,
      sub_county: profile.sub_county,
      ward: profile.ward,
      address: profile.address,
    });
    setEditDialog({ open: true, profile });
  };

  const handleEditUser = async () => {
    if (!editDialog.profile) return;
    setEditLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          email: editForm.email,
          phone: editForm.phone,
          id_number: editForm.id_number,
          date_of_birth: editForm.date_of_birth,
          county: editForm.county,
          sub_county: editForm.sub_county,
          ward: editForm.ward,
          address: editForm.address,
        })
        .eq('user_id', editDialog.profile.user_id);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        admin_id: user?.id,
        user_id: editDialog.profile.user_id,
        action: 'profile_edited_by_admin',
        details: { full_name: editForm.full_name },
      });

      toast.success('Profile updated successfully');
      setProfiles((prev) => prev.map((p) => p.user_id === editDialog.profile!.user_id ? { ...p, ...editForm } as Profile : p));
      if (selectedUser?.user_id === editDialog.profile.user_id) {
        setSelectedUser({ ...selectedUser, ...editForm } as Profile);
      }
      setEditDialog({ open: false, profile: null });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setEditLoading(false);
    }
  };

  // ===== STK PUSH =====
  const handleInitiateStk = async () => {
    if (!stkDialog.userId || !stkAmount) return;
    setStkLoading(true);
    try {
      // Send notification/message to user first
      const msgText = stkMessage.trim() || `You will receive an M-Pesa payment prompt of KES ${stkAmount}. Please enter your PIN to complete the transaction.`;
      
      await supabase.from('notifications').insert({
        user_id: stkDialog.userId,
        title: '📱 Payment Request Incoming',
        message: msgText,
      });

      await supabase.from('admin_messages').insert({
        admin_id: user?.id,
        user_id: stkDialog.userId,
        message: msgText,
      });

      // Then initiate STK push
      const { data, error } = await supabase.functions.invoke('initiate-stk-push', {
        body: { phone: stkDialog.phone, amount: Number(stkAmount), userId: stkDialog.userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Message sent & STK push sent to ${stkDialog.phone}`);
      setStkDialog({ open: false, userId: '', phone: '', name: '' });
      setStkAmount('349');
      setStkMessage('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'STK push failed');
    } finally {
      setStkLoading(false);
    }
  };

  // ===== SEND MESSAGE =====
  const handleSendMessage = async () => {
    if (!messageText.trim() || !messageDialog.userId) return;
    setSendingMessage(true);
    try {
      await supabase.from('admin_messages').insert({
        admin_id: user?.id,
        user_id: messageDialog.userId,
        message: messageText,
      });

      const notifTitle = messageType === 'document_request' ? '📄 Document Request' : 'Message from Admin';
      const notifMessage = messageType === 'document_request'
        ? `[DOCUMENT_REQUEST] ${messageText}`
        : messageText;

      await supabase.from('notifications').insert({
        user_id: messageDialog.userId,
        title: notifTitle,
        message: notifMessage,
      });
      toast.success(messageType === 'document_request' ? 'Document request sent' : 'Message sent');
      setMessageDialog({ open: false, userId: '', name: '' });
      setMessageText('');
      setMessageType('general');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed');
    } finally {
      setSendingMessage(false);
    }
  };

  // ===== OPEN CONVERSATION =====
  const openConversation = async (userId: string) => {
    setConversationUserId(userId);
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    setConversationMessages((data as SupportMessage[]) || []);
    // Mark user messages as read
    await supabase
      .from('support_messages')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('sender_type', 'user')
      .eq('is_read', false);
  };

  const handleReply = async () => {
    if (!replyText.trim() || !conversationUserId || !user) return;
    setReplyLoading(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        user_id: conversationUserId,
        sender_type: 'admin',
        sender_id: user.id,
        message: replyText.trim(),
      });
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: conversationUserId,
        title: 'Reply from Support',
        message: replyText.trim(),
      });

      setConversationMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          user_id: conversationUserId,
          sender_type: 'admin' as const,
          sender_id: user.id,
          message: replyText.trim(),
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ]);
      setReplyText('');
      toast.success('Reply sent');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reply');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleViewUser = async (profile: Profile) => {
    setSelectedUser(profile);
    setDocsLoading(true);
    const [docsRes, txRes] = await Promise.all([
      supabase.from('user_documents').select('*').eq('user_id', profile.user_id).order('created_at', { ascending: false }),
      supabase.from('stk_transactions').select('*').eq('user_id', profile.user_id).order('created_at', { ascending: false }),
    ]);
    setUserDocs((docsRes.data as UserDocument[]) || []);
    setUserTransactions((txRes.data as StkTransaction[]) || []);
    setDocsLoading(false);
  };

  // Document review dialog state
  const [docReviewDialog, setDocReviewDialog] = useState<{ open: boolean; docId: string; docType: string; status: string; userId: string }>({ open: false, docId: '', docType: '', status: '', userId: '' });
  const [docReviewReason, setDocReviewReason] = useState('');
  const [docReviewLoading, setDocReviewLoading] = useState(false);

  const handleDocStatus = async () => {
    if (!docReviewDialog.docId) return;
    setDocReviewLoading(true);
    try {
      const { error } = await supabase.from('user_documents').update({ status: docReviewDialog.status, admin_notes: docReviewReason || null }).eq('id', docReviewDialog.docId);
      if (error) throw error;
      setUserDocs((prev) => prev.map((d) => d.id === docReviewDialog.docId ? { ...d, status: docReviewDialog.status, admin_notes: docReviewReason || null } : d));

      // Notify the user
      const statusLabel = docReviewDialog.status === 'approved' ? 'Approved' : 'Rejected';
      const reasonText = docReviewReason ? ` Reason: ${docReviewReason}` : '';
      await supabase.from('notifications').insert({
        user_id: docReviewDialog.userId,
        title: `Document ${statusLabel}`,
        message: `Your ${docReviewDialog.docType.replace(/_/g, ' ')} document has been ${docReviewDialog.status}.${reasonText}`,
      });

      toast.success(`Document ${docReviewDialog.status}`);
      setDocReviewDialog({ open: false, docId: '', docType: '', status: '', userId: '' });
      setDocReviewReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally {
      setDocReviewLoading(false);
    }
  };

  const getDocSignedUrl = async (filePath: string) => {
    const { data } = await supabase.storage.from('user-documents').createSignedUrl(filePath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

  const filteredLoans = loans.filter((l) => loanFilter === 'all' || l.status === loanFilter);

  const filteredUsers = profiles.filter(
    (p) =>
      userSearch === '' ||
      p.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      p.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      p.phone.includes(userSearch) ||
      p.id_number.includes(userSearch)
  );

  const totalChamaSavings = chamaSavings.reduce((s: number, c: any) => s + (c.amount || 0), 0);

  const filteredTransactions = transactions.filter((tx) => {
    if (!txSearch) return true;
    const q = txSearch.toLowerCase();
    return (
      tx.id.toLowerCase().includes(q) ||
      tx.phone.includes(q) ||
      (tx.mpesa_receipt || '').toLowerCase().includes(q) ||
      (tx.reference || '').toLowerCase().includes(q) ||
      getUserName(tx.user_id).toLowerCase().includes(q)
    );
  });
  const totalPlatformFees = chamaPlatformFees.reduce((s: number, f: any) => s + (f.amount || 0), 0);
  const totalJoiningFees = chamaJoiningFees.reduce((s: number, f: any) => s + (f.amount || 0), 0);
  const totalPersonalSaved = personalSavings.reduce((s: number, p: any) => s + (p.saved_amount || 0), 0);

  const stats = {
    totalUsers: profiles.length,
    activeUsers: profiles.filter((p) => p.is_active).length,
    pending: loans.filter((l) => l.status === 'pending').length,
    totalRevenue: transactions.filter((t) => t.status === 'success').reduce((s, t) => s + t.amount, 0),
    chamaGroups: chamaGroups.length,
    chamaSavings: totalChamaSavings,
    platformFees: totalPlatformFees + totalJoiningFees,
    personalSavings: totalPersonalSaved,
    activeDisbursements: loanDisbursements.filter((d: any) => d.status === 'active').length,
    pendingHarambees: chamaHarambees.filter((h: any) => h.status === 'active').length,
    unpaidPenalties: chamaPenalties.filter((p: any) => p.status === 'unpaid').length,
  };

  const getUserName = (userId: string) => profiles.find((pr) => pr.user_id === userId)?.full_name || 'Unknown';
  const getUserPhone = (userId: string) => profiles.find((pr) => pr.user_id === userId)?.phone || '';

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-4 lg:p-8 space-y-6 max-w-[1200px] mx-auto">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="border-border/50"><CardContent className="p-4 lg:p-5"><Skeleton className="w-10 h-10 rounded-xl mb-3" /><Skeleton className="h-7 w-16 mb-1" /><Skeleton className="h-3 w-24" /></CardContent></Card>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 lg:p-8 space-y-5 max-w-[1200px] mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={20} className="text-accent" />
            <h1 className="font-display text-xl lg:text-2xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
          <p className="text-xs lg:text-sm text-muted-foreground">Full control over users, loans, transactions, and communications</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
          {[
            { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Active Users', value: stats.activeUsers, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
            { label: 'Pending Loans', value: stats.pending, icon: Clock, color: 'text-accent', bg: 'bg-accent/10' },
            { label: 'M-Pesa Revenue', value: formatCurrency(stats.totalRevenue), icon: Wallet, color: 'text-success', bg: 'bg-success/10' },
            { label: 'Chama Groups', value: stats.chamaGroups, icon: Crown, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Chama Savings', value: formatCurrency(stats.chamaSavings), icon: PiggyBank, color: 'text-accent', bg: 'bg-accent/10' },
            { label: 'Platform Fees', value: formatCurrency(stats.platformFees), icon: DollarSign, color: 'text-success', bg: 'bg-success/10' },
            { label: 'Personal Savings', value: formatCurrency(stats.personalSavings), icon: Landmark, color: 'text-primary', bg: 'bg-primary/10' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
              <Card className="border-border/50">
                <CardContent className="p-3 lg:p-5">
                  <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-2 lg:mb-3`}>
                    <stat.icon className={stat.color} size={18} />
                  </div>
                  <p className="text-lg lg:text-2xl font-bold font-display">{stat.value}</p>
                  <p className="text-[10px] lg:text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={defaultTab} onValueChange={handleTabChange} className="space-y-4">
          <div className="overflow-x-auto no-scrollbar">
            <TabsList className="inline-flex w-auto h-auto p-1 gap-1 flex-wrap">
              {([
                { value: 'users', icon: Users, label: 'Users' },
                { value: 'loans', icon: FileText, label: 'Loans' },
                { value: 'transactions', icon: Wallet, label: 'M-Pesa' },
                { value: 'transfers', icon: Send, label: 'Transfers' },
                { value: 'savings', icon: PiggyBank, label: 'Savings' },
                { value: 'messages', icon: MessageSquare, label: 'Msgs' },
                { value: 'audit', icon: ClipboardList, label: 'Audit' },
                { value: 'withdrawals', icon: DollarSign, label: 'W/draw' },
                { value: 'chama', icon: Crown, label: 'Chama' },
                { value: 'reports', icon: AlertTriangle, label: 'Reports' },
                { value: 'removals', icon: Ban, label: 'Removals' },
              ] as const).map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  title={tab.label}
                  className="flex flex-col items-center gap-1 text-[11px] py-2 px-3 min-w-[60px]"
                >
                  <tab.icon size={22} className="shrink-0" />
                  <span className="truncate leading-tight">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* ===== USERS TAB ===== */}
          <TabsContent value="users" className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search name, email, phone, ID..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-9 h-9 text-sm" />
              </div>
              <div className="text-xs text-muted-foreground shrink-0">
                {filteredUsers.length} of {profiles.length}
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <EmptyState icon={Users} title="No Users Found" description="No users match your search." />
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((p, i) => (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 * i }}>
                    <Card
                      className="border-border/50 hover:border-accent/30 transition-all cursor-pointer"
                      onClick={() => handleViewUser(p)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className={cn(
                            'w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0',
                            p.is_active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            {p.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-sm truncate">{p.full_name}</p>
                              {p.is_verified && <BadgeCheck size={14} className="text-primary shrink-0" />}
                              <StatusBadge status={p.is_active ? 'active' : 'inactive'} />
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{p.phone} • {p.id_number}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{p.email}</p>
                            {!p.is_active && p.disable_reason && (
                              <p className="text-[10px] text-destructive mt-0.5 truncate">Reason: {p.disable_reason}</p>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="flex flex-col gap-1 shrink-0">
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); openEditDialog(p); }} title="Edit">
                                <Pencil size={12} />
                              </Button>
                              {p.is_active ? (
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive border-destructive/30" onClick={(e) => { e.stopPropagation(); setDisableDialog({ open: true, profile: p }); setDisableReason(''); }} title="Disable">
                                  <Ban size={12} />
                                </Button>
                              ) : (
                                <Button size="sm" className="h-7 w-7 p-0 bg-success hover:bg-success/90 text-success-foreground" onClick={(e) => { e.stopPropagation(); handleActivateAccount(p); }} disabled={togglingUser === p.user_id} title="Activate">
                                  {togglingUser === p.user_id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                </Button>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setStkDialog({ open: true, userId: p.user_id, phone: p.phone, name: p.full_name }); }} title="STK Push">
                                <Smartphone size={12} />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setMessageDialog({ open: true, userId: p.user_id, name: p.full_name }); }} title="Message">
                                <Send size={12} />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Footer meta */}
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/30">
                          <span className="text-[10px] text-muted-foreground">{p.county}, {p.sub_county}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">Joined {new Date(p.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== LOANS TAB ===== */}
          <TabsContent value="loans" className="space-y-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {['all', 'pending', 'approved', 'rejected', 'disbursed'].map((f) => (
                <button key={f} onClick={() => setLoanFilter(f)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all capitalize',
                    loanFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}>
                  {f} ({f === 'all' ? loans.length : loans.filter((l) => l.status === f).length})
                </button>
              ))}
            </div>

            {filteredLoans.length === 0 ? (
              <EmptyState icon={FileText} title="No Loans Found" description="No loan applications match your filter." />
            ) : (
              <div className="space-y-2">
                {filteredLoans.map((loan, i) => (
                  <motion.div key={loan.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 * i }}>
                    <Card className="border-border/50 hover:border-accent/20 transition-all">
                      <CardContent className="p-3 lg:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <CreditCard className="text-primary" size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm capitalize">{loan.loan_type.replace('_', ' ')} Loan</p>
                              <p className="text-xs text-muted-foreground truncate">{getUserName(loan.user_id)} • {getUserPhone(loan.user_id)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={loan.status} />
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setSelectedLoan(loan); setNewStatus(''); setAdminMsg(''); }}>
                              {loan.status === 'pending' ? 'Review' : 'Update'}
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-sm mt-3">
                          <div><p className="text-[10px] text-muted-foreground uppercase">Applied</p><p className="font-bold text-xs">{formatCurrency(loan.applied_amount)}</p></div>
                          <div><p className="text-[10px] text-muted-foreground uppercase">Limit</p><p className="font-bold text-xs">{formatCurrency(loan.generated_limit)}</p></div>
                          <div><p className="text-[10px] text-muted-foreground uppercase">Income</p><p className="font-medium text-xs">{formatCurrency(loan.monthly_income)}</p></div>
                          <div className="hidden sm:block"><p className="text-[10px] text-muted-foreground uppercase">Expenses</p><p className="font-medium text-xs">{formatCurrency(loan.monthly_expenses)}</p></div>
                          <div className="hidden sm:block"><p className="text-[10px] text-muted-foreground uppercase">Date</p><p className="font-medium text-xs">{new Date(loan.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}</p></div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Loan Disbursements */}
            <div className="mt-4">
              <h3 className="text-sm font-bold mb-2">Active Disbursements ({loanDisbursements.filter((d: any) => d.status === 'active').length})</h3>
              {loanDisbursements.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No disbursements yet</p>
              ) : (
                <div className="space-y-2">
                  {loanDisbursements.map((d: any) => (
                    <Card key={d.id} className="border-border/50">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                              d.status === 'active' ? 'bg-accent/10' : d.status === 'paid' ? 'bg-success/10' : 'bg-muted'
                            )}>
                              <Landmark size={14} className={d.status === 'active' ? 'text-accent' : d.status === 'paid' ? 'text-success' : 'text-muted-foreground'} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{getUserName(d.user_id)}</p>
                              <p className="text-[11px] text-muted-foreground">
                                Disbursed: {formatCurrency(d.disbursed_amount)} • Balance: {formatCurrency(d.outstanding_balance)} • {d.interest_rate}%
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Monthly: {formatCurrency(d.monthly_repayment)} • Due: {new Date(d.repayment_due_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full uppercase shrink-0',
                            d.status === 'active' && 'bg-accent/10 text-accent',
                            d.status === 'paid' && 'bg-success/10 text-success',
                            d.status === 'defaulted' && 'bg-destructive/10 text-destructive',
                          )}>{d.status}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== TRANSACTIONS TAB ===== */}
          <TabsContent value="transactions" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
              <p className="text-xs text-muted-foreground flex-1">
                Total: <span className="font-bold text-foreground">{formatCurrency(stats.totalRevenue)}</span> from {transactions.filter(t => t.status === 'success').length} successful payments
              </p>
              <div className="relative sm:max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search ID, receipt, phone, reference..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
            {filteredTransactions.length === 0 ? (
              <EmptyState icon={Wallet} title="No Transactions" description="No payment transactions match your search." />
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map((tx, i) => (
                  <motion.div key={tx.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 * Math.min(i, 20) }}>
                    <Card className="border-border/50 cursor-pointer hover:border-accent/20 transition-all" onClick={() => setSelectedTransaction(tx)}>
                      <CardContent className="p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                            tx.status === 'success' ? 'bg-success/10' : tx.status === 'failed' ? 'bg-destructive/10' : 'bg-accent/10'
                          )}>
                            {tx.status === 'success' ? <CheckCircle size={14} className="text-success" /> : tx.status === 'failed' ? <XCircle size={14} className="text-destructive" /> : <Clock size={14} className="text-accent" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{getUserName(tx.user_id)}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{tx.phone} • {tx.reference}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm">{formatCurrency(tx.amount)}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}</p>
                          {tx.mpesa_receipt && <p className="text-[10px] text-success font-mono">{tx.mpesa_receipt}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== MESSAGES TAB ===== */}
          <TabsContent value="messages" className="space-y-3">
            {(() => {
              // Group support messages by user_id
              const convos = new Map<string, { lastMsg: SupportMessage; unread: number }>();
              supportMessages.forEach((msg) => {
                const existing = convos.get(msg.user_id);
                const isUnread = msg.sender_type === 'user' && !msg.is_read;
                if (!existing || new Date(msg.created_at) > new Date(existing.lastMsg.created_at)) {
                  convos.set(msg.user_id, {
                    lastMsg: msg,
                    unread: (existing?.unread || 0) + (isUnread ? 1 : 0),
                  });
                } else {
                  if (isUnread) convos.set(msg.user_id, { ...existing, unread: existing.unread + 1 });
                }
              });
              const convoList = Array.from(convos.entries()).sort(
                (a, b) => new Date(b[1].lastMsg.created_at).getTime() - new Date(a[1].lastMsg.created_at).getTime()
              );

              if (convoList.length === 0) {
                return <EmptyState icon={MessageSquare} title="No Conversations" description="No user messages yet." />;
              }

              return (
                <div className="space-y-2">
                  {convoList.map(([userId, { lastMsg, unread }]) => (
                    <Card key={userId} className="border-border/50 cursor-pointer hover:border-accent/20 transition-all" onClick={() => openConversation(userId)}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                              <MessageSquare size={14} className="text-accent" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold truncate">{getUserName(userId)}</p>
                                {unread > 0 && <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">{unread}</span>}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{lastMsg.sender_type === 'admin' ? 'You: ' : ''}{lastMsg.message}</p>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground shrink-0">{new Date(lastMsg.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()}
          </TabsContent>

          {/* ===== AUDIT LOGS TAB ===== */}
          <TabsContent value="audit" className="space-y-3">
            <p className="text-xs text-muted-foreground">{auditLogs.length} audit entries</p>
            {auditLogs.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No Audit Logs" description="No admin actions recorded yet." />
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <Card key={log.id} className="border-border/50">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium capitalize">{log.action.replace(/_/g, ' ')}</p>
                          {log.user_id && <p className="text-xs text-muted-foreground">User: {getUserName(log.user_id)}</p>}
                          {log.details && typeof log.details === 'object' && (
                            <div className="mt-1 text-[11px] text-muted-foreground space-x-2">
                              {(log.details as any).reason && <span>Reason: {(log.details as any).reason}</span>}
                              {(log.details as any).new_status && <span>→ {(log.details as any).new_status}</span>}
                              {(log.details as any).message && <span>Msg: {(log.details as any).message}</span>}
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground shrink-0">{new Date(log.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== WITHDRAWALS TAB ===== */}
          <TabsContent value="withdrawals" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {withdrawalRequests.filter((w: any) => w.status === 'pending').length} pending withdrawal requests
            </p>
            {withdrawalRequests.length === 0 ? (
              <EmptyState icon={Send} title="No Withdrawals" description="No withdrawal requests yet." />
            ) : (
              <div className="space-y-2">
                {withdrawalRequests.map((wd: any, i: number) => (
                  <motion.div key={wd.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 * i }}>
                    <Card className="border-border/50 hover:border-accent/20 transition-all">
                      <CardContent className="p-3 lg:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                              wd.status === 'completed' ? 'bg-success/10' : wd.status === 'rejected' ? 'bg-destructive/10' : 'bg-accent/10'
                            )}>
                              <ArrowDownLeft size={18} className={
                                wd.status === 'completed' ? 'text-success' : wd.status === 'rejected' ? 'text-destructive' : 'text-accent'
                              } />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm">{getUserName(wd.user_id)}</p>
                              <p className="text-xs text-muted-foreground">{wd.phone} • {formatCurrency(wd.amount)}</p>
                              <p className="text-[10px] text-muted-foreground">{new Date(wd.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                              {wd.admin_reason && <p className="text-[10px] text-muted-foreground/80 italic mt-0.5">"{wd.admin_reason}"</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full uppercase',
                              wd.status === 'completed' && 'bg-success/10 text-success',
                              wd.status === 'rejected' && 'bg-destructive/10 text-destructive',
                              wd.status === 'approved' && 'bg-primary/10 text-primary',
                              wd.status === 'pending' && 'bg-accent/10 text-accent',
                            )}>{wd.status}</span>
                            {(wd.status === 'pending' || wd.status === 'approved') && (
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                                setSelectedWithdrawal(wd);
                                setWithdrawalStatus('');
                                setWithdrawalReason('');
                              }}>
                                Review
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== CHAMA TAB ===== */}
          <TabsContent value="chama" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {chamaGroups.length} groups • {chamaWithdrawals.filter((w: any) => w.status === 'approved_by_leaders').length} withdrawals pending admin approval
            </p>

            {/* Chama Groups */}
            <div>
              <h3 className="text-sm font-bold mb-2">All Groups</h3>
              {chamaGroups.length === 0 ? (
                <EmptyState icon={Users} title="No Chama Groups" description="No groups created yet." />
              ) : (
                <div className="space-y-2">
                  {chamaGroups.map((g: any) => {
                    const groupMembers = chamaMembers.filter((m: any) => m.group_id === g.id);
                    const totalSavings = 0; // Would need separate query
                    return (
                      <Card key={g.id} className="border-border/50">
                        <CardContent className="p-3 lg:p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Users size={18} className="text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm">{g.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {groupMembers.length} members • {g.savings_frequency || 'monthly'} savings
                                  {g.savings_amount ? ` • KES ${g.savings_amount.toLocaleString()}` : ''}
                                </p>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {groupMembers.filter((m: any) => ['chairperson', 'secretary', 'treasurer'].includes(m.role)).map((m: any) => (
                                    <span key={m.id} className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                                      {m.role === 'chairperson' && <Crown size={8} className="inline mr-0.5" />}
                                      {getUserName(m.user_id)} ({m.role})
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(g.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chama Withdrawals */}
            <div>
              <h3 className="text-sm font-bold mb-2">Chama Withdrawal Requests</h3>
              {chamaWithdrawals.length === 0 ? (
                <EmptyState icon={Send} title="No Chama Withdrawals" description="No withdrawal requests from groups." />
              ) : (
                <div className="space-y-2">
                  {chamaWithdrawals.map((wd: any) => {
                    const group = chamaGroups.find((g: any) => g.id === wd.group_id);
                    return (
                      <Card key={wd.id} className="border-border/50 hover:border-accent/20 transition-all">
                        <CardContent className="p-3 lg:p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                                wd.status === 'disbursed' ? 'bg-success/10' : wd.status === 'rejected' ? 'bg-destructive/10' : wd.status === 'approved_by_leaders' ? 'bg-blue-500/10' : 'bg-accent/10'
                              )}>
                                <ArrowDownLeft size={18} className={
                                  wd.status === 'disbursed' ? 'text-success' : wd.status === 'rejected' ? 'text-destructive' : wd.status === 'approved_by_leaders' ? 'text-blue-500' : 'text-accent'
                                } />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm">{group?.name || 'Unknown Group'}</p>
                                <p className="text-xs text-muted-foreground">
                                  Requested by {getUserName(wd.requested_by)} • {wd.phone} • {formatCurrency(wd.amount)}
                                </p>
                                {wd.reason && <p className="text-[10px] text-muted-foreground italic mt-0.5">"{wd.reason}"</p>}
                                {wd.admin_reason && <p className="text-[10px] text-muted-foreground/80 mt-0.5">Admin: {wd.admin_reason}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full uppercase',
                                wd.status === 'approved_by_leaders' && 'bg-blue-500/10 text-blue-500',
                                wd.status === 'approved' && 'bg-primary/10 text-primary',
                                wd.status === 'disbursed' && 'bg-success/10 text-success',
                                wd.status === 'rejected' && 'bg-destructive/10 text-destructive',
                                wd.status === 'pending_leaders' && 'bg-accent/10 text-accent',
                              )}>
                                {wd.status === 'approved_by_leaders' ? 'Awaiting Admin' : wd.status === 'pending_leaders' ? 'Pending Leaders' : wd.status}
                              </span>
                              {wd.status === 'approved_by_leaders' && (
                                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                                  setSelectedChamaWd(wd);
                                  setChamaWdAction('');
                                  setChamaWdReason('');
                                  setChamaWdDocRequest(false);
                                  setChamaWdFeeAmount('');
                                }}>
                                  Review
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chama Leave Requests */}
            <div>
              <h3 className="text-sm font-bold mb-2">Leave Requests ({chamaLeaveRequests.filter((r: any) => r.admin_status === 'pending').length} pending)</h3>
              {chamaLeaveRequests.length === 0 ? (
                <EmptyState icon={LogOut} title="No Leave Requests" description="No leave requests from chama members." />
              ) : (
                <div className="space-y-2">
                  {chamaLeaveRequests.map((lr: any) => {
                    const group = chamaGroups.find((g: any) => g.id === lr.group_id);
                    return (
                      <Card key={lr.id} className={cn('border-border/50 hover:border-accent/20 transition-all', lr.admin_status === 'pending' && lr.chairperson_decision === 'approved' && 'border-accent/30')}>
                        <CardContent className="p-3 lg:p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                                lr.admin_status === 'approved' ? 'bg-success/10' : lr.admin_status === 'rejected' ? 'bg-destructive/10' : 'bg-accent/10'
                              )}>
                                <LogOut size={18} className={
                                  lr.admin_status === 'approved' ? 'text-success' : lr.admin_status === 'rejected' ? 'text-destructive' : 'text-accent'
                                } />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm">{getUserName(lr.user_id)}</p>
                                <p className="text-xs text-muted-foreground">Group: {group?.name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">Chair: {lr.chairperson_decision} • Refund: {formatCurrency(lr.refund_amount || 0)}</p>
                                {lr.reason && <p className="text-[10px] text-muted-foreground italic mt-0.5">"{lr.reason}"</p>}
                                {lr.admin_reason && <p className="text-[10px] text-muted-foreground/80 mt-0.5">Admin: {lr.admin_reason}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full uppercase',
                                lr.admin_status === 'approved' && 'bg-success/10 text-success',
                                lr.admin_status === 'rejected' && 'bg-destructive/10 text-destructive',
                                lr.admin_status === 'pending' && 'bg-accent/10 text-accent',
                              )}>{lr.chairperson_decision === 'approved' && lr.admin_status === 'pending' ? 'Awaiting Admin' : lr.admin_status}</span>
                              {lr.chairperson_decision === 'approved' && lr.admin_status === 'pending' && (
                                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                                  setSelectedChamaLeave(lr);
                                  setChamaLeaveAction('');
                                  setChamaLeaveReason('');
                                }}>
                                  Review
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chama Loans */}
            <div>
              <h3 className="text-sm font-bold mb-2">Chama Loans ({chamaLoans.length})</h3>
              {chamaLoans.length === 0 ? (
                <EmptyState icon={Landmark} title="No Chama Loans" description="No chama loan applications yet." />
              ) : (
                <div className="space-y-2">
                  {chamaLoans.map((loan: any) => {
                    const group = chamaGroups.find((g: any) => g.id === loan.group_id);
                    return (
                      <Card key={loan.id} className="border-border/50">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                                loan.status === 'disbursed' ? 'bg-success/10' : loan.status === 'rejected' ? 'bg-destructive/10' : 'bg-accent/10'
                              )}>
                                <Landmark size={14} className={
                                  loan.status === 'disbursed' ? 'text-success' : loan.status === 'rejected' ? 'text-destructive' : 'text-accent'
                                } />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{getUserName(loan.borrower_id)} — {group?.name || 'Unknown'}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {formatCurrency(loan.amount)} • {loan.interest_rate}% • {loan.duration_months}mo • Repay: {formatCurrency(loan.total_repayment)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  Chair: {loan.chairperson_decision || 'pending'} • {new Date(loan.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                                </p>
                              </div>
                            </div>
                            <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full uppercase shrink-0',
                              loan.status === 'approved' && 'bg-success/10 text-success',
                              loan.status === 'disbursed' && 'bg-primary/10 text-primary',
                              loan.status === 'rejected' && 'bg-destructive/10 text-destructive',
                              loan.status === 'pending' && 'bg-accent/10 text-accent',
                            )}>{loan.status}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chama Savings Overview */}
            <div>
              <h3 className="text-sm font-bold mb-2">Chama Savings ({formatCurrency(totalChamaSavings)})</h3>
              {chamaGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No groups</p>
              ) : (
                <div className="space-y-2">
                  {chamaGroups.map((g: any) => {
                    const groupSavings = chamaSavings.filter((s: any) => s.group_id === g.id);
                    const total = groupSavings.reduce((s: number, c: any) => s + (c.amount || 0), 0);
                    const contributors = new Set(groupSavings.map((s: any) => s.user_id)).size;
                    if (total === 0) return null;
                    return (
                      <div key={g.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30">
                        <div>
                          <p className="text-sm font-medium">{g.name}</p>
                          <p className="text-[10px] text-muted-foreground">{contributors} contributors • {groupSavings.length} deposits</p>
                        </div>
                        <p className="font-bold text-sm">{formatCurrency(total)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Harambees */}
            <div>
              <h3 className="text-sm font-bold mb-2">Harambees ({chamaHarambees.length})</h3>
              {chamaHarambees.length === 0 ? (
                <EmptyState icon={HandCoins} title="No Harambees" description="No harambee campaigns created yet." />
              ) : (
                <div className="space-y-2">
                  {chamaHarambees.map((h: any) => {
                    const group = chamaGroups.find((g: any) => g.id === h.group_id);
                    const progress = h.target_amount > 0 ? Math.min(100, (h.collected_amount / h.target_amount) * 100) : 0;
                    return (
                      <Card key={h.id} className="border-border/50">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{h.beneficiary_name}</p>
                              <p className="text-xs text-muted-foreground">{group?.name || 'Unknown'} • {h.reason}</p>
                              <p className="text-[11px] text-muted-foreground">Order: {h.order_number} • {h.is_cross_chama ? 'Cross-Chama' : 'Internal'}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
                                </div>
                                <span className="text-[10px] font-bold">{Math.round(progress)}%</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{formatCurrency(h.collected_amount)} / {formatCurrency(h.target_amount)}</p>
                            </div>
                            <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full uppercase shrink-0',
                              h.status === 'active' && 'bg-accent/10 text-accent',
                              h.status === 'completed' && 'bg-success/10 text-success',
                              h.status === 'closed' && 'bg-muted text-muted-foreground',
                            )}>{h.status}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Penalties */}
            <div>
              <h3 className="text-sm font-bold mb-2">Penalties ({chamaPenalties.length} total • {stats.unpaidPenalties} unpaid)</h3>
              {chamaPenalties.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No penalties recorded</p>
              ) : (
                <div className="space-y-2">
                  {chamaPenalties.slice(0, 20).map((p: any) => {
                    const group = chamaGroups.find((g: any) => g.id === p.group_id);
                    return (
                      <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{getUserName(p.user_id)}</p>
                          <p className="text-[10px] text-muted-foreground">{group?.name || 'Unknown'} • {p.reason}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm">{formatCurrency(p.amount)}</p>
                          <span className={cn('text-[10px] font-bold uppercase',
                            p.status === 'paid' ? 'text-success' : 'text-destructive'
                          )}>{p.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Platform Fees & Joining Fees */}
            <div>
              <h3 className="text-sm font-bold mb-2">Platform Revenue ({formatCurrency(stats.platformFees)})</h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                  <p className="text-[10px] text-muted-foreground uppercase">Platform Fees</p>
                  <p className="font-bold text-sm mt-0.5">{formatCurrency(totalPlatformFees)}</p>
                  <p className="text-[10px] text-muted-foreground">{chamaPlatformFees.length} fees</p>
                </div>
                <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                  <p className="text-[10px] text-muted-foreground uppercase">Joining Fees</p>
                  <p className="font-bold text-sm mt-0.5">{formatCurrency(totalJoiningFees)}</p>
                  <p className="text-[10px] text-muted-foreground">{chamaJoiningFees.length} payments</p>
                </div>
              </div>
              {chamaPlatformFees.length > 0 && (
                <div className="space-y-1.5">
                  {chamaPlatformFees.slice(0, 10).map((f: any) => {
                    const group = chamaGroups.find((g: any) => g.id === f.group_id);
                    return (
                      <div key={f.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/30 text-sm">
                        <div>
                          <p className="text-xs font-medium">{group?.name || 'Unknown'}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{f.fee_type} • {f.deducted_from}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-xs">{formatCurrency(f.amount)}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(f.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== REPORTS TAB ===== */}
          <TabsContent value="reports" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {txReports.length} total reports • {txReports.filter((r: any) => r.status === 'pending').length} pending review
            </p>
            {txReports.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="No reports" description="No transaction reports submitted yet" />
            ) : (
              <div className="space-y-2">
                {txReports.map((report: any) => (
                  <Card key={report.id} className="p-4 cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => { setSelectedReport(report); setReportResponse(report.admin_response || ''); setReportStatus(report.status); }}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">Transfer: {report.transfer_id?.slice(0, 12)}...</p>
                        <p className="text-xs text-muted-foreground truncate">{report.reason}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(report.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full uppercase shrink-0',
                        report.status === 'pending' && 'bg-accent/10 text-accent',
                        report.status === 'reviewed' && 'bg-primary/10 text-primary',
                        report.status === 'resolved' && 'bg-success/10 text-success',
                        report.status === 'dismissed' && 'bg-muted text-muted-foreground',
                      )}>{report.status}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== REMOVALS TAB ===== */}
          <TabsContent value="removals" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {removalRequests.length} total requests • {removalRequests.filter((r: any) => r.status === 'pending').length} pending review
            </p>
            {removalRequests.length === 0 ? (
              <EmptyState icon={Ban} title="No removal requests" description="Chairperson removal requests will appear here" />
            ) : (
              <div className="space-y-2">
                {removalRequests.map((req: any) => {
                  const group = chamaGroups.find((g: any) => g.id === req.group_id);
                  return (
                    <Card
                      key={req.id}
                      className={cn('p-4 cursor-pointer hover:bg-muted/60 transition-colors', req.status === 'pending' && 'border-accent/30')}
                      onClick={() => { setSelectedRemoval(req); setRemovalAction(''); setRemovalReason(''); }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold text-sm">Remove: {req.member_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">From: {group?.name || 'Unknown Group'}</p>
                          <p className="text-xs text-muted-foreground">By: {req.chairperson_name} ({req.chairperson_phone})</p>
                          <p className="text-xs text-muted-foreground">Member: {req.member_phone}</p>
                          <p className="text-xs italic mt-1">"{req.reason}"</p>
                        </div>
                        <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full uppercase',
                          req.status === 'pending' && 'bg-accent/10 text-accent',
                          req.status === 'approved' && 'bg-success/10 text-success',
                          req.status === 'rejected' && 'bg-destructive/10 text-destructive',
                        )}>{req.status}</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===== TRANSFERS TAB ===== */}
          <TabsContent value="transfers" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {walletTransfers.length} wallet transfers • {moneyRequests.length} money requests
            </p>

            {/* Wallet Transfers */}
            <div>
              <h3 className="text-sm font-bold mb-2">Wallet Transfers</h3>
              {walletTransfers.length === 0 ? (
                <EmptyState icon={Send} title="No Transfers" description="No peer-to-peer transfers yet." />
              ) : (
                <div className="space-y-2">
                  {walletTransfers.map((tr: any) => (
                    <Card key={tr.id} className="border-border/50">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                              tr.status === 'cancelled' ? 'bg-destructive/10' : 'bg-success/10'
                            )}>
                              <Send size={14} className={tr.status === 'cancelled' ? 'text-destructive' : 'text-success'} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {tr.sender_name || getUserName(tr.sender_id)} → {tr.receiver_name || getUserName(tr.receiver_id)}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {tr.reason || 'No reason'} • {new Date(tr.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm">{formatCurrency(tr.amount)}</p>
                            {tr.status === 'cancelled' && <span className="text-[10px] font-bold text-destructive">CANCELLED</span>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Money Requests */}
            <div>
              <h3 className="text-sm font-bold mb-2">Money Requests</h3>
              {moneyRequests.length === 0 ? (
                <EmptyState icon={HandCoins} title="No Requests" description="No money requests between users yet." />
              ) : (
                <div className="space-y-2">
                  {moneyRequests.map((req: any) => (
                    <Card key={req.id} className="border-border/50">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                              req.status === 'paid' ? 'bg-success/10' : req.status === 'declined' ? 'bg-destructive/10' : 'bg-accent/10'
                            )}>
                              <HandCoins size={14} className={
                                req.status === 'paid' ? 'text-success' : req.status === 'declined' ? 'text-destructive' : 'text-accent'
                              } />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {getUserName(req.requester_id)} → {getUserName(req.target_id)}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(req.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm">{formatCurrency(req.amount)}</p>
                            <span className={cn('text-[10px] font-bold uppercase',
                              req.status === 'paid' && 'text-success',
                              req.status === 'declined' && 'text-destructive',
                              req.status === 'pending' && 'text-accent',
                            )}>{req.status}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== SAVINGS TAB ===== */}
          <TabsContent value="savings" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {personalSavings.length} savings plans • {savingsWithdrawals.filter((w: any) => w.status === 'pending').length} pending withdrawal requests
            </p>

            {/* Savings Withdrawal Requests */}
            <div>
              <h3 className="text-sm font-bold mb-2">Savings Withdrawal Requests</h3>
              {savingsWithdrawals.length === 0 ? (
                <EmptyState icon={DollarSign} title="No Savings Withdrawals" description="No savings withdrawal requests yet." />
              ) : (
                <div className="space-y-2">
                  {savingsWithdrawals.map((wd: any) => {
                    const savings = personalSavings.find((s: any) => s.id === wd.savings_id);
                    return (
                      <Card key={wd.id} className={cn('border-border/50 hover:border-accent/20 transition-all', wd.status === 'pending' && 'border-accent/30')}>
                        <CardContent className="p-3 lg:p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                                wd.status === 'approved' ? 'bg-success/10' : wd.status === 'rejected' ? 'bg-destructive/10' : 'bg-accent/10'
                              )}>
                                <PiggyBank size={18} className={
                                  wd.status === 'approved' ? 'text-success' : wd.status === 'rejected' ? 'text-destructive' : 'text-accent'
                                } />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm">{getUserName(wd.user_id)}</p>
                                <p className="text-xs text-muted-foreground">
                                  Savings: {savings?.name || 'Unknown'} • Saved: {formatCurrency(savings?.saved_amount || 0)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  Penalty: {wd.penalty_percentage || 20}% • {new Date(wd.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                                </p>
                                {wd.reason && <p className="text-[10px] text-muted-foreground italic mt-0.5">"{wd.reason}"</p>}
                                {wd.admin_reason && <p className="text-[10px] text-muted-foreground/80 mt-0.5">Admin: {wd.admin_reason}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full uppercase',
                                wd.status === 'approved' && 'bg-success/10 text-success',
                                wd.status === 'rejected' && 'bg-destructive/10 text-destructive',
                                wd.status === 'pending' && 'bg-accent/10 text-accent',
                              )}>{wd.status}</span>
                              {wd.status === 'pending' && (
                                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                                  setSelectedSavingsWd(wd);
                                  setSavingsWdStatus('');
                                  setSavingsWdReason('');
                                }}>
                                  Review
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* All Personal Savings */}
            <div>
              <h3 className="text-sm font-bold mb-2">All Savings Plans ({personalSavings.length})</h3>
              {personalSavings.length === 0 ? (
                <EmptyState icon={PiggyBank} title="No Savings" description="No personal savings plans created yet." />
              ) : (
                <div className="space-y-2">
                  {personalSavings.map((s: any) => (
                    <Card key={s.id} className="border-border/50">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <PiggyBank size={14} className="text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{getUserName(s.user_id)} — {s.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {s.type} • {formatCurrency(s.saved_amount)} / {formatCurrency(s.target_amount)}
                                {s.interest_rate > 0 && ` • ${s.interest_rate}% rate`}
                              </p>
                            </div>
                          </div>
                          <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full uppercase',
                            s.status === 'active' && 'bg-success/10 text-success',
                            s.status === 'matured' && 'bg-primary/10 text-primary',
                            s.status === 'withdrawn' && 'bg-muted text-muted-foreground',
                          )}>{s.status}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* ===== REMOVAL REVIEW DIALOG ===== */}
        <Dialog open={!!selectedRemoval} onOpenChange={(o) => { if (!o) setSelectedRemoval(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Review Member Removal</DialogTitle>
            </DialogHeader>
            {selectedRemoval && (
              <div className="space-y-4">
                <div className="space-y-2 bg-muted/30 rounded-xl p-4 text-sm">
                  <div><span className="text-muted-foreground text-xs">Group:</span> <span className="font-medium">{chamaGroups.find((g: any) => g.id === selectedRemoval.group_id)?.name}</span></div>
                  <Separator />
                  <div><span className="text-muted-foreground text-xs">Chairperson:</span> <span className="font-medium">{selectedRemoval.chairperson_name} · {selectedRemoval.chairperson_phone}</span></div>
                  <Separator />
                  <div><span className="text-muted-foreground text-xs">Member to remove:</span> <span className="font-medium">{selectedRemoval.member_name} · {selectedRemoval.member_phone}</span></div>
                  <Separator />
                  <div><span className="text-muted-foreground text-xs">Reason:</span> <span className="font-medium">{selectedRemoval.reason}</span></div>
                  <Separator />
                  <div><span className="text-muted-foreground text-xs">Submitted:</span> <span className="font-medium">{new Date(selectedRemoval.created_at).toLocaleDateString()}</span></div>
                </div>

                {selectedRemoval.status === 'pending' && (
                  <>
                    <div>
                      <Label className="text-xs">Decision</Label>
                      <Select value={removalAction} onValueChange={setRemovalAction}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select action" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">Approve Removal</SelectItem>
                          <SelectItem value="rejected">Reject Request</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Admin Note (optional)</Label>
                      <Textarea value={removalReason} onChange={(e) => setRemovalReason(e.target.value)} placeholder="Reason for decision..." className="mt-1" />
                    </div>
                  </>
                )}

                {selectedRemoval.admin_reason && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Admin Response</p>
                    <p className="text-sm">{selectedRemoval.admin_reason}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedRemoval(null)}>Close</Button>
              {selectedRemoval?.status === 'pending' && (
                <Button
                  onClick={async () => {
                    if (!removalAction || !selectedRemoval) return;
                    setRemovalLoading(true);
                    try {
                      // Update the removal request
                      await supabase.from('chama_member_removal_requests' as any).update({
                        status: removalAction,
                        admin_reason: removalReason || null,
                        updated_at: new Date().toISOString(),
                      } as any).eq('id', selectedRemoval.id);

                      if (removalAction === 'approved') {
                        // Actually deactivate the member
                        const { data: memberData } = await supabase.from('chama_members')
                          .select('id')
                          .eq('group_id', selectedRemoval.group_id)
                          .eq('user_id', selectedRemoval.member_user_id)
                          .eq('is_active', true)
                          .maybeSingle();

                        if (memberData) {
                          await supabase.from('chama_members').update({
                            is_active: false,
                            remove_reason: selectedRemoval.reason,
                          } as any).eq('id', memberData.id);
                        }

                        const group = chamaGroups.find((g: any) => g.id === selectedRemoval.group_id);
                        // Notify both parties
                        await supabase.from('notifications').insert([
                          {
                            user_id: selectedRemoval.member_user_id,
                            title: 'Removed from Chama Group',
                            message: `You have been removed from "${group?.name}". Reason: ${selectedRemoval.reason}`,
                          },
                          {
                            user_id: selectedRemoval.chairperson_user_id,
                            title: 'Removal Approved',
                            message: `Your request to remove ${selectedRemoval.member_name} from "${group?.name}" has been approved by admin.`,
                          },
                        ]);
                      } else {
                        // Notify chairperson of rejection
                        const group = chamaGroups.find((g: any) => g.id === selectedRemoval.group_id);
                        await supabase.from('notifications').insert({
                          user_id: selectedRemoval.chairperson_user_id,
                          title: 'Removal Request Rejected',
                          message: `Your request to remove ${selectedRemoval.member_name} from "${group?.name}" was rejected.${removalReason ? ' Reason: ' + removalReason : ''}`,
                        });
                      }

                      toast.success(`Removal request ${removalAction}`);
                      setSelectedRemoval(null);
                      fetchData();
                    } catch (err: any) {
                      toast.error(err.message || 'Failed');
                    } finally {
                      setRemovalLoading(false);
                    }
                  }}
                  disabled={removalLoading || !removalAction}
                >
                  {removalLoading ? <Loader2 className="animate-spin" size={16} /> : 'Confirm'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== REPORT REVIEW DIALOG ===== */}
        <Dialog open={!!selectedReport} onOpenChange={(o) => { if (!o) setSelectedReport(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><AlertTriangle size={16} /> Review Report</DialogTitle>
            </DialogHeader>
            {selectedReport && (
              <div className="space-y-4">
                <div className="space-y-2 bg-muted/30 rounded-xl p-4">
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-xs text-muted-foreground">Transfer ID</span>
                    <span className="text-[11px] font-mono">{selectedReport.transfer_id?.slice(0, 16)}...</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-xs text-muted-foreground">Reporter</span>
                    <span className="text-xs">{profiles.find(p => p.user_id === selectedReport.reporter_id)?.full_name || selectedReport.reporter_id?.slice(0,8)}</span>
                  </div>
                  <div className="py-1 border-b border-border/30">
                    <span className="text-xs text-muted-foreground">Report Reason</span>
                    <p className="text-sm mt-1">{selectedReport.reason}</p>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-xs text-muted-foreground">Submitted</span>
                    <span className="text-xs">{new Date(selectedReport.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={reportStatus} onValueChange={setReportStatus}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Admin Response</Label>
                  <Textarea
                    value={reportResponse}
                    onChange={(e) => setReportResponse(e.target.value)}
                    placeholder="Your response to the reporter..."
                    className="mt-1 min-h-[60px]"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedReport(null)}>Cancel</Button>
              <Button
                variant="gold"
                disabled={reportLoading}
                onClick={async () => {
                  if (!selectedReport) return;
                  setReportLoading(true);
                  try {
                    await supabase.from('transaction_reports' as any).update({
                      status: reportStatus,
                      admin_response: reportResponse || null,
                      updated_at: new Date().toISOString(),
                    } as any).eq('id', selectedReport.id);
                    
                    // Notify reporter
                    await supabase.from('notifications').insert({
                      user_id: selectedReport.reporter_id,
                      title: '📋 Transaction Report Updated',
                      message: `Your transaction report has been ${reportStatus}.${reportResponse ? ` Response: ${reportResponse}` : ''}`,
                    });
                    
                    toast.success('Report updated');
                    setSelectedReport(null);
                    fetchData();
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to update');
                  } finally {
                    setReportLoading(false);
                  }
                }}
              >
                {reportLoading ? <Loader2 className="animate-spin" size={16} /> : 'Update Report'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* ===== LOAN REVIEW DIALOG ===== */}
        <Dialog open={!!selectedLoan} onOpenChange={(o) => !o && setSelectedLoan(null)}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Review Loan Application</DialogTitle></DialogHeader>
            {selectedLoan && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { label: 'Applicant', value: getUserName(selectedLoan.user_id) },
                    { label: 'Phone', value: getUserPhone(selectedLoan.user_id) },
                    { label: 'Product', value: selectedLoan.loan_type.replace('_', ' ') },
                    { label: 'Employment', value: selectedLoan.employment_status.replace('_', ' ') },
                    { label: 'Amount', value: formatCurrency(selectedLoan.applied_amount) },
                    { label: 'Limit', value: formatCurrency(selectedLoan.generated_limit) },
                    { label: 'Income', value: formatCurrency(selectedLoan.monthly_income) },
                    { label: 'Expenses', value: formatCurrency(selectedLoan.monthly_expenses) },
                    { label: 'Next of Kin', value: selectedLoan.next_of_kin_name },
                    { label: 'NOK Phone', value: selectedLoan.next_of_kin_phone },
                    { label: 'Dependents', value: String(selectedLoan.number_of_dependents ?? '—') },
                    { label: 'Existing Loans', value: selectedLoan.existing_loans ? `Yes (${formatCurrency(selectedLoan.existing_loan_amount || 0)})` : 'No' },
                  ].map((item, i) => (
                    <div key={i} className="p-2 rounded-lg bg-muted/30 border border-border/30">
                      <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                      <p className="font-medium text-xs mt-0.5 capitalize">{item.value}</p>
                    </div>
                  ))}
                </div>
                <Separator />
                <div>
                  <Label className="text-xs">Decision</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select action" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approve</SelectItem>
                      <SelectItem value="rejected">Reject</SelectItem>
                      <SelectItem value="disbursed">Disburse</SelectItem>
                      <SelectItem value="pending">Set Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Message to Applicant</Label>
                  <Textarea value={adminMsg} onChange={(e) => setAdminMsg(e.target.value)} placeholder="Reason or note..." className="mt-1" rows={3} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedLoan(null)}>Cancel</Button>
              <Button variant="gold" onClick={handleLoanAction} disabled={!newStatus || actionLoading}>
                {actionLoading ? <Loader2 className="animate-spin" size={16} /> : 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== DISABLE ACCOUNT DIALOG ===== */}
        <Dialog open={disableDialog.open} onOpenChange={(o) => !o && setDisableDialog({ open: false, profile: null })}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive"><Ban size={18} /> Disable Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {disableDialog.profile && (
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-sm font-semibold">{disableDialog.profile.full_name}</p>
                  <p className="text-xs text-muted-foreground">{disableDialog.profile.email} • {disableDialog.profile.phone}</p>
                </div>
              )}
              <div>
                <Label className="text-xs font-medium">Reason for disabling <span className="text-destructive">*</span></Label>
                <Textarea
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  placeholder="e.g. Fraudulent activity, violation of terms..."
                  className="mt-1.5"
                  rows={3}
                />
                <p className="text-[10px] text-muted-foreground mt-1">The user will see this reason when they try to log in.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDisableDialog({ open: false, profile: null })}>Cancel</Button>
              <Button variant="destructive" onClick={handleDisableAccount} disabled={!disableReason.trim() || disableLoading}>
                {disableLoading ? <Loader2 className="animate-spin" size={16} /> : <><Ban size={14} /> Disable Account</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== EDIT USER DIALOG ===== */}
        <Dialog open={editDialog.open} onOpenChange={(o) => !o && setEditDialog({ open: false, profile: null })}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Pencil size={18} /> Edit User Profile</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'full_name', label: 'Full Name', type: 'text' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'phone', label: 'Phone', type: 'tel' },
                { key: 'id_number', label: 'National ID', type: 'text' },
                { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
                { key: 'county', label: 'County', type: 'text' },
                { key: 'sub_county', label: 'Sub-County', type: 'text' },
                { key: 'ward', label: 'Ward', type: 'text' },
                { key: 'address', label: 'Address', type: 'text' },
              ].map((field) => (
                <div key={field.key}>
                  <Label className="text-xs">{field.label}</Label>
                  <Input
                    type={field.type}
                    value={(editForm as any)[field.key] || ''}
                    onChange={(e) => setEditForm({ ...editForm, [field.key]: e.target.value })}
                    className="mt-1 h-9 text-sm"
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog({ open: false, profile: null })}>Cancel</Button>
              <Button variant="gold" onClick={handleEditUser} disabled={editLoading}>
                {editLoading ? <Loader2 className="animate-spin" size={16} /> : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== STK PUSH DIALOG ===== */}
        <Dialog open={stkDialog.open} onOpenChange={(o) => !o && setStkDialog({ open: false, userId: '', phone: '', name: '' })}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Smartphone size={18} /> Initiate STK Push</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                <p className="text-sm font-medium">{stkDialog.name}</p>
                <p className="text-xs text-muted-foreground">{stkDialog.phone}</p>
              </div>
              <div>
                <Label className="text-xs">Message to User (sent before STK)</Label>
                <Textarea
                  value={stkMessage}
                  onChange={(e) => setStkMessage(e.target.value)}
                  placeholder={`You will receive an M-Pesa payment prompt of KES ${stkAmount || '349'}. Please enter your PIN to complete the transaction.`}
                  className="mt-1"
                  rows={3}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Leave blank to use default message</p>
              </div>
              <div>
                <Label className="text-xs">Amount (KES)</Label>
                <Input type="number" value={stkAmount} onChange={(e) => setStkAmount(e.target.value)} className="mt-1" placeholder="349" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStkDialog({ open: false, userId: '', phone: '', name: '' })}>Cancel</Button>
              <Button variant="gold" onClick={handleInitiateStk} disabled={stkLoading || !stkAmount}>
                {stkLoading ? <Loader2 className="animate-spin" size={16} /> : <><Smartphone size={14} /> Message & Send STK</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== SEND MESSAGE DIALOG ===== */}
        <Dialog open={messageDialog.open} onOpenChange={(o) => !o && setMessageDialog({ open: false, userId: '', name: '' })}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Send Message to {messageDialog.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Message Type</Label>
                <Select value={messageType} onValueChange={(v) => setMessageType(v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Message</SelectItem>
                    <SelectItem value="document_request">Request Documents</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Message</Label>
                <Textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder={messageType === 'document_request' ? 'e.g. Please upload your latest payslip and national ID...' : 'Type your message...'} className="mt-1" rows={4} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMessageDialog({ open: false, userId: '', name: '' })}>Cancel</Button>
              <Button variant="gold" onClick={handleSendMessage} disabled={!messageText.trim() || sendingMessage}>
                {sendingMessage ? <Loader2 className="animate-spin" size={16} /> : <><Send size={14} /> Send</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== USER DETAIL DIALOG ===== */}
        <Dialog open={!!selectedUser} onOpenChange={(o) => !o && setSelectedUser(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Users size={18} /> Customer Profile</DialogTitle></DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
                  <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-accent-foreground font-bold text-base shrink-0">
                    {selectedUser.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base truncate">{selectedUser.full_name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{selectedUser.email} • {selectedUser.phone}</p>
                    {!selectedUser.is_active && selectedUser.disable_reason && (
                      <p className="text-[11px] text-destructive mt-0.5">⚠ Disabled: {selectedUser.disable_reason}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={selectedUser.is_active ? 'active' : 'inactive'} />
                    {selectedUser.is_verified && <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Verified</span>}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedUser.is_active ? (
                    <Button size="sm" variant="outline" className="text-xs text-destructive border-destructive/30" onClick={() => { setSelectedUser(null); setDisableDialog({ open: true, profile: selectedUser }); setDisableReason(''); }}>
                      <Ban size={12} className="mr-1" /> Disable
                    </Button>
                  ) : (
                    <Button size="sm" className="text-xs bg-success hover:bg-success/90 text-white" onClick={() => handleActivateAccount(selectedUser)} disabled={togglingUser === selectedUser.user_id}>
                      {togglingUser === selectedUser.user_id ? <Loader2 size={12} className="animate-spin" /> : <><CheckCircle size={12} className="mr-1" /> Activate</>}
                    </Button>
                  )}
                  <Button size="sm" variant={selectedUser.is_verified ? 'outline' : 'default'} className="text-xs" onClick={() => handleToggleVerified(selectedUser)} disabled={togglingUser === selectedUser.user_id}>
                    {selectedUser.is_verified ? <><XCircle size={12} className="mr-1" /> Unverify</> : <><BadgeCheck size={12} className="mr-1" /> Verify</>}
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => { setSelectedUser(null); openEditDialog(selectedUser); }}>
                    <Pencil size={12} className="mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setStkDialog({ open: true, userId: selectedUser.user_id, phone: selectedUser.phone, name: selectedUser.full_name })}>
                    <Smartphone size={12} className="mr-1" /> STK
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => { setSelectedUser(null); setMessageDialog({ open: true, userId: selectedUser.user_id, name: selectedUser.full_name }); }}>
                    <Send size={12} className="mr-1" /> Message
                  </Button>
                </div>

                <Separator />

                {/* Personal Info */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Personal Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      { label: 'Phone', value: selectedUser.phone },
                      { label: 'National ID', value: selectedUser.id_number },
                      { label: 'Date of Birth', value: selectedUser.date_of_birth ? new Date(selectedUser.date_of_birth).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                      { label: 'Member Since', value: new Date(selectedUser.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) },
                    ].map((item, i) => (
                      <div key={i} className="p-2 rounded-lg bg-muted/30 border border-border/30">
                        <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                        <p className="font-medium text-xs mt-0.5">{item.value || '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Location</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      { label: 'County', value: selectedUser.county },
                      { label: 'Sub-County', value: selectedUser.sub_county },
                      { label: 'Ward', value: selectedUser.ward },
                      { label: 'Address', value: selectedUser.address },
                    ].map((item, i) => (
                      <div key={i} className="p-2 rounded-lg bg-muted/30 border border-border/30">
                        <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                        <p className="font-medium text-xs mt-0.5">{item.value || '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Loan History */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Loan History ({loans.filter((l) => l.user_id === selectedUser.user_id).length})</h4>
                  {loans.filter((l) => l.user_id === selectedUser.user_id).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No loan applications</p>
                  ) : (
                    <div className="space-y-1.5">
                      {loans.filter((l) => l.user_id === selectedUser.user_id).map((loan) => (
                        <div key={loan.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/30 text-sm">
                          <div>
                            <p className="font-medium text-xs capitalize">{loan.loan_type.replace('_', ' ')} Loan</p>
                            <p className="text-[10px] text-muted-foreground">{new Date(loan.created_at).toLocaleDateString('en-KE')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs">{formatCurrency(loan.applied_amount)}</span>
                            <StatusBadge status={loan.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Transactions */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Payment History ({userTransactions.length})</h4>
                  {userTransactions.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No transactions</p>
                  ) : (
                    <div className="space-y-1.5">
                      {userTransactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/30 text-sm cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedTransaction(tx)}>
                          <div>
                            <p className="font-medium text-xs">{formatCurrency(tx.amount)}</p>
                            <p className="text-[10px] text-muted-foreground">{tx.reference} • {tx.phone}</p>
                          </div>
                          <div className="text-right">
                            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                              tx.status === 'success' && 'bg-success/10 text-success',
                              tx.status === 'failed' && 'bg-destructive/10 text-destructive',
                              tx.status === 'pending' && 'bg-accent/10 text-accent',
                            )}>{tx.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Documents */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Documents ({userDocs.length})</h4>
                  {docsLoading ? (
                    <div className="py-3 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" size={16} /></div>
                  ) : userDocs.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No documents uploaded</p>
                  ) : (
                    <div className="space-y-1.5">
                      {userDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                          <FileText size={14} className="text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium capitalize">{doc.document_type.replace(/_/g, ' ')}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{doc.file_name}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => getDocSignedUrl(doc.file_path)}>
                              <Eye size={10} />
                            </Button>
                            {doc.status === 'pending' ? (
                              <>
                                <Button size="sm" variant="outline" className="h-6 px-1.5 text-success border-success/30" onClick={() => { setDocReviewDialog({ open: true, docId: doc.id, docType: doc.document_type, status: 'approved', userId: selectedUser!.user_id }); setDocReviewReason(''); }}>
                                  <CheckCircle size={10} />
                                </Button>
                                <Button size="sm" variant="outline" className="h-6 px-1.5 text-destructive border-destructive/30" onClick={() => { setDocReviewDialog({ open: true, docId: doc.id, docType: doc.document_type, status: 'rejected', userId: selectedUser!.user_id }); setDocReviewReason(''); }}>
                                  <XCircle size={10} />
                                </Button>
                              </>
                            ) : (
                              <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full',
                                doc.status === 'approved' && 'bg-success/10 text-success',
                                doc.status === 'rejected' && 'bg-destructive/10 text-destructive',
                              )}>{doc.status}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ===== TRANSACTION DETAIL DIALOG ===== */}
        <Dialog open={!!selectedTransaction} onOpenChange={(o) => !o && setSelectedTransaction(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet size={18} /> Transaction Details</DialogTitle></DialogHeader>
            {selectedTransaction && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40">
                  <div>
                    <p className="text-sm font-semibold">{getUserName(selectedTransaction.user_id)}</p>
                    <p className="text-xs text-muted-foreground">{selectedTransaction.phone}</p>
                  </div>
                  <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full capitalize',
                    selectedTransaction.status === 'success' && 'bg-success/10 text-success',
                    selectedTransaction.status === 'failed' && 'bg-destructive/10 text-destructive',
                    selectedTransaction.status === 'pending' && 'bg-accent/10 text-accent',
                  )}>{selectedTransaction.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Amount', value: formatCurrency(selectedTransaction.amount) },
                    { label: 'Reference', value: selectedTransaction.reference },
                    { label: 'Phone', value: selectedTransaction.phone },
                    { label: 'M-Pesa Receipt', value: selectedTransaction.mpesa_receipt || '—' },
                    { label: 'Checkout ID', value: selectedTransaction.checkout_request_id || '—' },
                    { label: 'Merchant ID', value: selectedTransaction.merchant_request_id || '—' },
                    { label: 'Result Code', value: selectedTransaction.result_code || '—' },
                    { label: 'Result Description', value: selectedTransaction.result_desc || '—' },
                    { label: 'Created', value: new Date(selectedTransaction.created_at).toLocaleString('en-KE') },
                    { label: 'Updated', value: new Date(selectedTransaction.updated_at).toLocaleString('en-KE') },
                  ].map((item, i) => (
                    <div key={i} className="p-2 rounded-lg bg-muted/30 border border-border/30">
                      <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                      <p className="font-medium text-xs mt-0.5 break-all">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ===== CONVERSATION DIALOG ===== */}
        <Dialog open={!!conversationUserId} onOpenChange={(o) => !o && setConversationUserId(null)}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare size={18} />
                Chat with {conversationUserId ? getUserName(conversationUserId) : ''}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-2 py-2 max-h-[50vh]">
              {conversationMessages.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No messages in this conversation</p>
              ) : (
                conversationMessages.map((msg) => (
                  <div key={msg.id} className={cn('flex', msg.sender_type === 'admin' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[80%] rounded-2xl px-3 py-2',
                      msg.sender_type === 'admin'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                    )}>
                      <p className="text-sm">{msg.message}</p>
                      <p className={cn('text-[10px] mt-0.5',
                        msg.sender_type === 'admin' ? 'text-primary-foreground/50' : 'text-muted-foreground'
                      )}>
                        {new Date(msg.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 pt-2 border-t border-border/50">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type a reply..."
                className="resize-none min-h-[44px] max-h-[80px] text-sm"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />
              <Button variant="gold" size="icon" className="shrink-0 h-11 w-11" onClick={handleReply} disabled={!replyText.trim() || replyLoading}>
                {replyLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ===== DOCUMENT REVIEW DIALOG ===== */}
        <Dialog open={docReviewDialog.open} onOpenChange={(o) => !o && setDocReviewDialog({ open: false, docId: '', docType: '', status: '', userId: '' })}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {docReviewDialog.status === 'approved' ? <CheckCircle size={18} className="text-success" /> : <XCircle size={18} className="text-destructive" />}
                {docReviewDialog.status === 'approved' ? 'Approve' : 'Reject'} Document
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                <p className="text-sm font-medium capitalize">{docReviewDialog.docType.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <Label className="text-xs">Reason / Notes {docReviewDialog.status === 'rejected' && <span className="text-destructive">*</span>}</Label>
                <Textarea
                  value={docReviewReason}
                  onChange={(e) => setDocReviewReason(e.target.value)}
                  placeholder={docReviewDialog.status === 'rejected' ? 'e.g. Document is blurry, please re-upload...' : 'Optional notes...'}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDocReviewDialog({ open: false, docId: '', docType: '', status: '', userId: '' })}>Cancel</Button>
              <Button
                variant={docReviewDialog.status === 'approved' ? 'success' : 'destructive'}
                onClick={handleDocStatus}
                disabled={docReviewLoading || (docReviewDialog.status === 'rejected' && !docReviewReason.trim())}
              >
                {docReviewLoading ? <Loader2 className="animate-spin" size={16} /> : docReviewDialog.status === 'approved' ? <><CheckCircle size={14} /> Approve</> : <><XCircle size={14} /> Reject</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== WITHDRAWAL REVIEW DIALOG (Enhanced) ===== */}
        <Dialog open={!!selectedWithdrawal} onOpenChange={(o) => { if (!o) { setSelectedWithdrawal(null); setWdDocRequest(false); setWdFeeAmount(''); } }}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Send size={18} /> Review Withdrawal</DialogTitle></DialogHeader>
            {selectedWithdrawal && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{getUserName(selectedWithdrawal.user_id)}</p>
                      <p className="text-xs text-muted-foreground">{selectedWithdrawal.phone}</p>
                    </div>
                    <p className="text-xl font-bold font-display">{formatCurrency(selectedWithdrawal.amount)}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Update Status</Label>
                  <Select value={withdrawalStatus} onValueChange={setWithdrawalStatus}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      {selectedWithdrawal.status === 'pending' && <SelectItem value="approved">Approve</SelectItem>}
                      <SelectItem value="completed">Mark Completed</SelectItem>
                      <SelectItem value="rejected">Reject</SelectItem>
                      <SelectItem value="documents_required">Request Documents</SelectItem>
                      <SelectItem value="fee_required">Require Fee Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {withdrawalStatus === 'fee_required' && (
                  <div>
                    <Label className="text-xs">Fee Amount (KES)</Label>
                    <Input type="number" value={wdFeeAmount} onChange={(e) => setWdFeeAmount(e.target.value)} placeholder="e.g. 500" className="mt-1" />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Reason / Notes</Label>
                  <Textarea value={withdrawalReason} onChange={(e) => setWithdrawalReason(e.target.value)} placeholder={withdrawalStatus === 'documents_required' ? 'Specify which documents are needed...' : 'Optional reason...'} className="mt-1" rows={3} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedWithdrawal(null); setWdDocRequest(false); setWdFeeAmount(''); }}>Cancel</Button>
              <Button
                variant="gold"
                onClick={async () => {
                  if (!selectedWithdrawal || !withdrawalStatus) return;
                  setWithdrawalLoading(true);
                  try {
                    if (withdrawalStatus === 'documents_required') {
                      // Send document upload notification to user
                      await supabase.from('notifications').insert({
                        user_id: selectedWithdrawal.user_id,
                        title: '📄 Document Required for Withdrawal',
                        message: `[DOCUMENT_REQUEST] ${withdrawalReason || 'Please upload required documents for your withdrawal request.'}`,
                      });
                      await supabase.from('withdrawal_requests').update({ status: 'documents_required', admin_reason: `Documents requested: ${withdrawalReason}` }).eq('id', selectedWithdrawal.id);
                      toast.success('Document request sent to user');
                    } else if (withdrawalStatus === 'fee_required') {
                      // Send fee payment STK to user
                      const feeAmt = Number(wdFeeAmount);
                      if (!feeAmt) { toast.error('Enter fee amount'); setWithdrawalLoading(false); return; }
                      const wdProfile = profiles.find(p => p.user_id === selectedWithdrawal.user_id);
                      if (!wdProfile) { toast.error('User profile not found'); setWithdrawalLoading(false); return; }
                      
                      await supabase.from('notifications').insert({
                        user_id: selectedWithdrawal.user_id,
                        title: '💰 Fee Required for Withdrawal',
                        message: `[PAY_NOW:${feeAmt}] A processing fee of KES ${feeAmt.toLocaleString()} is required for your withdrawal. ${withdrawalReason || ''}`,
                      });
                      // Initiate STK
                      await supabase.functions.invoke('initiate-stk-push', {
                        body: { phone: wdProfile.phone, amount: feeAmt, userId: selectedWithdrawal.user_id },
                      });
                      await supabase.from('withdrawal_requests').update({ status: 'fee_required', admin_reason: `Fee of KES ${feeAmt} required. ${withdrawalReason || ''}` }).eq('id', selectedWithdrawal.id);
                      toast.success(`Fee STK of KES ${feeAmt} sent to ${wdProfile.phone}`);
                    } else {
                      const { error } = await supabase.from('withdrawal_requests').update({ status: withdrawalStatus, admin_reason: withdrawalReason || null }).eq('id', selectedWithdrawal.id);
                      if (error) throw error;

                      if (withdrawalStatus === 'completed') {
                        const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', selectedWithdrawal.user_id).maybeSingle();
                        if (wallet) {
                          await supabase.from('wallets').update({ balance: Math.max(0, (wallet as any).balance - selectedWithdrawal.amount) }).eq('id', (wallet as any).id);
                          await supabase.from('wallet_transactions').insert({ user_id: selectedWithdrawal.user_id, wallet_id: (wallet as any).id, type: 'withdrawal', amount: selectedWithdrawal.amount, description: `Withdrawal to ${selectedWithdrawal.phone}` });
                        }
                      }

                      const statusLabel = withdrawalStatus.charAt(0).toUpperCase() + withdrawalStatus.slice(1);
                      const reasonText = withdrawalReason ? ` Note: ${withdrawalReason}` : '';
                      await supabase.from('notifications').insert({ user_id: selectedWithdrawal.user_id, title: `Withdrawal ${statusLabel}`, message: `Your withdrawal request for ${formatCurrency(selectedWithdrawal.amount)} has been ${withdrawalStatus}.${reasonText}` });
                      await supabase.from('audit_logs').insert({ admin_id: user?.id, user_id: selectedWithdrawal.user_id, action: `withdrawal_${withdrawalStatus}`, details: { amount: selectedWithdrawal.amount, phone: selectedWithdrawal.phone, reason: withdrawalReason } });

                      const wdUserProfile = profiles.find(p => p.user_id === selectedWithdrawal.user_id);
                      if (wdUserProfile?.phone) {
                        const smsMsg = withdrawalStatus === 'completed'
                          ? `Dear ${wdUserProfile.full_name}, your withdrawal of KES ${selectedWithdrawal.amount.toLocaleString()} to ${selectedWithdrawal.phone} has been processed.`
                          : `Dear ${wdUserProfile.full_name}, your withdrawal of KES ${selectedWithdrawal.amount.toLocaleString()} has been ${withdrawalStatus}.${withdrawalReason ? ' Reason: ' + withdrawalReason : ''}`;
                        supabase.functions.invoke('send-sms', { body: { phone: wdUserProfile.phone, message: smsMsg } }).catch(err => console.error('SMS failed:', err));
                      }
                      toast.success(`Withdrawal ${withdrawalStatus}`);
                    }

                    setSelectedWithdrawal(null);
                    setWdDocRequest(false);
                    setWdFeeAmount('');
                    fetchData();
                  } catch (err: any) {
                    toast.error(err.message || 'Failed');
                  } finally {
                    setWithdrawalLoading(false);
                  }
                }}
                disabled={withdrawalLoading || !withdrawalStatus}
              >
                {withdrawalLoading ? <Loader2 className="animate-spin" size={16} /> : 'Update'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== CHAMA WITHDRAWAL REVIEW DIALOG ===== */}
        <Dialog open={!!selectedChamaWd} onOpenChange={(o) => { if (!o) { setSelectedChamaWd(null); setChamaWdDocRequest(false); setChamaWdFeeAmount(''); } }}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><PiggyBank size={18} /> Review Chama Withdrawal</DialogTitle></DialogHeader>
            {selectedChamaWd && (() => {
              const group = chamaGroups.find((g: any) => g.id === selectedChamaWd.group_id);
              const groupMems = chamaMembers.filter((m: any) => m.group_id === selectedChamaWd.group_id);
              const secretary = groupMems.find((m: any) => m.role === 'secretary');
              const treasurer = groupMems.find((m: any) => m.role === 'treasurer');
              return (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                    <p className="font-semibold text-sm">{group?.name || 'Unknown Group'}</p>
                    <p className="text-xs text-muted-foreground">Requested by: {getUserName(selectedChamaWd.requested_by)}</p>
                    <p className="text-xs text-muted-foreground">Phone: {selectedChamaWd.phone}</p>
                    <p className="text-xl font-bold font-display mt-1">{formatCurrency(selectedChamaWd.amount)}</p>
                    {selectedChamaWd.reason && <p className="text-xs text-muted-foreground italic mt-1">"{selectedChamaWd.reason}"</p>}
                  </div>
                  <div>
                    <Label className="text-xs">Decision</Label>
                    <Select value={chamaWdAction} onValueChange={setChamaWdAction}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select action" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Approve & Disburse</SelectItem>
                        <SelectItem value="rejected">Reject</SelectItem>
                        <SelectItem value="documents_required">Request Documents</SelectItem>
                        <SelectItem value="fee_required">Require Fee Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {chamaWdAction === 'fee_required' && (
                    <div>
                      <Label className="text-xs">Fee Amount (KES)</Label>
                      <Input type="number" value={chamaWdFeeAmount} onChange={(e) => setChamaWdFeeAmount(e.target.value)} placeholder="e.g. 500" className="mt-1" />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Reason / Notes</Label>
                    <Textarea value={chamaWdReason} onChange={(e) => setChamaWdReason(e.target.value)} placeholder={chamaWdAction === 'documents_required' ? 'Specify which documents are needed...' : 'Optional reason...'} className="mt-1" rows={3} />
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedChamaWd(null); setChamaWdDocRequest(false); setChamaWdFeeAmount(''); }}>Cancel</Button>
              <Button
                variant="gold"
                onClick={async () => {
                  if (!selectedChamaWd || !chamaWdAction) return;
                  setChamaWdLoading(true);
                  try {
                    const group = chamaGroups.find((g: any) => g.id === selectedChamaWd.group_id);
                    const groupMems = chamaMembers.filter((m: any) => m.group_id === selectedChamaWd.group_id);
                    const leaders = groupMems.filter((m: any) => ['chairperson', 'secretary', 'treasurer'].includes(m.role));
                    const secretary = groupMems.find((m: any) => m.role === 'secretary');

                    if (chamaWdAction === 'documents_required') {
                      // Send document request notification to secretary
                      if (secretary) {
                        await supabase.from('notifications').insert({
                          user_id: secretary.user_id,
                          title: '📄 Documents Required for Group Withdrawal',
                          message: `[DOCUMENT_REQUEST] Admin requires documents for ${group?.name || 'group'} withdrawal of ${formatCurrency(selectedChamaWd.amount)}. ${chamaWdReason || 'Please upload the required documents.'}`,
                        });
                      }
                      // Notify all 3 leaders
                      await supabase.from('notifications').insert(
                        leaders.map((l: any) => ({
                          user_id: l.user_id,
                          title: 'Withdrawal: Documents Required',
                          message: `Admin has requested documents for the ${group?.name || 'group'} withdrawal of ${formatCurrency(selectedChamaWd.amount)}. Secretary should upload them. ${chamaWdReason || ''}`,
                        }))
                      );
                      await supabase.from('chama_withdrawals').update({ admin_reason: `Documents requested: ${chamaWdReason}`, admin_status: 'documents_required' }).eq('id', selectedChamaWd.id);
                      toast.success('Document request sent to secretary');

                    } else if (chamaWdAction === 'fee_required') {
                      const feeAmt = Number(chamaWdFeeAmount);
                      if (!feeAmt) { toast.error('Enter fee amount'); setChamaWdLoading(false); return; }
                      // Send STK to treasurer
                      const treasurer = groupMems.find((m: any) => m.role === 'treasurer');
                      const treasurerProfile = profiles.find(p => p.user_id === treasurer?.user_id);
                      if (treasurerProfile) {
                        await supabase.from('notifications').insert({
                          user_id: treasurer.user_id,
                          title: '💰 Fee Required for Group Withdrawal',
                          message: `[PAY_NOW:${feeAmt}] A processing fee of KES ${feeAmt.toLocaleString()} is required for your group withdrawal. ${chamaWdReason || ''}`,
                        });
                        await supabase.functions.invoke('initiate-stk-push', {
                          body: { phone: treasurerProfile.phone, amount: feeAmt, userId: treasurer.user_id },
                        });
                        // Notify all leaders
                        await supabase.from('notifications').insert(
                          leaders.filter((l: any) => l.user_id !== treasurer.user_id).map((l: any) => ({
                            user_id: l.user_id,
                            title: 'Withdrawal: Fee Required',
                            message: `Admin requires KES ${feeAmt.toLocaleString()} processing fee for ${group?.name || 'group'} withdrawal. STK sent to treasurer.`,
                          }))
                        );
                      }
                      await supabase.from('chama_withdrawals').update({ admin_reason: `Fee KES ${feeAmt} required. ${chamaWdReason || ''}`, admin_status: 'fee_required' }).eq('id', selectedChamaWd.id);
                      toast.success(`Fee STK sent to treasurer`);

                    } else {
                      // Approve or reject
                      const newStatus = chamaWdAction === 'approved' ? 'disbursed' : 'rejected';
                      await supabase.from('chama_withdrawals').update({ status: newStatus, admin_status: chamaWdAction, admin_reason: chamaWdReason || null }).eq('id', selectedChamaWd.id);

                      // Notify all leaders
                      const statusLabel = chamaWdAction === 'approved' ? 'Approved & Disbursed' : 'Rejected';
                      await supabase.from('notifications').insert(
                        leaders.map((l: any) => ({
                          user_id: l.user_id,
                          title: `Chama Withdrawal ${statusLabel}`,
                          message: `The withdrawal of ${formatCurrency(selectedChamaWd.amount)} for ${group?.name || 'group'} has been ${statusLabel.toLowerCase()} by admin.${chamaWdReason ? ' Reason: ' + chamaWdReason : ''}`,
                        }))
                      );

                      await supabase.from('audit_logs').insert({
                        admin_id: user?.id,
                        action: `chama_withdrawal_${chamaWdAction}`,
                        details: { group: group?.name, amount: selectedChamaWd.amount, reason: chamaWdReason },
                      });

                      toast.success(`Chama withdrawal ${statusLabel.toLowerCase()}`);
                    }

                    setSelectedChamaWd(null);
                    setChamaWdDocRequest(false);
                    setChamaWdFeeAmount('');
                    fetchData();
                  } catch (err: any) {
                    toast.error(err.message || 'Failed');
                  } finally {
                    setChamaWdLoading(false);
                  }
                }}
                disabled={chamaWdLoading || !chamaWdAction}
              >
                {chamaWdLoading ? <Loader2 className="animate-spin" size={16} /> : 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== SAVINGS WITHDRAWAL REVIEW DIALOG ===== */}
        <Dialog open={!!selectedSavingsWd} onOpenChange={(o) => { if (!o) setSelectedSavingsWd(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Review Savings Withdrawal</DialogTitle></DialogHeader>
            {selectedSavingsWd && (() => {
              const savings = personalSavings.find((s: any) => s.id === selectedSavingsWd.savings_id);
              return (
                <div className="space-y-4">
                  <div className="space-y-2 bg-muted/30 rounded-xl p-4 text-sm">
                    <div><span className="text-muted-foreground text-xs">User:</span> <span className="font-medium">{getUserName(selectedSavingsWd.user_id)}</span></div>
                    <Separator />
                    <div><span className="text-muted-foreground text-xs">Savings:</span> <span className="font-medium">{savings?.name || 'Unknown'} · {formatCurrency(savings?.saved_amount || 0)}</span></div>
                    <Separator />
                    <div><span className="text-muted-foreground text-xs">Penalty:</span> <span className="font-medium">{selectedSavingsWd.penalty_percentage || 20}%</span></div>
                    {selectedSavingsWd.reason && <><Separator /><div><span className="text-muted-foreground text-xs">Reason:</span> <span className="font-medium">{selectedSavingsWd.reason}</span></div></>}
                  </div>
                  <div>
                    <Label className="text-xs">Decision</Label>
                    <Select value={savingsWdStatus} onValueChange={setSavingsWdStatus}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select action" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Approve</SelectItem>
                        <SelectItem value="rejected">Reject</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Admin Note</Label>
                    <Textarea value={savingsWdReason} onChange={(e) => setSavingsWdReason(e.target.value)} placeholder="Reason..." className="mt-1" />
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedSavingsWd(null)}>Cancel</Button>
              <Button variant="gold" disabled={savingsWdLoading || !savingsWdStatus} onClick={async () => {
                if (!selectedSavingsWd || !savingsWdStatus) return;
                setSavingsWdLoading(true);
                try {
                  await supabase.from('savings_withdrawal_requests').update({ status: savingsWdStatus, admin_reason: savingsWdReason || null }).eq('id', selectedSavingsWd.id);
                  await supabase.from('notifications').insert({ user_id: selectedSavingsWd.user_id, title: `Savings Withdrawal ${savingsWdStatus === 'approved' ? 'Approved' : 'Rejected'}`, message: `Your savings withdrawal has been ${savingsWdStatus}.${savingsWdReason ? ' Note: ' + savingsWdReason : ''}` });
                  await supabase.from('audit_logs').insert({ admin_id: user?.id, user_id: selectedSavingsWd.user_id, action: `savings_withdrawal_${savingsWdStatus}`, details: { reason: savingsWdReason } });
                  toast.success(`Savings withdrawal ${savingsWdStatus}`);
                  setSelectedSavingsWd(null);
                  fetchData();
                } catch (err: any) { toast.error(err.message || 'Failed'); } finally { setSavingsWdLoading(false); }
              }}>
                {savingsWdLoading ? <Loader2 className="animate-spin" size={16} /> : 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== CHAMA LEAVE REVIEW DIALOG ===== */}
        <Dialog open={!!selectedChamaLeave} onOpenChange={(o) => { if (!o) setSelectedChamaLeave(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Review Leave Request</DialogTitle></DialogHeader>
            {selectedChamaLeave && (() => {
              const group = chamaGroups.find((g: any) => g.id === selectedChamaLeave.group_id);
              return (
                <div className="space-y-4">
                  <div className="space-y-2 bg-muted/30 rounded-xl p-4 text-sm">
                    <div><span className="text-muted-foreground text-xs">Member:</span> <span className="font-medium">{getUserName(selectedChamaLeave.user_id)} · {getUserPhone(selectedChamaLeave.user_id)}</span></div>
                    <Separator />
                    <div><span className="text-muted-foreground text-xs">Group:</span> <span className="font-medium">{group?.name}</span></div>
                    <Separator />
                    <div><span className="text-muted-foreground text-xs">Chair Decision:</span> <span className="font-medium capitalize">{selectedChamaLeave.chairperson_decision}</span></div>
                    <Separator />
                    <div><span className="text-muted-foreground text-xs">Refund:</span> <span className="font-medium">{formatCurrency(selectedChamaLeave.refund_amount || 0)}</span></div>
                    {selectedChamaLeave.reason && <><Separator /><div><span className="text-muted-foreground text-xs">Reason:</span> <span className="font-medium">{selectedChamaLeave.reason}</span></div></>}
                  </div>
                  <div>
                    <Label className="text-xs">Admin Decision</Label>
                    <Select value={chamaLeaveAction} onValueChange={setChamaLeaveAction}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select action" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Approve Leave</SelectItem>
                        <SelectItem value="rejected">Reject</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Admin Note</Label>
                    <Textarea value={chamaLeaveReason} onChange={(e) => setChamaLeaveReason(e.target.value)} placeholder="Reason..." className="mt-1" />
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedChamaLeave(null)}>Cancel</Button>
              <Button variant="gold" disabled={chamaLeaveLoading || !chamaLeaveAction} onClick={async () => {
                if (!selectedChamaLeave || !chamaLeaveAction) return;
                setChamaLeaveLoading(true);
                try {
                  const newStatus = chamaLeaveAction === 'approved' ? 'approved' : 'rejected_by_admin';
                  await supabase.from('chama_leave_requests').update({ admin_status: chamaLeaveAction, admin_reason: chamaLeaveReason || null, status: newStatus }).eq('id', selectedChamaLeave.id);
                  if (chamaLeaveAction === 'approved') {
                    await supabase.from('chama_members').update({ is_active: false, remove_reason: 'Left group (approved)' } as any).eq('group_id', selectedChamaLeave.group_id).eq('user_id', selectedChamaLeave.user_id);
                  }
                  const group = chamaGroups.find((g: any) => g.id === selectedChamaLeave.group_id);
                  await supabase.from('notifications').insert({ user_id: selectedChamaLeave.user_id, title: `Leave Request ${chamaLeaveAction === 'approved' ? 'Approved' : 'Rejected'}`, message: `Your leave from "${group?.name}" was ${chamaLeaveAction}.${chamaLeaveReason ? ' Note: ' + chamaLeaveReason : ''}` });
                  await supabase.from('audit_logs').insert({ admin_id: user?.id, user_id: selectedChamaLeave.user_id, action: `chama_leave_${chamaLeaveAction}`, details: { group: group?.name, reason: chamaLeaveReason } });
                  toast.success(`Leave request ${chamaLeaveAction}`);
                  setSelectedChamaLeave(null);
                  fetchData();
                } catch (err: any) { toast.error(err.message || 'Failed'); } finally { setChamaLeaveLoading(false); }
              }}>
                {chamaLeaveLoading ? <Loader2 className="animate-spin" size={16} /> : 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
