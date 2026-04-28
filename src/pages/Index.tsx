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
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

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
  { name: 'Biashara Loan', desc: 'For business growth and expansion', rate: '10%', max: 'KES 500,000', icon: '🏪' },
  { name: 'Elimu Loan', desc: 'Education financing for students', rate: '8%', max: 'KES 300,000', icon: '📚' },
  { name: 'Youth Fund', desc: 'Empowering young entrepreneurs', rate: '8%', max: 'KES 200,000', icon: '🚀' },
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
  { name: 'Grace Wanjiru', role: 'Chairperson, Umoja Savings', text: 'We used to track contributions in a notebook. Now everything is digital—transparency and trust have never been higher.', rating: 5 },
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
    if (n >= 1000000) return `KES ${(n / 1000000).toFixed(1)}M+`;
    if (n >= 1000) return `KES ${(n / 1000).toFixed(0)}K+`;
    return `KES ${n.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[hsl(213,72%,7%)] antialiased selection:bg-accent/30 selection:text-white">

      {/* ───── HEADER ───── */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-3 sm:mx-6 mt-3 sm:mt-4">
          <div className="glass-dark rounded-full shadow-2xl shadow-black/20 max-w-6xl mx-auto border border-white/[0.08] backdrop-blur-xl">
            <div className="flex items-center justify-between h-[58px] sm:h-[64px] pl-5 pr-3 sm:pl-7 sm:pr-4">
              <Logo size="md" variant="white" />
              <nav className="hidden md:flex items-center gap-1 text-[13px] font-medium text-white/65">
                {navLinks.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="px-3.5 py-2 rounded-full hover:text-white hover:bg-white/[0.05] transition-all duration-200"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link to="/auth" className="hidden sm:inline-flex">
                  <Button variant="ghost" size="sm" className="text-[13px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06] rounded-full px-4">
                    Sign In
                  </Button>
                </Link>
                <Link to="/signup" className="hidden sm:inline-flex">
                  <Button variant="gold" size="sm" className="text-[13px] font-semibold shadow-gold rounded-full pl-4 pr-3 h-9 gap-1.5">
                    Get Started <ArrowRight size={14} />
                  </Button>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden w-10 h-10 flex items-center justify-center rounded-full text-white/85 hover:bg-white/[0.06] transition-colors"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="md:hidden mx-3 mt-2"
            >
              <div className="glass-dark rounded-3xl border border-white/[0.08] p-3 space-y-1 shadow-2xl shadow-black/30">
                {navLinks.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 rounded-2xl text-sm font-medium text-white/85 hover:bg-white/[0.06] transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="pt-3 mt-2 border-t border-white/[0.06] flex gap-2">
                  <Link to="/auth" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full border-white/10 text-white/85 hover:bg-white/[0.06] rounded-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/signup" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="gold" size="sm" className="w-full shadow-gold rounded-full">
                      Get Started
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ───── HERO ───── */}
      <section className="hero-gradient pt-32 pb-20 sm:pt-40 sm:pb-28 md:pt-48 md:pb-40 px-4 relative overflow-hidden noise-overlay">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(42_92%_56%_/_0.10),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(156_72%_38%_/_0.07),_transparent_55%)]" />
        <div className="absolute inset-0 grid-pattern opacity-[0.025]" />
        <div className="absolute top-24 right-[12%] w-80 h-80 bg-accent/10 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-24 left-[8%] w-[28rem] h-[28rem] bg-emerald-500/[0.05] rounded-full blur-[140px] animate-float" style={{ animationDelay: '3s' }} />

        <motion.div className="container max-w-5xl text-center relative z-10" initial="hidden" animate="visible" variants={stagger}>
          <motion.div
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/80 text-[12px] sm:text-[13px] mb-7 backdrop-blur-sm"
          >
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-bold uppercase tracking-wider">
              <Sparkles size={10} /> New
            </span>
            <span className="text-white/75">All-in-one Chama, Wallet, Loans &amp; Harambee</span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="font-display text-[2.4rem] sm:text-5xl md:text-6xl lg:text-[5rem] font-bold text-white mb-6 leading-[1.05] tracking-[-0.025em]"
          >
            Your Complete
            <br />
            <span className="bg-gradient-to-r from-accent via-gold-300 to-accent bg-clip-text text-transparent animate-gradient">
              Digital Banking
            </span>
            <br />
            <span className="text-white/95">Platform</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-[15px] sm:text-base md:text-lg text-white/65 max-w-2xl mx-auto mb-9 leading-relaxed px-2"
          >
            Manage Chama groups, digital wallets, personal loans, and Harambee fundraising — all with seamless M-Pesa integration and bank-grade security.
          </motion.p>

          <motion.div
            variants={fadeUp}
            custom={3}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4 sm:px-0"
          >
            <Link to="/signup" className="w-full sm:w-auto">
              <Button variant="hero" size="xl" className="w-full sm:w-auto min-w-[210px] shadow-gold-lg rounded-full font-semibold gap-2">
                Open Free Account <ArrowRight size={18} />
              </Button>
            </Link>
            <Link to="/auth" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="xl"
                className="w-full sm:w-auto border-white/15 text-white hover:bg-white/[0.06] backdrop-blur-sm min-w-[170px] rounded-full gap-2"
              >
                <Shield size={18} /> Sign In
              </Button>
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} custom={3.5} className="mt-5">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 text-[13px] text-accent hover:text-accent/80 transition-colors font-semibold"
            >
              <HeartHandshake size={16} /> Start a Fundraiser <ArrowRight size={14} />
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUp}
            custom={4}
            className="max-w-2xl mx-auto mt-14 sm:mt-20 pt-9 border-t border-white/[0.08]"
          >
            <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
              {[
                { value: liveStats.members > 0 ? `${liveStats.members.toLocaleString()}+` : '—', label: 'Active Members' },
                { value: liveStats.groups > 0 ? `${liveStats.groups.toLocaleString()}+` : '—', label: 'Chama Groups' },
                { value: liveStats.savings > 0 ? formatCompact(liveStats.savings) : '—', label: 'Savings Managed' },
              ].map((stat, i) => (
                <div key={i} className="text-center px-2 sm:px-4">
                  <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white font-display tracking-tight">{stat.value}</p>
                  <p className="text-[10px] sm:text-[11px] text-white/55 mt-1.5 uppercase tracking-[0.18em] font-semibold">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ───── TRUST BADGES ───── */}
      <section className="py-8 sm:py-10 px-4 bg-[hsl(213,72%,5%)] border-y border-white/[0.05]">
        <div className="container max-w-6xl">
          <p className="text-center text-[10px] uppercase tracking-[0.25em] text-white/35 font-semibold mb-5">
            Trusted &amp; Secure
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 sm:gap-6 items-center justify-center">
            {trustBadges.map((badge, i) => (
              <div
                key={i}
                className="flex items-center justify-center gap-2 text-white/55 hover:text-white/80 transition-colors group"
              >
                <badge.icon size={14} className="text-accent/60 group-hover:text-accent shrink-0 transition-colors" />
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.12em]">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
            {/* ───── ACTIVE HARAMBEES ───── */}
      {activeHarambees.length > 0 && (
        <section className="py-16 sm:py-24 px-4 bg-[hsl(213,72%,9%)] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(0_80%_50%_/_0.05),_transparent_55%)]" />
          <div className="container max-w-6xl relative z-10">
            <motion.div
              className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 sm:mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 mb-4">
                  <Heart size={11} className="fill-red-400" /> Live Appeals
                </span>
                <h2 className="font-display text-3xl sm:text-4xl md:text-[2.75rem] font-bold mb-2 text-white tracking-tight leading-tight">
                  People Need Your Help
                </h2>
                <p className="text-white/55 max-w-lg text-sm sm:text-[15px] leading-relaxed">
                  Verified fundraisers from real Kenyans. Every shilling counts.
                </p>
              </div>
              <Link to="/signup" className="hidden sm:inline-flex">
                <Button variant="ghost" size="sm" className="text-white/70 hover:text-accent hover:bg-transparent gap-1.5 -mr-2">
                  View all <ArrowRight size={14} />
                </Button>
              </Link>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeHarambees.map((h, i) => {
                const progress = h.target_amount > 0 ? Math.min(100, Math.round((h.raised_amount / h.target_amount) * 100)) : 0;
                const daysLeft = h.deadline ? Math.max(0, Math.ceil((new Date(h.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
                return (
                  <motion.div
                    key={h.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-red-500/25 hover:bg-white/[0.035] transition-all duration-300 overflow-hidden flex flex-col h-full group">
                      <div className="p-5 flex-1 space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/10 flex items-center justify-center shrink-0">
                            <Heart size={18} className="text-red-400" />
                          </div>
                          {daysLeft !== null && (
                            <span className={cn(
                              'text-[10px] font-bold px-2.5 py-1 rounded-full',
                              daysLeft <= 3 ? 'bg-red-500/20 text-red-400' : 'bg-white/[0.06] text-white/65'
                            )}>
                              {daysLeft > 0 ? `${daysLeft} days left` : 'Ended'}
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-base text-white leading-snug">
                            Harambee for <span className="text-accent">{h.beneficiary_name || h.title}</span>
                          </h3>
                          {h.description && (
                            <p className="text-[12px] text-white/50 mt-2 line-clamp-3 whitespace-pre-line leading-relaxed">{h.description}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-baseline text-[11px]">
                            <span className="text-white/55 uppercase tracking-wider font-semibold">Raised</span>
                            <span className="font-bold text-accent text-sm">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                          <div className="flex justify-between text-[11px] pt-0.5">
                            <span className="text-white font-semibold">KES {(h.raised_amount || 0).toLocaleString()}</span>
                            <span className="text-white/45">of KES {(h.target_amount || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="px-5 py-3.5 bg-white/[0.02] border-t border-white/[0.05] flex gap-2">
                        <Link to={`/harambee/${h.order_number}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full border-white/10 text-white hover:bg-white/[0.06] text-[12px] h-9 rounded-lg">
                            <Eye size={13} className="mr-1.5" /> Details
                          </Button>
                        </Link>
                        <Link to={`/harambee/${h.order_number}`} className="flex-1">
                          <Button variant="gold" size="sm" className="w-full shadow-gold text-[12px] h-9 rounded-lg font-semibold">
                            <Heart size={13} className="mr-1.5" /> Contribute
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
                <Button variant="hero" size="lg" className="shadow-gold-lg gap-2 rounded-full font-semibold px-7">
                  <HeartHandshake size={16} /> Start Your Own Fundraiser <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ───── PUBLIC CHAMAS ───── */}
      {publicChamas.length > 0 && (
        <section className="py-16 sm:py-24 px-4 bg-[hsl(213,72%,7%)]">
          <div className="container max-w-6xl">
            <motion.div
              className="text-center mb-10 sm:mb-12 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-accent/10 text-accent mb-4">
                Community
              </span>
              <h2 className="font-display text-3xl sm:text-4xl md:text-[2.75rem] font-bold mb-3 text-white tracking-tight leading-tight">
                Join a Public Chama
              </h2>
              <p className="text-white/55 text-sm sm:text-[15px] leading-relaxed">
                Explore open savings groups and start your journey with like-minded savers across Kenya.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicChamas.map((chama, i) => (
                <motion.div
                  key={chama.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="p-5 rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-accent/25 hover:bg-white/[0.035] transition-all duration-300"
                >
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {chama.profile_image_url ? (
                        <img src={chama.profile_image_url} alt={chama.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users size={18} className="text-accent" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-bold text-base text-white truncate">{chama.name}</h3>
                      {chama.max_members && (
                        <p className="text-[11px] text-white/45 mt-0.5">Up to {chama.max_members} members</p>
                      )}
                    </div>
                  </div>
                  {chama.description && (
                    <p className="text-[12px] text-white/55 leading-relaxed mb-4 line-clamp-2">{chama.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-3.5 border-t border-white/[0.06]">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Contribution</p>
                      <p className="text-[12px] text-white/85 font-semibold mt-0.5">
                        KES {chama.contribution_amount?.toLocaleString()}
                        <span className="text-white/45 font-normal"> / {chama.contribution_frequency}</span>
                      </p>
                    </div>
                    <Link to="/signup">
                      <span className="text-accent font-bold hover:underline flex items-center gap-1 text-[12px]">
                        Join <ArrowRight size={11} />
                      </span>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link to="/signup">
                <Button variant="outline" size="default" className="border-white/15 text-white hover:bg-white/[0.06] rounded-full gap-2">
                  Explore All Groups <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ───── FEATURES ───── */}
      <section id="features" className="py-16 sm:py-24 md:py-28 px-4 bg-[hsl(213,72%,9%)] relative">
        <div className="container max-w-6xl">
          <motion.div
            className="text-center mb-12 sm:mb-16 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-accent/10 text-accent mb-4">
              Platform Features
            </span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-[2.75rem] font-bold mb-3 text-white tracking-tight leading-tight">
              Everything you need,<br className="hidden sm:inline" /> one platform
            </h2>
            <p className="text-white/55 text-sm sm:text-[15px] leading-relaxed">
              From group savings to personal wallets — a complete digital financial ecosystem built for Kenya.
            </p>
          </motion.div>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.5 }}
                className="group relative p-5 sm:p-6 rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-accent/25 hover:bg-white/[0.04] transition-all duration-400 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 mb-4 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/10 flex items-center justify-center group-hover:scale-110 group-hover:border-accent/30 transition-all duration-500">
                    <feature.icon className="text-accent" size={20} />
                  </div>
                  <h3 className="font-display font-bold text-sm sm:text-base mb-1.5 text-white">{feature.title}</h3>
                  <p className="text-white/55 text-[12px] sm:text-[13px] leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── HOW IT WORKS ───── */}
      <section id="how-it-works" className="py-16 sm:py-24 md:py-28 px-4 bg-[hsl(213,72%,7%)] relative">
        <div className="container max-w-6xl">
          <motion.div
            className="text-center mb-14 sm:mb-20 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-accent/10 text-accent mb-4">
              Getting Started
            </span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-[2.75rem] font-bold mb-3 text-white tracking-tight leading-tight">
              Start in 4 simple steps
            </h2>
            <p className="text-white/55 text-sm sm:text-[15px] leading-relaxed">
              From sign-up to your first savings deposit in minutes. No paperwork. No queues.
            </p>
          </motion.div>

          <div className="grid gap-8 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 relative">
            <div className="hidden md:block absolute top-[44px] left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
            {steps.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="relative text-center"
              >
                <div className="relative w-20 h-20 mx-auto mb-5">
                  <div className="absolute inset-0 rounded-2xl bg-accent/20 blur-xl" />
                  <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-gold-300 flex items-center justify-center shadow-gold-lg">
                    <item.icon className="text-accent-foreground" size={26} />
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[hsl(213,72%,7%)] border border-accent/30 flex items-center justify-center text-[11px] font-bold text-accent">
                    {item.step}
                  </span>
                </div>
                <h3 className="font-display font-bold text-base sm:text-lg mb-2 text-white">{item.title}</h3>
                <p className="text-white/55 text-[13px] leading-relaxed max-w-[220px] mx-auto">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── WALLET & TRANSFERS ───── */}
      <section id="wallet" className="py-16 sm:py-24 md:py-28 px-4 bg-[hsl(213,72%,9%)] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center_right,_hsl(156_72%_38%_/_0.08),_transparent_60%)]" />
        <div className="container max-w-6xl relative z-10">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 mb-4">
                Digital Wallet
              </span>
              <h2 className="font-display text-3xl sm:text-4xl md:text-[2.75rem] font-bold mb-4 text-white tracking-tight leading-[1.1]">
                Your money,<br />your control
              </h2>
              <p className="text-white/60 mb-8 text-sm sm:text-[15px] leading-relaxed">
                A full-featured digital wallet powered by M-Pesa. Deposit, transfer to other members, request payments, and track every shilling in real time.
              </p>
              <div className="space-y-3">
                {walletFeatures.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.025] border border-white/[0.06] hover:border-emerald-500/25 hover:bg-white/[0.035] transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/10 flex items-center justify-center shrink-0">
                      <item.icon size={16} className="text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-white mb-0.5">{item.title}</h4>
                      <p className="text-[12px] text-white/55 leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent rounded-3xl blur-2xl" />
              <div className="relative rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-[hsl(213,72%,11%)] via-[hsl(213,72%,8%)] to-[hsl(213,72%,6%)] border border-white/[0.08] shadow-2xl shadow-black/40 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/45 font-bold">Wallet Balance</p>
                    <p className="text-3xl sm:text-4xl font-display font-bold text-white mt-2 tracking-tight">
                      KES <span className="text-emerald-400">24,500</span>
                    </p>
                    <p className="text-[11px] text-emerald-400/80 mt-1.5 flex items-center gap-1">
                      <TrendingUp size={11} /> +KES 4,200 this week
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Wallet size={20} className="text-emerald-400" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5 mb-6">
                  {[
                    { icon: ArrowUpRight, label: 'Deposit' },
                    { icon: Send, label: 'Transfer' },
                    { icon: ArrowDownUp, label: 'Request' },
                  ].map((action, i) => (
                    <button
                      key={i}
                      className="text-center p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-emerald-500/20 transition-all"
                    >
                      <action.icon size={16} className="mx-auto text-emerald-400 mb-1.5" />
                      <p className="text-[11px] text-white/75 font-bold">{action.label}</p>
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/45 font-bold mb-3">Recent Activity</p>
                  {[
                    { name: 'Grace W.', type: 'Received', amount: '+1,200', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { name: 'M-Pesa Top Up', type: 'Deposit', amount: '+5,000', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { name: 'Peter O.', type: 'Sent', amount: '-800', color: 'text-red-400', bg: 'bg-red-500/10' },
                  ].map((tx, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${tx.bg} flex items-center justify-center`}>
                          <Send size={12} className={tx.color} />
                        </div>
                        <div>
                          <p className="text-[13px] text-white/85 font-medium">{tx.name}</p>
                          <p className="text-[10px] text-white/45">{tx.type}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-bold ${tx.color}`}>{tx.amount}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
            {/* ───── LOANS ───── */}
      <section id="loans" className="py-16 sm:py-24 md:py-28 px-4 bg-[hsl(213,72%,7%)]">
        <div className="container max-w-6xl">
          <motion.div
            className="text-center mb-12 sm:mb-16 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-accent/10 text-accent mb-4">
              Lending
            </span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-[2.75rem] font-bold mb-3 text-white tracking-tight leading-tight">
              Personal &amp; business loans
            </h2>
            <p className="text-white/55 text-sm sm:text-[15px] leading-relaxed">
              Access affordable credit for business growth, education, and personal needs — fully digital, fast approval.
            </p>
          </motion.div>

          <div className="grid gap-5 grid-cols-1 sm:grid-cols-3">
            {loanProducts.map((product, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                className="rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-accent/30 hover:bg-white/[0.035] transition-all duration-300 overflow-hidden flex flex-col group"
              >
                <div className="p-6 flex-1">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.06] flex items-center justify-center text-2xl">
                      {product.icon}
                    </div>
                    <span className="text-[11px] font-bold text-accent bg-accent/10 border border-accent/15 px-2.5 py-1 rounded-full">
                      {product.rate} p.a.
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-lg sm:text-xl mb-2 text-white tracking-tight">{product.name}</h3>
                  <p className="text-[13px] text-white/55 leading-relaxed">{product.desc}</p>
                </div>
                <div className="px-6 py-4 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-white/45 uppercase tracking-wider font-semibold">Up to</p>
                    <p className="font-display font-bold text-white text-sm mt-0.5">{product.max}</p>
                  </div>
                  <Link to="/signup">
                    <Button variant="gold" size="sm" className="shadow-gold text-[12px] h-9 rounded-full font-semibold gap-1.5 px-4">
                      Apply <ArrowRight size={13} />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── SECURITY ───── */}
      <section className="py-16 sm:py-24 md:py-28 px-4 bg-[hsl(213,72%,9%)] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,_hsl(0_80%_50%_/_0.05),_transparent_55%)]" />
        <div className="container max-w-6xl relative z-10">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 mb-4">
                Security First
              </span>
              <h2 className="font-display text-3xl sm:text-4xl md:text-[2.75rem] font-bold mb-4 text-white tracking-tight leading-[1.1]">
                Bank-grade<br />security built in
              </h2>
              <p className="text-white/60 mb-6 text-sm sm:text-[15px] leading-relaxed">
                Your money and data are protected with multiple layers of security at every level — from device to database.
              </p>
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06]">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} className="text-red-400" />
                </div>
                <p className="text-[13px] text-white/75 leading-snug">
                  <span className="font-bold text-white">256-bit encryption</span> — the same standard used by major banks.
                </p>
              </div>
            </motion.div>

            <div className="grid grid-cols-2 gap-3">
              {securityFeatures.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-red-500/20 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center mb-3">
                    <item.icon size={15} className="text-red-400" />
                  </div>
                  <h4 className="font-bold text-[13px] text-white mb-1">{item.title}</h4>
                  <p className="text-[11px] text-white/50 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───── TESTIMONIALS ───── */}
      <section className="py-16 sm:py-24 md:py-28 px-4 bg-[hsl(213,72%,7%)] relative">
        <div className="container max-w-6xl">
          <motion.div
            className="text-center mb-12 sm:mb-16 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-accent/10 text-accent mb-4">
              Testimonials
            </span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-[2.75rem] font-bold mb-3 text-white tracking-tight leading-tight">
              Trusted by Kenyans
            </h2>
            <p className="text-white/55 text-sm sm:text-[15px] leading-relaxed">
              Real stories from groups already managing their savings on Dasnet.
            </p>
          </motion.div>

          <div className="grid gap-5 grid-cols-1 sm:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="p-6 rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-accent/20 transition-colors flex flex-col"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, si) => (
                    <Star key={si} size={14} className="text-accent fill-accent" />
                  ))}
                </div>
                <p className="text-[14px] text-white/75 leading-relaxed mb-6 flex-1">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-gold-300 flex items-center justify-center text-accent-foreground text-[12px] font-bold shadow-gold">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[13px] text-white truncate">{t.name}</p>
                    <p className="text-[11px] text-white/50 truncate">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section id="faq" className="py-16 sm:py-24 md:py-28 px-4 bg-[hsl(213,72%,9%)]">
        <div className="container max-w-3xl">
          <motion.div
            className="text-center mb-12 sm:mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-accent/10 text-accent mb-4">
              FAQ
            </span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-[2.75rem] font-bold mb-3 text-white tracking-tight leading-tight">
              Common questions
            </h2>
            <p className="text-white/55 text-sm sm:text-[15px] leading-relaxed">
              Everything you need to know about our digital platform.
            </p>
          </motion.div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className={cn(
                    'w-full text-left p-5 sm:p-6 rounded-2xl bg-white/[0.025] border transition-all duration-300 group',
                    openFaq === i
                      ? 'border-accent/30 bg-white/[0.035]'
                      : 'border-white/[0.06] hover:border-white/[0.12]'
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-sm sm:text-[15px] text-white">{faq.q}</h3>
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300',
                      openFaq === i ? 'bg-accent text-accent-foreground rotate-180' : 'bg-white/[0.06] text-white/65'
                    )}>
                      <ChevronDown size={14} />
                    </div>
                  </div>
                  <motion.div
                    initial={false}
                    animate={{ height: openFaq === i ? 'auto' : 0, opacity: openFaq === i ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
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
        <section className="py-12 sm:py-16 px-4 bg-[hsl(213,72%,7%)] relative overflow-hidden">
          <div className="container max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-3xl p-8 sm:p-10 text-center bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(42_92%_56%_/_0.08),_transparent_60%)]" />
              <div className="relative">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/20 flex items-center justify-center">
                  <Smartphone size={22} className="text-accent" />
                </div>
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                  Download the Dasnet App
                </h3>
                <p className="text-white/60 max-w-md mx-auto mb-6 text-sm leading-relaxed">
                  Install for a faster experience — offline support and instant notifications directly to your phone.
                </p>
                <Button variant="hero" size="lg" onClick={promptInstall} className="shadow-gold-lg rounded-full font-semibold gap-2">
                  <Smartphone size={16} /> Install App Now
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ───── CTA ───── */}
      <section className="py-16 sm:py-24 px-4 bg-[hsl(213,72%,9%)]">
        <div className="container max-w-5xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-[2rem] p-8 sm:p-12 md:p-16 text-center relative overflow-hidden bg-gradient-to-br from-accent/25 via-accent/10 to-transparent border border-accent/25"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(42_92%_56%_/_0.15),_transparent_65%)]" />
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/20 flex items-center justify-center">
                <Users size={24} className="text-accent" />
              </div>
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight leading-[1.1]">
                Start your financial<br className="hidden sm:inline" /> journey today
              </h2>
              <p className="text-white/65 max-w-xl mx-auto mb-8 text-sm sm:text-base leading-relaxed">
                Join thousands of Kenyans managing their group savings, personal wallets, and loans digitally with Dasnet Ventures.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/signup" className="w-full sm:w-auto">
                  <Button variant="hero" size="lg" className="w-full sm:w-auto min-w-[200px] shadow-gold-lg rounded-full font-semibold gap-2">
                    Create Free Account <ArrowRight size={16} />
                  </Button>
                </Link>
                <Link to="/contact" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto border-white/15 text-white hover:bg-white/[0.06] min-w-[160px] rounded-full"
                  >
                    Talk to Us
                  </Button>
                </Link>
              </div>
              <div className="flex items-center justify-center gap-5 mt-7 text-[12px] text-white/50">
                <span className="flex items-center gap-1.5">
                  <CheckCircle size={13} className="text-accent" /> Free to start
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle size={13} className="text-accent" /> No setup fees
                </span>
                <span className="hidden sm:flex items-center gap-1.5">
                  <CheckCircle size={13} className="text-accent" /> Cancel anytime
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="bg-[hsl(213,72%,5%)] text-white pt-16 sm:pt-20 pb-8 px-4 relative border-t border-white/[0.05]">
        <div className="container max-w-6xl relative z-10">
          <div className="grid gap-10 sm:gap-8 grid-cols-2 md:grid-cols-5 mb-12">
            <div className="col-span-2">
              <Logo variant="white" size="md" />
              <p className="text-[13px] text-white/55 mt-4 leading-relaxed max-w-sm">
                Kenya's complete digital banking platform — Chama management, wallets, loans, and Harambee, all in one secure place.
              </p>
              <div className="flex items-center gap-2 mt-5">
                {[Globe, Phone, Mail].map((Icon, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] hover:border-accent/20 transition-all cursor-pointer group"
                  >
                    <Icon size={14} className="text-white/60 group-hover:text-accent transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            {footerColumns.map((col, i) => (
              <div key={i}>
                <h4 className="text-[11px] font-bold text-white uppercase tracking-[0.15em] mb-4">{col.title}</h4>
                <div className="space-y-2.5">
                  {col.links.map((link, li) => (
                    <a
                      key={li}
                      href={link.href}
                      className="block text-[13px] text-white/55 hover:text-accent transition-colors"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[12px] text-white/40">
              © {new Date().getFullYear()} DASNET VENTURES LTD. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-[12px] text-white/40">
              <Link to="/terms" className="hover:text-white/70 transition-colors">Terms</Link>
              <span className="text-white/20">·</span>
              <a href="/privacy.html" className="hover:text-white/70 transition-colors">Privacy</a>
              <span className="text-white/20">·</span>
              <Link to="/contact" className="hover:text-white/70 transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
                    }
