import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Shield, Clock, Users, CheckCircle, Star, Zap, Phone, Mail, MapPin,
  ArrowUpRight, FileCheck, CreditCard, HeartHandshake, ChevronDown, Wallet, BadgeCheck,
  Globe, TrendingUp, Award, PiggyBank, UserPlus, HandCoins, FileText, MessageSquare,
  Smartphone, Heart, Target, Lock, Send, ArrowDownUp, Landmark, Eye, ShieldCheck,
  Building2, Banknote, QrCode, Menu, X, Sparkles,
} from 'lucide-react';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { cn } from '@/lib/utils';

/* ───── Animation Variants ───── */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

/* ───── Static Data ───── */
const faqs = [
  { q: 'What is a Chama?', a: 'A Chama is a traditional Kenyan savings group where members pool money together. DASNET VENTURES LTD digitizes this process, making it easier to manage contributions, track savings, and handle withdrawals securely.' },
  { q: 'How do I create a Chama group?', a: 'Sign up for a free account, navigate to Chama Groups, and click "New Group." You become the Chairperson automatically. Then search members by phone number and assign roles like Secretary and Treasurer.' },
  { q: 'How are savings collected?', a: 'Your group chooses daily, weekly, or monthly contributions. Members pay via M-Pesa STK push directly from the app. Everyone can see who has paid and who is in arrears.' },
  { q: 'How do withdrawals work?', a: 'The Treasurer initiates a withdrawal request. All three leaders (Chairperson, Secretary, Treasurer) must approve. Once all approve, it goes to admin for final processing.' },
  { q: 'Can I also get a personal loan?', a: 'Yes! DASNET VENTURES LTD also offers personal loans — Biashara, Elimu, Youth Fund and more. Apply directly from your dashboard after activating your account.' },
  { q: 'Is my money and data safe?', a: 'Absolutely. We use bank-grade encryption, multi-level approval workflows, and digital signature tracking. Every transaction is recorded with timestamps for full transparency.' },
  { q: 'How does the wallet work?', a: 'Your digital wallet lets you deposit via M-Pesa, send money to other members, request payments, and receive loan disbursements. All transactions are tracked in real-time.' },
  { q: 'What is the Emergency Fund?', a: 'Each Chama group has an emergency fund. Members contribute a small monthly fee (as low as KES 50) which is auto-deducted from savings. This fund covers group emergencies and platform hosting.' },
];

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Wallet', href: '#wallet' },
  { label: 'Loans', href: '#loans' },
  { label: 'FAQ', href: '#faq' },
];

const features = [
  { icon: PiggyBank, title: 'Smart Savings', desc: 'Daily, weekly, or monthly contributions via M-Pesa STK push.' },
  { icon: Wallet, title: 'Digital Wallet', desc: 'Deposit, transfer, request money with full transaction history.' },
  { icon: HandCoins, title: 'Secure Withdrawals', desc: 'Multi-level approval: leaders approve, Admin releases.' },
  { icon: Heart, title: 'Harambee', desc: 'Create public fundraising campaigns via M-Pesa.' },
  { icon: Landmark, title: 'Personal Loans', desc: 'Apply for Biashara, Elimu, or Youth Fund loans.' },
  { icon: Users, title: 'Role Management', desc: 'Assign Chairperson, Secretary, and Treasurer.' },
  { icon: Shield, title: 'Emergency Fund', desc: 'Automatic monthly emergency contributions.' },
  { icon: Zap, title: 'Real-Time Alerts', desc: 'Instant notifications for payments and approvals.' },
];

const steps = [
  { step: '01', icon: FileCheck, title: 'Create Account', desc: 'Sign up with your phone number and ID.' },
  { step: '02', icon: Users, title: 'Create a Group', desc: 'Name your Chama and become Chairperson.' },
  { step: '03', icon: UserPlus, title: 'Add Members', desc: 'Search by phone and assign roles.' },
  { step: '04', icon: PiggyBank, title: 'Start Saving', desc: 'Members pay via M-Pesa STK push.' },
];

const walletFeatures = [
  { icon: QrCode, title: 'M-Pesa Deposit', desc: 'Top up your wallet instantly via STK push' },
  { icon: Send, title: 'Peer-to-Peer Transfers', desc: 'Send money to any registered member' },
  { icon: ArrowDownUp, title: 'Money Requests', desc: 'Request payments from other users' },
  { icon: TrendingUp, title: 'Transaction History', desc: 'Full audit trail of every transaction' },
];

const loanProducts = [
  { name: 'Biashara Loan', desc: 'For business growth and expansion', rate: '10%', max: 'KES 500,000', icon: Building2 },
  { name: 'Elimu Loan', desc: 'Education financing for students', rate: '8%', max: 'KES 300,000', icon: FileText },
  { name: 'Youth Fund', desc: 'Empowering young entrepreneurs', rate: '8%', max: 'KES 200,000', icon: TrendingUp },
];

const securityFeatures = [
  { icon: Lock, title: 'End-to-End Encryption', desc: 'Data encrypted in transit and at rest' },
  { icon: ShieldCheck, title: 'Multi-Level Approval', desc: '3-leader approval for withdrawals' },
  { icon: BadgeCheck, title: 'KYC Verification', desc: 'ID and document verification' },
  { icon: Eye, title: 'Full Audit Trail', desc: 'Every transaction timestamped' },
  { icon: Shield, title: 'Row-Level Security', desc: 'Database policies isolate data' },
  { icon: FileCheck, title: 'Digital Signatures', desc: 'Tamper-proof signed records' },
];

const testimonials = [
  { name: 'Grace Wanjiru', role: 'Chairperson, Umoja Savings', text: 'We used to track contributions in a notebook. Now everything is digital — transparency and trust have never been higher.', rating: 5 },
  { name: 'Peter Ochieng', role: 'Treasurer, Vijana Group', text: 'The withdrawal approval system is brilliant. No room for disputes, and M-Pesa integration makes collection effortless.', rating: 5 },
  { name: 'Amina Hassan', role: 'Member, Baraka Chama', text: 'I love the wallet feature and instant notifications. The digital signature gives us real peace of mind.', rating: 5 },
];

const trustBadges = [
  { icon: Lock, label: 'SSL Encrypted' },
  { icon: ShieldCheck, label: 'Bank-Grade' },
  { icon: Banknote, label: 'M-Pesa' },
  { icon: BadgeCheck, label: 'KYC Verified' },
  { icon: Eye, label: 'Transparent' },
  { icon: Building2, label: 'Registered' },
];

const footerColumns = [
  { title: 'Product', links: [
    { label: 'Chama Groups', href: '/signup' },
    { label: 'Digital Wallet', href: '/signup' },
    { label: 'Personal Loans', href: '/signup' },
    { label: 'Harambee', href: '/signup' },
  ]},
  { title: 'Company', links: [
    { label: 'About Us', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'Support', href: '/support' },
    { label: 'Terms', href: '/terms' },
  ]},
  { title: 'Resources', links: [
    { label: 'FAQ', href: '#faq' },
    { label: 'Privacy Policy', href: '/privacy.html' },
    { label: 'Explore Chamas', href: '/signup' },
  ]},
];

/* ───── Component ───── */
export default function Index() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt();
  const [activeHarambees, setActiveHarambees] = useState<any[]>([]);
  const [publicChamas, setPublicChamas] = useState<any[]>([]);
  const [liveStats, setLiveStats] = useState({ members: 0, groups: 0, savings: 0 });

  useEffect(() => {
    const fetchData = async () => {
      const { data: harambees } = await supabase
        .from('chama_harambees')
        .select('id, title, beneficiary_name, description, target_amount, raised_amount, deadline, order_number, status, is_public, group_id, image_urls')
        .eq('status', 'active').eq('is_public', true)
        .order('created_at', { ascending: false }).limit(10);
      setActiveHarambees(harambees || []);

      const { data: chamas } = await supabase
        .from('chama_groups')
        .select('id, name, description, contribution_amount, contribution_frequency, max_members, profile_image_url, is_public')
        .eq('is_public', true)
        .order('created_at', { ascending: false }).limit(6);
      setPublicChamas(chamas || []);

      const [membersRes, groupsRes, savingsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('chama_groups').select('id', { count: 'exact', head: true }),
        supabase.from('chama_savings').select('amount'),
      ]);
      setLiveStats({
        members: membersRes.count || 0,
        groups: groupsRes.count || 0,
        savings: savingsRes.data?.reduce((s, r) => s + Number(r.amount || 0), 0) || 0,
      });
    };
    fetchData();
  }, []);

  const formatCompact = (n: number) => {
    if (n >= 1000000) return `KES ${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `KES ${(n / 1000).toFixed(0)}K`;
    return `KES ${n.toLocaleString()}`;
  };

  const hasStats = liveStats.members > 0 || liveStats.groups > 0 || liveStats.savings > 0;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[hsl(218,55%,6%)] antialiased text-white/90 selection:bg-accent/25 selection:text-white">

      {/* ───── HEADER ───── */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-3 sm:mx-6 mt-3 sm:mt-4">
          <div className="rounded-2xl sm:rounded-full bg-[hsl(218,55%,8%)]/85 backdrop-blur-xl border border-white/[0.06] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.4)] max-w-6xl mx-auto">
            <div className="flex items-center justify-between h-[56px] sm:h-[60px] pl-4 pr-2.5 sm:pl-6 sm:pr-3">
              <div className="flex items-center gap-2.5">
                <Logo size="md" variant="white" />
              </div>
              <nav className="hidden md:flex items-center gap-0.5 text-[13px] font-medium text-white/60">
                {navLinks.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="px-3 py-1.5 rounded-full hover:text-white transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Link to="/auth" className="hidden sm:inline-flex">
                  <Button variant="ghost" size="sm" className="text-[13px] font-medium text-white/70 hover:text-white hover:bg-white/[0.04] rounded-full px-3.5 h-8">
                    Sign in
                  </Button>
                </Link>
                <Link to="/signup" className="hidden sm:inline-flex">
                  <Button
                    variant="gold"
                    size="sm"
                    className="text-[13px] font-semibold rounded-full pl-3.5 pr-3 h-8 gap-1 !shadow-none"
                  >
                    Get started <ArrowRight size={13} />
                  </Button>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-white/85 hover:bg-white/[0.05] transition-colors"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="md:hidden mx-3 mt-2"
            >
              <div className="rounded-2xl bg-[hsl(218,55%,8%)]/95 backdrop-blur-xl border border-white/[0.06] p-2 space-y-0.5 shadow-2xl shadow-black/40">
                {navLinks.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2.5 rounded-xl text-sm font-medium text-white/85 hover:bg-white/[0.05] transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="pt-2 mt-1.5 border-t border-white/[0.06] flex gap-2 px-1 pb-1">
                  <Link to="/auth" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full text-white/85 hover:bg-white/[0.05] rounded-full">
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/signup" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="gold" size="sm" className="w-full rounded-full !shadow-none font-semibold">
                      Get started
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ───── HERO ───── */}
      <section className="relative pt-28 pb-20 sm:pt-36 sm:pb-28 md:pt-44 md:pb-36 px-4 overflow-hidden bg-[hsl(218,55%,6%)]">
        {/* Subtle ambient glow — single, restrained */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,_hsl(42_88%_55%_/_0.07),_transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_50%_100%,_hsl(218_72%_30%_/_0.25),_transparent_70%)]" />

        <motion.div className="container max-w-4xl text-center relative z-10" initial="hidden" animate="visible" variants={stagger}>
          <motion.div
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.07] text-[12px] mb-7"
          >
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-bold uppercase tracking-wider">
              <Sparkles size={9} /> New
            </span>
            <span className="text-white/70">All-in-one Chama, Wallet, Loans &amp; Harambee</span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="font-display text-[2.25rem] leading-[1.05] sm:text-5xl md:text-6xl lg:text-[4.25rem] lg:leading-[1.04] font-semibold text-white mb-6 tracking-[-0.03em]"
          >
            Banking infrastructure
            <br />
            <span className="text-white/95">for modern </span>
            <span className="text-accent">Kenya</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-[15px] sm:text-base md:text-[17px] text-white/55 max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Manage Chama groups, digital wallets, personal loans, and Harambee fundraising in one secure platform — built on M-Pesa, designed for trust.
          </motion.p>

          <motion.div
            variants={fadeUp}
            custom={3}
            className="flex flex-col sm:flex-row items-center justify-center gap-2.5 px-4 sm:px-0"
          >
            <Link to="/signup" className="w-full sm:w-auto">
              <Button
                variant="gold"
                size="lg"
                className="w-full sm:w-auto min-w-[200px] rounded-full font-semibold gap-2 h-12 text-[14px] !shadow-none hover:brightness-105 transition-all"
              >
                Open free account <ArrowRight size={16} />
              </Button>
            </Link>
            <Link to="/auth" className="w-full sm:w-auto">
              <Button
                variant="ghost"
                size="lg"
                className="w-full sm:w-auto min-w-[160px] rounded-full text-white/85 hover:text-white hover:bg-white/[0.05] border border-white/[0.08] h-12 text-[14px] font-medium gap-2"
              >
                Sign in
              </Button>
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} custom={4} className="mt-5">
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 text-[13px] text-white/55 hover:text-accent transition-colors"
            >
              <HeartHandshake size={14} /> or start a fundraiser
              <ArrowRight size={12} />
            </Link>
          </motion.div>

          {/* Stats — only show when we have real data */}
          {hasStats && (
            <motion.div
              variants={fadeUp}
              custom={5}
              className="max-w-2xl mx-auto mt-16 sm:mt-20 pt-10 border-t border-white/[0.06]"
            >
              <div className="grid grid-cols-3 divide-x divide-white/[0.05]">
                {[
                  { value: liveStats.members > 0 ? `${liveStats.members.toLocaleString()}+` : null, label: 'Active members' },
                  { value: liveStats.groups > 0 ? `${liveStats.groups.toLocaleString()}+` : null, label: 'Chama groups' },
                  { value: liveStats.savings > 0 ? formatCompact(liveStats.savings) : null, label: 'Savings managed' },
                ].map((stat, i) => (
                  <div key={i} className="text-center px-2 sm:px-4">
                    <p className="text-2xl sm:text-3xl md:text-[2.25rem] font-semibold text-white font-display tracking-[-0.02em]">
                      {stat.value ?? <span className="text-white/25">·</span>}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-white/45 mt-2 uppercase tracking-[0.16em] font-medium">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* ───── TRUST BAR ───── */}
      <section className="py-7 sm:py-8 px-4 bg-[hsl(218,55%,5%)] border-y border-white/[0.04]">
        <div className="container max-w-5xl">
          <div className="flex flex-wrap items-center justify-center gap-x-8 sm:gap-x-12 gap-y-3">
            {trustBadges.map((badge, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 text-white/45 hover:text-white/70 transition-colors"
              >
                <badge.icon size={13} className="text-white/40 shrink-0" />
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em]">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
            {/* ───── ACTIVE HARAMBEES ───── */}
      {activeHarambees.length > 0 && (
        <section className="py-16 sm:py-24 px-4 bg-[hsl(218,55%,7%)] relative">
          <div className="container max-w-6xl relative z-10">
            <motion.div
              className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 sm:mb-12"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/60 mb-4 border border-white/[0.06]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> Live appeals
                </span>
                <h2 className="font-display text-[1.75rem] sm:text-[2.25rem] md:text-[2.5rem] font-semibold mb-2 text-white tracking-[-0.025em] leading-[1.1]">
                  People need your help
                </h2>
                <p className="text-white/55 max-w-lg text-[14px] sm:text-[15px] leading-relaxed">
                  Verified fundraisers from real Kenyans. Every contribution counts.
                </p>
              </div>
              <Link to="/signup" className="hidden sm:inline-flex">
                <Button variant="ghost" size="sm" className="text-white/65 hover:text-accent hover:bg-transparent gap-1 -mr-2 text-[13px]">
                  View all <ArrowRight size={13} />
                </Button>
              </Link>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeHarambees.map((h, i) => {
                const progress = h.target_amount > 0 ? Math.min(100, Math.round((h.raised_amount / h.target_amount) * 100)) : 0;
                const daysLeft = h.deadline ? Math.max(0, Math.ceil((new Date(h.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
                return (
                  <motion.div
                    key={h.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.04, duration: 0.45 }}
                  >
                    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 overflow-hidden flex flex-col h-full">
                      <div className="p-5 flex-1 space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/15 flex items-center justify-center shrink-0">
                            <Heart size={15} className="text-red-400" />
                          </div>
                          {daysLeft !== null && (
                            <span className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-md',
                              daysLeft <= 3 ? 'bg-red-500/12 text-red-400' : 'bg-white/[0.04] text-white/55'
                            )}>
                              {daysLeft > 0 ? `${daysLeft}d left` : 'Ended'}
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-display font-semibold text-[15px] text-white leading-snug tracking-[-0.01em]">
                            Harambee for {h.beneficiary_name || h.title}
                          </h3>
                          {h.description && (
                            <p className="text-[12.5px] text-white/50 mt-2 line-clamp-2 leading-relaxed">{h.description}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-baseline text-[11px]">
                            <span className="text-white/50 font-medium">Raised</span>
                            <span className="font-semibold text-accent text-[13px]">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                          <div className="flex justify-between text-[11px] pt-0.5">
                            <span className="text-white/85 font-medium">KES {(h.raised_amount || 0).toLocaleString()}</span>
                            <span className="text-white/40">of {(h.target_amount || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="px-5 py-3 bg-white/[0.015] border-t border-white/[0.04] flex gap-2">
                        <Link to={`/harambee/${h.order_number}`} className="flex-1">
                          <Button variant="ghost" size="sm" className="w-full text-white/70 hover:text-white hover:bg-white/[0.04] text-[12px] h-8 rounded-lg font-medium">
                            Details
                          </Button>
                        </Link>
                        <Link to={`/harambee/${h.order_number}`} className="flex-1">
                          <Button variant="gold" size="sm" className="w-full text-[12px] h-8 rounded-lg font-semibold !shadow-none">
                            Contribute
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="text-center mt-10">
              <Link to="/signup">
                <Button variant="ghost" size="default" className="text-white/85 hover:text-white border border-white/[0.08] hover:bg-white/[0.04] gap-2 rounded-full font-medium px-5 h-10">
                  <HeartHandshake size={15} /> Start your own fundraiser
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ───── PUBLIC CHAMAS ───── */}
      {publicChamas.length > 0 && (
        <section className="py-16 sm:py-24 px-4 bg-[hsl(218,55%,6%)]">
          <div className="container max-w-6xl">
            <motion.div
              className="text-center mb-10 sm:mb-12 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.16em] text-accent/85 mb-3">
                Community
              </span>
              <h2 className="font-display text-[1.75rem] sm:text-[2.25rem] md:text-[2.5rem] font-semibold mb-3 text-white tracking-[-0.025em] leading-[1.1]">
                Join a public Chama
              </h2>
              <p className="text-white/55 text-[14px] sm:text-[15px] leading-relaxed">
                Explore open savings groups and start your journey with savers across Kenya.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicChamas.map((chama, i) => (
                <motion.div
                  key={chama.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
                      {chama.profile_image_url ? (
                        <img src={chama.profile_image_url} alt={chama.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users size={16} className="text-white/55" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold text-[15px] text-white truncate tracking-[-0.01em]">{chama.name}</h3>
                      {chama.max_members && (
                        <p className="text-[11px] text-white/40 mt-0.5">Up to {chama.max_members} members</p>
                      )}
                    </div>
                  </div>
                  {chama.description && (
                    <p className="text-[12.5px] text-white/55 leading-relaxed mb-4 line-clamp-2">{chama.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-3.5 border-t border-white/[0.05]">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-white/40 font-medium">Contribution</p>
                      <p className="text-[12.5px] text-white/85 font-semibold mt-0.5">
                        KES {chama.contribution_amount?.toLocaleString()}
                        <span className="text-white/40 font-normal"> / {chama.contribution_frequency}</span>
                      </p>
                    </div>
                    <Link to="/signup">
                      <span className="text-accent font-semibold hover:opacity-80 flex items-center gap-1 text-[12.5px]">
                        Join <ArrowRight size={11} />
                      </span>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link to="/signup">
                <Button variant="ghost" size="default" className="text-white/85 hover:text-white border border-white/[0.08] hover:bg-white/[0.04] rounded-full gap-2 px-5 h-10">
                  Explore all groups <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ───── FEATURES ───── */}
      <section id="features" className="py-20 sm:py-28 md:py-32 px-4 bg-[hsl(218,55%,7%)] relative">
        <div className="container max-w-6xl">
          <motion.div
            className="text-center mb-14 sm:mb-16 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.16em] text-accent/85 mb-3">
              Platform
            </span>
            <h2 className="font-display text-[1.75rem] sm:text-[2.25rem] md:text-[2.75rem] font-semibold mb-4 text-white tracking-[-0.025em] leading-[1.08]">
              Everything you need,<br className="hidden sm:inline" /> one platform
            </h2>
            <p className="text-white/55 text-[14px] sm:text-[15px] leading-relaxed">
              From group savings to personal wallets — a complete digital financial ecosystem built for Kenya.
            </p>
          </motion.div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03, duration: 0.45 }}
                className="p-5 sm:p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03] transition-all duration-300"
              >
                <div className="w-10 h-10 mb-4 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <feature.icon className="text-accent" size={18} />
                </div>
                <h3 className="font-display font-semibold text-[14.5px] mb-1.5 text-white tracking-[-0.01em]">{feature.title}</h3>
                <p className="text-white/55 text-[12.5px] leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── HOW IT WORKS ───── */}
      <section id="how-it-works" className="py-20 sm:py-28 md:py-32 px-4 bg-[hsl(218,55%,6%)] relative">
        <div className="container max-w-6xl">
          <motion.div
            className="text-center mb-16 sm:mb-20 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.16em] text-accent/85 mb-3">
              Getting started
            </span>
            <h2 className="font-display text-[1.75rem] sm:text-[2.25rem] md:text-[2.75rem] font-semibold mb-4 text-white tracking-[-0.025em] leading-[1.08]">
              Start in 4 simple steps
            </h2>
            <p className="text-white/55 text-[14px] sm:text-[15px] leading-relaxed">
              From sign-up to your first savings deposit in minutes. No paperwork. No queues.
            </p>
          </motion.div>

          <div className="grid gap-10 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 relative">
            <div className="hidden md:block absolute top-7 left-[14%] right-[14%] h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
            {steps.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.45 }}
                className="relative text-center"
              >
                <div className="relative w-14 h-14 mx-auto mb-5">
                  <div className="relative w-14 h-14 rounded-2xl bg-[hsl(218,55%,9%)] border border-white/[0.08] flex items-center justify-center">
                    <item.icon className="text-accent" size={20} />
                  </div>
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[9px] font-bold">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-display font-semibold text-[15px] sm:text-base mb-2 text-white tracking-[-0.01em]">{item.title}</h3>
                <p className="text-white/50 text-[13px] leading-relaxed max-w-[220px] mx-auto">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── WALLET ───── */}
      <section id="wallet" className="py-20 sm:py-28 md:py-32 px-4 bg-[hsl(218,55%,7%)] relative overflow-hidden">
        <div className="container max-w-6xl relative z-10">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400/85 mb-3">
                Wallet
              </span>
              <h2 className="font-display text-[1.75rem] sm:text-[2.25rem] md:text-[2.75rem] font-semibold mb-4 text-white tracking-[-0.025em] leading-[1.08]">
                Your money,<br />your control
              </h2>
              <p className="text-white/55 mb-8 text-[14px] sm:text-[15px] leading-relaxed max-w-md">
                A full-featured digital wallet powered by M-Pesa. Deposit, transfer, request payments, and track every shilling in real time.
              </p>
              <div className="space-y-2.5">
                {walletFeatures.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center shrink-0">
                      <item.icon size={15} className="text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-[13.5px] text-white mb-0.5">{item.title}</h4>
                      <p className="text-[12px] text-white/55 leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative"
            >
              <div className="relative rounded-2xl p-6 sm:p-7 bg-gradient-to-br from-[hsl(218,55%,9%)] to-[hsl(218,55%,7%)] border border-white/[0.07] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between mb-7">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/45 font-semibold">Wallet balance</p>
                    <p className="text-[2rem] sm:text-[2.25rem] font-display font-semibold text-white mt-2 tracking-[-0.02em]">
                      KES <span className="text-emerald-400">24,500</span>
                    </p>
                    <p className="text-[11px] text-emerald-400/85 mt-1.5 flex items-center gap-1 font-medium">
                      <TrendingUp size={11} /> +KES 4,200 this week
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                    <Wallet size={18} className="text-emerald-400" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {[
                    { icon: ArrowUpRight, label: 'Deposit' },
                    { icon: Send, label: 'Transfer' },
                    { icon: ArrowDownUp, label: 'Request' },
                  ].map((action, i) => (
                    <button
                      key={i}
                      className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-colors"
                    >
                      <action.icon size={15} className="mx-auto text-emerald-400 mb-1.5" />
                      <p className="text-[11px] text-white/75 font-semibold">{action.label}</p>
                    </button>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/45 font-semibold mb-3">Recent activity</p>
                  <div className="space-y-1">
                    {[
                      { name: 'Grace W.', type: 'Received', amount: '+1,200', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: ArrowDownUp },
                      { name: 'M-Pesa Top Up', type: 'Deposit', amount: '+5,000', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: ArrowUpRight },
                      { name: 'Peter O.', type: 'Sent', amount: '-800', color: 'text-red-400', bg: 'bg-red-500/10', icon: Send },
                    ].map((tx, i) => (
                      <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${tx.bg} flex items-center justify-center`}>
                            <tx.icon size={12} className={tx.color} />
                          </div>
                          <div>
                            <p className="text-[12.5px] text-white/85 font-medium">{tx.name}</p>
                            <p className="text-[10px] text-white/45">{tx.type}</p>
                          </div>
                        </div>
                        <p className={`text-[13px] font-semibold ${tx.color}`}>{tx.amount}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
            {/* ───── LOANS ───── */}
      <section id="loans" className="py-20 sm:py-28 md:py-32 px-4 bg-[hsl(218,55%,6%)]">
        <div className="container max-w-6xl">
          <motion.div
            className="text-center mb-14 sm:mb-16 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.16em] text-accent/85 mb-3">
              Lending
            </span>
            <h2 className="font-display text-[1.75rem] sm:text-[2.25rem] md:text-[2.75rem] font-semibold mb-4 text-white tracking-[-0.025em] leading-[1.08]">
              Personal &amp; business loans
            </h2>
            <p className="text-white/55 text-[14px] sm:text-[15px] leading-relaxed">
              Access affordable credit for business growth, education, and personal needs — fully digital, fast approval.
            </p>
          </motion.div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            {loanProducts.map((product, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.45 }}
                className="rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 overflow-hidden flex flex-col"
              >
                <div className="p-6 flex-1">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-11 h-11 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                      <product.icon size={18} className="text-accent" />
                    </div>
                    <span className="text-[11px] font-semibold text-accent bg-accent/10 px-2 py-1 rounded-md">
                      {product.rate} p.a.
                    </span>
                  </div>
                  <h3 className="font-display font-semibold text-[17px] mb-1.5 text-white tracking-[-0.015em]">{product.name}</h3>
                  <p className="text-[13px] text-white/55 leading-relaxed">{product.desc}</p>
                </div>
                <div className="px-6 py-4 bg-white/[0.015] border-t border-white/[0.05] flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-white/45 uppercase tracking-[0.12em] font-medium">Up to</p>
                    <p className="font-display font-semibold text-white text-[14px] mt-0.5 tracking-[-0.01em]">{product.max}</p>
                  </div>
                  <Link to="/signup">
                    <Button variant="gold" size="sm" className="text-[12px] h-8 rounded-full font-semibold gap-1 px-3.5 !shadow-none">
                      Apply <ArrowRight size={12} />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── SECURITY ───── */}
      <section className="py-20 sm:py-28 md:py-32 px-4 bg-[hsl(218,55%,7%)] relative overflow-hidden">
        <div className="container max-w-6xl relative z-10">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55 mb-3">
                Security
              </span>
              <h2 className="font-display text-[1.75rem] sm:text-[2.25rem] md:text-[2.75rem] font-semibold mb-4 text-white tracking-[-0.025em] leading-[1.08]">
                Bank-grade security,<br />built in
              </h2>
              <p className="text-white/55 mb-6 text-[14px] sm:text-[15px] leading-relaxed max-w-md">
                Your money and data are protected with multiple layers of security at every level — from device to database.
              </p>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] max-w-md">
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                  <ShieldCheck size={16} className="text-white/70" />
                </div>
                <p className="text-[12.5px] text-white/65 leading-snug">
                  <span className="font-semibold text-white">256-bit encryption</span> — the same standard used by major banks.
                </p>
              </div>
            </motion.div>

            <div className="grid grid-cols-2 gap-2.5">
              {securityFeatures.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                >
                  <div className="w-8 h-8 rounded-md bg-white/[0.04] flex items-center justify-center mb-3">
                    <item.icon size={14} className="text-white/70" />
                  </div>
                  <h4 className="font-semibold text-[12.5px] text-white mb-1">{item.title}</h4>
                  <p className="text-[11px] text-white/50 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───── TESTIMONIALS ───── */}
      <section className="py-20 sm:py-28 md:py-32 px-4 bg-[hsl(218,55%,6%)] relative">
        <div className="container max-w-6xl">
          <motion.div
            className="text-center mb-14 sm:mb-16 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.16em] text-accent/85 mb-3">
              Testimonials
            </span>
            <h2 className="font-display text-[1.75rem] sm:text-[2.25rem] md:text-[2.75rem] font-semibold mb-4 text-white tracking-[-0.025em] leading-[1.08]">
              Trusted by Kenyans
            </h2>
            <p className="text-white/55 text-[14px] sm:text-[15px] leading-relaxed">
              Real stories from groups already managing their savings with us.
            </p>
          </motion.div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors flex flex-col"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, si) => (
                    <Star key={si} size={13} className="text-accent fill-accent" />
                  ))}
                </div>
                <p className="text-[13.5px] text-white/75 leading-relaxed mb-6 flex-1">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.05]">
                  <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/85 text-[11px] font-semibold">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[12.5px] text-white truncate">{t.name}</p>
                    <p className="text-[11px] text-white/50 truncate">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section id="faq" className="py-20 sm:py-28 md:py-32 px-4 bg-[hsl(218,55%,7%)]">
        <div className="container max-w-3xl">
          <motion.div
            className="text-center mb-12 sm:mb-14"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.16em] text-accent/85 mb-3">
              FAQ
            </span>
            <h2 className="font-display text-[1.75rem] sm:text-[2.25rem] md:text-[2.75rem] font-semibold mb-4 text-white tracking-[-0.025em] leading-[1.08]">
              Common questions
            </h2>
            <p className="text-white/55 text-[14px] sm:text-[15px] leading-relaxed">
              Everything you need to know about our digital platform.
            </p>
          </motion.div>

          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className={cn(
                    'w-full text-left p-5 rounded-xl bg-white/[0.02] border transition-all duration-200',
                    openFaq === i
                      ? 'border-white/[0.14]'
                      : 'border-white/[0.06] hover:border-white/[0.1]'
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-[14px] sm:text-[14.5px] text-white tracking-[-0.005em]">{faq.q}</h3>
                    <ChevronDown
                      size={16}
                      className={cn(
                        'text-white/55 shrink-0 transition-transform duration-300',
                        openFaq === i && 'rotate-180 text-accent'
                      )}
                    />
                  </div>
                  <motion.div
                    initial={false}
                    animate={{ height: openFaq === i ? 'auto' : 0, opacity: openFaq === i ? 1 : 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="text-[13px] text-white/60 leading-relaxed mt-4 pr-8">{faq.a}</p>
                  </motion.div>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── DOWNLOAD APP ───── */}
      {!isInstalled && canInstall && (
        <section className="py-12 sm:py-16 px-4 bg-[hsl(218,55%,6%)]">
          <div className="container max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl p-7 sm:p-9 text-center bg-white/[0.02] border border-white/[0.07]"
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-accent/10 border border-accent/15 flex items-center justify-center">
                <Smartphone size={20} className="text-accent" />
              </div>
              <h3 className="font-display text-[1.4rem] sm:text-[1.75rem] font-semibold text-white mb-2 tracking-[-0.02em]">
                Get the Dasnet app
              </h3>
              <p className="text-white/55 max-w-md mx-auto mb-6 text-[13.5px] leading-relaxed">
                Install for a faster experience — offline support and instant notifications.
              </p>
              <Button
                variant="gold"
                size="lg"
                onClick={promptInstall}
                className="rounded-full font-semibold gap-2 h-11 px-5 !shadow-none"
              >
                <Smartphone size={15} /> Install app
              </Button>
            </motion.div>
          </div>
        </section>
      )}

      {/* ───── CTA ───── */}
      <section className="py-20 sm:py-28 px-4 bg-[hsl(218,55%,7%)]">
        <div className="container max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl p-10 sm:p-14 md:p-16 text-center relative overflow-hidden bg-gradient-to-br from-[hsl(218,55%,9%)] to-[hsl(218,55%,7%)] border border-white/[0.08]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,_hsl(42_88%_55%_/_0.08),_transparent_70%)]" />
            <div className="relative z-10">
              <h2 className="font-display text-[1.85rem] sm:text-[2.25rem] md:text-[3rem] font-semibold text-white mb-4 tracking-[-0.025em] leading-[1.05]">
                Start your financial<br className="hidden sm:inline" /> journey today
              </h2>
              <p className="text-white/55 max-w-lg mx-auto mb-8 text-[14px] sm:text-[15px] leading-relaxed">
                Join thousands of Kenyans managing their group savings, personal wallets, and loans digitally.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <Link to="/signup" className="w-full sm:w-auto">
                  <Button
                    variant="gold"
                    size="lg"
                    className="w-full sm:w-auto min-w-[200px] rounded-full font-semibold gap-2 h-12 text-[14px] !shadow-none"
                  >
                    Create free account <ArrowRight size={15} />
                  </Button>
                </Link>
                <Link to="/contact" className="w-full sm:w-auto">
                  <Button
                    variant="ghost"
                    size="lg"
                    className="w-full sm:w-auto min-w-[160px] rounded-full text-white/85 hover:text-white border border-white/[0.08] hover:bg-white/[0.04] h-12 text-[14px] font-medium"
                  >
                    Talk to us
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-7 text-[11.5px] text-white/45">
                <span className="flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-accent" /> Free to start
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-accent" /> No setup fees
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-accent" /> Cancel anytime
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="bg-[hsl(218,55%,5%)] text-white pt-16 sm:pt-20 pb-8 px-4 border-t border-white/[0.05]">
        <div className="container max-w-6xl">
          <div className="grid gap-10 sm:gap-8 grid-cols-2 md:grid-cols-5 mb-12">
            <div className="col-span-2">
              <Logo variant="white" size="md" />
              <p className="text-[13px] text-white/50 mt-4 leading-relaxed max-w-sm">
                Kenya's complete digital banking platform — Chama management, wallets, loans, and Harambee, all in one secure place.
              </p>
              <div className="flex items-center gap-2 mt-5">
                {[Globe, Phone, Mail].map((Icon, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <Icon size={13} className="text-white/55" />
                  </div>
                ))}
              </div>
            </div>

            {footerColumns.map((col, i) => (
              <div key={i}>
                <h4 className="text-[11px] font-semibold text-white uppercase tracking-[0.14em] mb-4">{col.title}</h4>
                <div className="space-y-2.5">
                  {col.links.map((link, li) => (
                    <a
                      key={li}
                      href={link.href}
                      className="block text-[13px] text-white/50 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11.5px] text-white/40">
              © {new Date().getFullYear()} DASNET VENTURES LTD. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-[11.5px] text-white/40">
              <Link to="/terms" className="hover:text-white/65 transition-colors">Terms</Link>
              <span className="text-white/15">·</span>
              <a href="/privacy.html" className="hover:text-white/65 transition-colors">Privacy</a>
              <span className="text-white/15">·</span>
              <Link to="/contact" className="hover:text-white/65 transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
      }
