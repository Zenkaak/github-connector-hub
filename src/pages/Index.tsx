import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Shield, Clock, Users, CheckCircle, Star, Zap, Phone, Mail, MapPin,
  ArrowUpRight, FileCheck, CreditCard, HeartHandshake, ChevronDown, Wallet, BadgeCheck,
  Globe, TrendingUp, Award, PiggyBank, UserPlus, HandCoins, FileText, MessageSquare,
  Smartphone, Heart, Target, Lock, Send, ArrowDownUp, Landmark, Eye, ShieldCheck,
  Building2, Banknote, QrCode, Menu, X,
} from 'lucide-react';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { cn } from '@/lib/utils';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

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
        .select('id, title, description, target_amount, raised_amount, deadline, order_number, status, is_public, group_id, image_urls')
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
    <div className="min-h-screen overflow-x-hidden bg-[hsl(213,72%,8%)]">
      {/* ───── HEADER ───── */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-3 sm:mx-4 mt-3">
          <div className="glass-dark rounded-2xl shadow-lg max-w-6xl mx-auto border border-white/[0.06]">
            <div className="flex items-center justify-between h-[56px] sm:h-[60px] px-4 md:px-6">
              <Logo size="md" variant="white" />
              <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-white/70">
                {navLinks.map(link => (
                  <a key={link.href} href={link.href} className="hover:text-white transition-colors">{link.label}</a>
                ))}
              </nav>
              <div className="flex items-center gap-2">
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="text-[13px] text-white/70 hover:text-white hover:bg-white/[0.06]">Sign In</Button>
                </Link>
                <Link to="/signup" className="hidden sm:inline-flex">
                  <Button variant="gold" size="sm" className="text-[13px] shadow-gold">Get Started <ArrowRight size={14} /></Button>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white/80 hover:bg-white/[0.06] transition-colors"
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="md:hidden mx-3 mt-2"
            >
              <div className="glass-dark rounded-2xl border border-white/[0.08] p-4 space-y-1">
                {navLinks.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 rounded-xl text-sm font-medium text-white/80 hover:bg-white/[0.06] transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="pt-3 border-t border-white/[0.06] flex gap-2">
                  <Link to="/auth" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full border-white/10 text-white/80 hover:bg-white/[0.06]">Sign In</Button>
                  </Link>
                  <Link to="/signup" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="gold" size="sm" className="w-full shadow-gold">Get Started</Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ───── HERO ───── */}
      <section className="hero-gradient pt-32 pb-20 sm:pt-36 sm:pb-28 md:pt-44 md:pb-40 px-4 relative overflow-hidden noise-overlay">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(42_92%_56%_/_0.08),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(156_72%_38%_/_0.05),_transparent_50%)]" />
        <div className="absolute inset-0 grid-pattern opacity-[0.02]" />
        <div className="absolute top-20 right-[15%] w-72 h-72 bg-accent/5 rounded-full blur-[100px] animate-float" />
        <div className="absolute bottom-20 left-[10%] w-96 h-96 bg-emerald-500/3 rounded-full blur-[120px] animate-float" style={{ animationDelay: '3s' }} />

        <motion.div className="container max-w-5xl text-center relative z-10" initial="hidden" animate="visible" variants={stagger}>
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/80 text-xs sm:text-[13px] mb-6 sm:mb-8">
            <ShieldCheck size={14} className="text-accent" />
            Chama &bull; Wallet &bull; Loans &bull; Harambee &bull; M-Pesa
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} className="font-display text-[2rem] sm:text-4xl md:text-5xl lg:text-[4.25rem] font-bold text-white mb-5 sm:mb-6 leading-[1.1] tracking-tight">
            Your Complete
            <br />
            <span className="bg-gradient-to-r from-accent via-gold-300 to-accent bg-clip-text text-transparent animate-gradient">
              Digital Banking
            </span>
            <br />
            <span className="text-white/95">Platform</span>
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} className="text-sm sm:text-base md:text-lg text-white/70 max-w-xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2">
            Manage Chama groups, digital wallets, personal loans, and Harambee fundraising — all with seamless M-Pesa integration and bank-grade security.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4 sm:px-0">
            <Link to="/signup" className="w-full sm:w-auto">
              <Button variant="hero" size="xl" className="w-full sm:w-auto min-w-[200px] shadow-gold-lg">
                Open Free Account <ArrowRight size={18} />
              </Button>
            </Link>
            <Link to="/auth" className="w-full sm:w-auto">
              <Button variant="outline" size="xl" className="w-full sm:w-auto border-white/10 text-white hover:bg-white/[0.06] backdrop-blur-sm min-w-[160px]">
                <Shield size={18} /> Sign In
              </Button>
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} custom={3.5} className="mt-4">
            <Link to="/signup" className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors font-semibold">
              <HeartHandshake size={16} /> Start a Fundraiser <ArrowRight size={14} />
            </Link>
          </motion.div>

          {/* Live Stats */}
          <motion.div variants={fadeUp} custom={4} className="max-w-lg mx-auto mt-12 sm:mt-16 pt-8 sm:pt-10 border-t border-white/[0.08]">
            <div className="grid grid-cols-3 gap-4 sm:gap-8 md:gap-12">
              {[
                { value: liveStats.members > 0 ? `${liveStats.members.toLocaleString()}+` : '—', label: 'Active Members' },
                { value: liveStats.groups > 0 ? `${liveStats.groups.toLocaleString()}+` : '—', label: 'Chama Groups' },
                { value: liveStats.savings > 0 ? formatCompact(liveStats.savings) : '—', label: 'Savings Managed' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-lg sm:text-2xl md:text-3xl font-bold text-white font-display">{stat.value}</p>
                  <p className="text-[9px] sm:text-[10px] text-white/60 mt-1 uppercase tracking-[0.15em] font-semibold">{stat.label}</p>
                </div>
              ))}
            </div>

            {!isInstalled && (
              <motion.div variants={fadeUp} custom={5} className="mt-8 flex flex-col items-center gap-2">
                <Button variant="gold" size="lg" onClick={canInstall ? promptInstall : undefined} className="gap-2.5 shadow-gold">
                  <Smartphone size={18} /> Download App
                </Button>
                <p className="text-[11px] text-white/50">
                  {canInstall ? 'Tap to install for a faster, offline-ready experience' : 'Open browser menu → "Add to Home Screen" to install'}
                </p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* ───── TRUST BADGES ───── */}
      <section className="py-8 sm:py-10 px-4 bg-[hsl(213,72%,6%)] border-y border-white/[0.04]">
        <div className="container max-w-5xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 sm:gap-6 md:gap-8 items-center justify-center">
            {[
              { icon: Lock, label: 'SSL Encrypted' },
              { icon: ShieldCheck, label: 'Bank-Grade Security' },
              { icon: Banknote, label: 'M-Pesa Integrated' },
              { icon: BadgeCheck, label: 'KYC Verified' },
              { icon: Eye, label: 'Full Transparency' },
              { icon: Building2, label: 'Kenyan Registered' },
            ].map((badge, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-center gap-2 text-white/60"
              >
                <badge.icon size={14} className="text-accent/50 shrink-0" />
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.12em]">{badge.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── ACTIVE HARAMBEES (moved up for engagement) ───── */}
      {activeHarambees.length > 0 && (
        <section className="py-14 sm:py-20 md:py-24 px-4 bg-[hsl(213,72%,8%)] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(0_80%_50%_/_0.04),_transparent_50%)]" />
          <div className="container max-w-6xl relative z-10">
            <motion.div className="text-center mb-6 sm:mb-10" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full bg-red-500/10 text-red-400 mb-4 animate-pulse">
                <Heart size={12} className="fill-red-400" /> Urgent Appeals
              </span>
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mb-3 text-white">People Need Your Help</h2>
              <p className="text-white/65 max-w-xl mx-auto text-sm sm:text-base">Verified fundraisers from real Kenyans. Every shilling counts.</p>
            </motion.div>

            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 no-scrollbar snap-x snap-mandatory -mx-4 px-4">
              {activeHarambees.map((h, i) => {
                const progress = h.target_amount > 0 ? Math.min(100, Math.round((h.raised_amount / h.target_amount) * 100)) : 0;
                const daysLeft = h.deadline ? Math.max(0, Math.ceil((new Date(h.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
                return (
                  <motion.div key={h.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="min-w-[280px] sm:min-w-[300px] max-w-[340px] snap-start shrink-0">
                    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-accent/20 transition-all duration-300 overflow-hidden flex flex-col h-full">
                      <div className="p-4 sm:p-5 flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                            <Heart size={18} className="text-red-400" />
                          </div>
                          {daysLeft !== null && (
                            <span className={cn(
                              'text-[10px] font-bold px-2 py-1 rounded-full',
                              daysLeft <= 3 ? 'bg-red-500/20 text-red-400' : 'bg-white/[0.06] text-white/70'
                            )}>
                              {daysLeft > 0 ? `${daysLeft}d left` : 'Ended'}
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-sm sm:text-base text-white line-clamp-1">{h.title}</h3>
                          {h.description && <p className="text-xs text-white/60 mt-1.5 line-clamp-3 whitespace-pre-line">{h.description}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-white/65">Raised</span>
                            <span className="font-bold text-accent">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2.5" />
                          <div className="flex justify-between text-[11px]">
                            <span className="text-white/80 font-semibold">KES {(h.raised_amount || 0).toLocaleString()}</span>
                            <span className="text-white/60">of KES {(h.target_amount || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="px-4 sm:px-5 py-3 bg-white/[0.02] border-t border-white/[0.06] flex gap-2">
                        <Link to={`/harambee/${h.order_number}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full border-white/10 text-white hover:bg-white/[0.06] text-xs">
                            <Eye size={14} /> Details
                          </Button>
                        </Link>
                        <Link to={`/harambee/${h.order_number}`} className="flex-1">
                          <Button variant="gold" size="sm" className="w-full shadow-gold text-xs">
                            <Heart size={14} /> Contribute
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="text-center mt-6">
              <Link to="/signup">
                <Button variant="hero" size="lg" className="shadow-gold-lg gap-2">
                  <HeartHandshake size={18} /> Start Your Own Fundraiser <ArrowRight size={16} />
                </Button>
              </Link>
              <p className="text-[11px] text-white/50 mt-2">Verified Harambees only · 3% platform fee on collected funds</p>
            </div>
          </div>
        </section>
      )}

      {/* ───── FEATURES ───── */}
      <section id="features" className="py-14 sm:py-20 md:py-24 px-4 bg-[hsl(213,72%,10%)] relative">
        <div className="container max-w-6xl">
          <motion.div className="text-center mb-8 sm:mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.5 }}>
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full bg-accent/10 text-accent mb-4">
              Platform Features
            </span>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mb-3 text-white">Everything You Need, One Platform</h2>
            <p className="text-white/65 max-w-xl mx-auto leading-relaxed text-sm sm:text-base">From group savings to personal wallets — a complete digital financial ecosystem.</p>
          </motion.div>

          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {[
              { icon: PiggyBank, title: 'Smart Savings', desc: 'Daily, weekly, or monthly contributions via M-Pesa STK push. Track payments in real-time.' },
              { icon: Wallet, title: 'Digital Wallet', desc: 'Deposit, transfer, request money. Full transaction history and instant M-Pesa top-up.' },
              { icon: HandCoins, title: 'Secure Withdrawals', desc: 'Multi-level approval: Treasurer initiates, leaders approve, Admin releases.' },
              { icon: Heart, title: 'Harambee', desc: 'Create public fundraising campaigns. Accept M-Pesa contributions from anyone.' },
              { icon: Landmark, title: 'Personal Loans', desc: 'Apply for Biashara, Elimu, or Youth Fund loans directly from your dashboard.' },
              { icon: Users, title: 'Role Management', desc: 'Assign Chairperson, Secretary, and Treasurer with specific permissions.' },
              { icon: Shield, title: 'Emergency Fund', desc: 'Automatic monthly emergency contributions to keep your group protected.' },
              { icon: Zap, title: 'Real-Time Alerts', desc: 'Instant notifications for payments, withdrawals, and approvals.' },
            ].map((feature, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ delay: i * 0.06, duration: 0.5 }}
                className="group p-4 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-accent/20 hover:bg-white/[0.05] transition-all duration-400">
                <div className="w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-5 rounded-xl sm:rounded-2xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <feature.icon className="text-accent" size={20} />
                </div>
                <h3 className="font-display font-bold text-sm sm:text-base mb-1.5 sm:mb-2 text-white">{feature.title}</h3>
                <p className="text-white/65 text-xs sm:text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── WALLET & TRANSFERS ───── */}
      <section id="wallet" className="py-16 sm:py-24 md:py-28 px-4 bg-[hsl(213,72%,10%)] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center_right,_hsl(156_72%_38%_/_0.06),_transparent_60%)]" />
        <div className="container max-w-5xl relative z-10">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 mb-4">
                Digital Wallet
              </span>
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-white">Your Money,<br />Your Control</h2>
              <p className="text-white/65 mb-6 sm:mb-8 leading-relaxed text-sm sm:text-base">
                A full-featured digital wallet powered by M-Pesa. Deposit, transfer to other members, request payments, and track every shilling in real-time.
              </p>
              <div className="space-y-3">
                {[
                  { icon: QrCode, title: 'M-Pesa Deposit', desc: 'Top up your wallet instantly via STK push' },
                  { icon: Send, title: 'Peer-to-Peer Transfers', desc: 'Send money to any registered member' },
                  { icon: ArrowDownUp, title: 'Money Requests', desc: 'Request payments from other users' },
                  { icon: TrendingUp, title: 'Transaction History', desc: 'Full audit trail of every transaction' },
                ].map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-emerald-500/20 transition-colors">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <item.icon size={16} className="text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">{item.title}</h4>
                      <p className="text-xs text-white/60">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="relative">
              {/* Mock Wallet Card */}
              <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-emerald-600/20 via-emerald-500/10 to-transparent border border-emerald-500/20 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold">Wallet Balance</p>
                    <p className="text-2xl sm:text-3xl font-display font-bold text-white mt-1">KES 24,500</p>
                  </div>
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                    <Wallet size={22} className="text-emerald-400" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {[
                    { icon: ArrowUpRight, label: 'Deposit' },
                    { icon: Send, label: 'Transfer' },
                    { icon: ArrowDownUp, label: 'Request' },
                  ].map((action, i) => (
                    <div key={i} className="text-center p-2.5 sm:p-3 rounded-xl bg-white/[0.06] border border-white/[0.06]">
                      <action.icon size={16} className="mx-auto text-emerald-400 mb-1" />
                      <p className="text-[10px] text-white/70 font-bold">{action.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 sm:mt-6 space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold">Recent</p>
                  {[
                    { name: 'Grace W.', type: 'Received', amount: '+1,200', color: 'text-emerald-400' },
                    { name: 'M-Pesa Top Up', type: 'Deposit', amount: '+5,000', color: 'text-emerald-400' },
                    { name: 'Peter O.', type: 'Sent', amount: '-800', color: 'text-red-400' },
                  ].map((tx, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                      <div>
                        <p className="text-xs text-white/80 font-medium">{tx.name}</p>
                        <p className="text-[10px] text-white/50">{tx.type}</p>
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

      {/* ───── LIVE STATS BANNER ───── */}
      <section className="py-12 sm:py-16 px-4 bg-[hsl(213,72%,12%)] relative overflow-hidden noise-overlay">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(42_92%_56%_/_0.06),_transparent_60%)]" />
        <div className="container max-w-5xl relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12">
            {[
              { value: liveStats.groups > 0 ? `${liveStats.groups}+` : '—', label: 'Chama Groups', icon: Users },
              { value: liveStats.savings > 0 ? formatCompact(liveStats.savings) : '—', label: 'Total Savings', icon: PiggyBank },
              { value: liveStats.members > 0 ? `${liveStats.members}+` : '—', label: 'Registered Users', icon: Award },
              { value: '24/7', label: 'M-Pesa Access', icon: Clock },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="text-center">
                <div className="w-11 h-11 sm:w-12 sm:h-12 mx-auto mb-3 rounded-2xl bg-white/[0.06] flex items-center justify-center">
                  <stat.icon size={20} className="text-accent" />
                </div>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white font-display">{stat.value}</p>
                <p className="text-[10px] sm:text-[11px] text-white/60 mt-1 uppercase tracking-[0.12em] font-semibold">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── HOW IT WORKS ───── */}
      <section id="how-it-works" className="py-16 sm:py-24 md:py-28 px-4 bg-[hsl(213,72%,8%)] relative">
        <div className="container max-w-5xl">
          <motion.div className="text-center mb-10 sm:mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full bg-accent/10 text-accent mb-4">Getting Started</span>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-white">Start in 4 Simple Steps</h2>
            <p className="text-white/65 max-w-lg mx-auto text-sm sm:text-base">From sign-up to your first savings deposit in minutes.</p>
          </motion.div>

          <div className="grid gap-6 sm:gap-8 grid-cols-2 md:grid-cols-4 relative">
            <div className="hidden md:block absolute top-[38px] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-white/[0.04] via-accent/20 to-white/[0.04]" />
            {[
              { step: '01', icon: FileCheck, title: 'Create Account', desc: 'Sign up with your phone number and ID in under 2 minutes.' },
              { step: '02', icon: Users, title: 'Create a Group', desc: 'Name your Chama and become the Chairperson.' },
              { step: '03', icon: UserPlus, title: 'Add Members', desc: 'Search by phone and assign roles.' },
              { step: '04', icon: PiggyBank, title: 'Start Saving', desc: 'Members pay directly via M-Pesa STK.' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.5 }} className="relative text-center">
                <div className="w-14 h-14 sm:w-[76px] sm:h-[76px] mx-auto mb-4 sm:mb-6 rounded-2xl bg-accent flex items-center justify-center shadow-gold-lg relative z-10">
                  <item.icon className="text-accent-foreground" size={24} />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-accent uppercase tracking-[0.2em] mb-1 sm:mb-2 block">Step {item.step}</span>
                <h3 className="font-display font-bold text-sm sm:text-lg mb-1 sm:mb-2 text-white">{item.title}</h3>
                <p className="text-white/65 text-xs sm:text-sm leading-relaxed max-w-[220px] mx-auto">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CHAMA EXPLORER PREVIEW ───── */}
      {publicChamas.length > 0 && (
        <section className="py-16 sm:py-24 md:py-28 px-4 bg-[hsl(213,72%,10%)] relative">
          <div className="container max-w-6xl">
            <motion.div className="text-center mb-8 sm:mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full bg-accent/10 text-accent mb-4">Explore</span>
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-white">Browse Public Chama Groups</h2>
              <p className="text-white/65 max-w-xl mx-auto text-sm sm:text-base">Discover active savings groups and request to join.</p>
            </motion.div>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {publicChamas.slice(0, 6).map((chama, i) => (
                <motion.div key={chama.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                  className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-accent/20 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    {chama.profile_image_url ? (
                      <img src={chama.profile_image_url} alt={chama.name} className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                        <PiggyBank size={18} className="text-accent" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-sm text-white truncate">{chama.name}</h3>
                      {chama.description && <p className="text-[11px] text-white/55 truncate">{chama.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-3 border-t border-white/[0.06]">
                    <span className="text-white/65">KES {chama.contribution_amount?.toLocaleString()} / {chama.contribution_frequency}</span>
                    <Link to="/signup">
                      <span className="text-accent font-bold hover:underline flex items-center gap-1">
                        Join <ArrowRight size={10} />
                      </span>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-6 sm:mt-8">
              <Link to="/signup">
                <Button variant="outline" size="lg" className="border-white/10 text-white hover:bg-white/[0.06]">
                  View All Groups <ArrowRight size={16} />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}



      {/* ───── LOANS ───── */}
      <section id="loans" className="py-16 sm:py-24 md:py-28 px-4 bg-[hsl(213,72%,10%)]">
        <div className="container max-w-5xl">
          <motion.div className="text-center mb-10 sm:mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full bg-accent/10 text-accent mb-4">Lending</span>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-white">Personal & Business Loans</h2>
            <p className="text-white/65 max-w-xl mx-auto text-sm sm:text-base">Access affordable credit for business growth, education, and personal needs.</p>
          </motion.div>

          <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'Biashara Loan', desc: 'For business growth and expansion', rate: '10%', max: 'KES 500,000', icon: '🏪' },
              { name: 'Elimu Loan', desc: 'Education financing for students', rate: '8%', max: 'KES 300,000', icon: '📚' },
              { name: 'Youth Fund', desc: 'Empowering young entrepreneurs', rate: '8%', max: 'KES 200,000', icon: '🚀' },
            ].map((product, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-accent/20 hover:bg-white/[0.05] transition-all duration-400 overflow-hidden flex flex-col">
                <div className="p-5 sm:p-6 flex-1">
                  <div className="flex items-start justify-between mb-4 sm:mb-5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/[0.06] flex items-center justify-center text-xl sm:text-2xl">{product.icon}</div>
                    <span className="text-xs font-bold text-accent bg-accent/10 px-3 py-1.5 rounded-full">{product.rate} p.a.</span>
                  </div>
                  <h3 className="font-display font-bold text-base sm:text-lg mb-1.5 sm:mb-2 text-white">{product.name}</h3>
                  <p className="text-xs sm:text-sm text-white/65 leading-relaxed">{product.desc}</p>
                </div>
                <div className="px-5 sm:px-6 py-3 sm:py-4 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-[11px] text-white/55 uppercase tracking-wider">Up to</p>
                    <p className="font-display font-bold text-white text-sm sm:text-base">{product.max}</p>
                  </div>
                  <Link to="/signup"><Button variant="gold" size="sm" className="shadow-gold">Apply <ArrowRight size={14} /></Button></Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── SECURITY SECTION ───── */}
      <section className="py-16 sm:py-24 md:py-28 px-4 bg-[hsl(213,72%,8%)] relative">
        <div className="container max-w-5xl">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full bg-red-500/10 text-red-400 mb-4">
                Security First
              </span>
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-white">Bank-Grade<br />Security Built In</h2>
              <p className="text-white/65 mb-6 leading-relaxed text-sm sm:text-base">
                Your money and data are protected with multiple layers of security at every level of our platform.
              </p>
            </motion.div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {[
                { icon: Lock, title: 'End-to-End Encryption', desc: 'All data encrypted in transit and at rest' },
                { icon: ShieldCheck, title: 'Multi-Level Approval', desc: '3-leader approval for all withdrawals' },
                { icon: BadgeCheck, title: 'KYC Verification', desc: 'ID and document verification required' },
                { icon: Eye, title: 'Full Audit Trail', desc: 'Every transaction recorded with timestamps' },
                { icon: Shield, title: 'Row-Level Security', desc: 'Database policies isolate user data' },
                { icon: FileCheck, title: 'Digital Signatures', desc: 'Signed terms with tamper-proof records' },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                  className="p-3 sm:p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <item.icon size={16} className="text-red-400 mb-2" />
                  <h4 className="font-bold text-xs text-white mb-1">{item.title}</h4>
                  <p className="text-[10px] text-white/60 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───── TESTIMONIALS ───── */}
      <section className="py-16 sm:py-24 md:py-28 px-4 bg-[hsl(213,72%,10%)] relative">
        <div className="container max-w-6xl">
          <motion.div className="text-center mb-10 sm:mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full bg-accent/10 text-accent mb-4">Testimonials</span>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-white">Trusted by Kenyans</h2>
            <p className="text-white/65 max-w-lg mx-auto text-sm sm:text-base">Hear from groups already managing their savings on Dasnet.</p>
          </motion.div>

          <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'Grace Wanjiru', role: 'Chairperson, Umoja Savings', text: 'We used to track contributions in a notebook. Now everything is digital—transparency and trust have never been higher.', rating: 5 },
              { name: 'Peter Ochieng', role: 'Treasurer, Vijana Group', text: 'The withdrawal approval system is brilliant. No room for disputes, and M-Pesa integration makes collection effortless.', rating: 5 },
              { name: 'Amina Hassan', role: 'Member, Baraka Chama', text: 'I love the wallet feature and instant notifications. The digital signature gives us real peace of mind.', rating: 5 },
            ].map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, si) => <Star key={si} size={14} className="text-accent fill-accent" />)}
                </div>
                <p className="text-sm text-white/75 leading-relaxed mb-5 sm:mb-6">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs font-bold">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">{t.name}</p>
                    <p className="text-xs text-white/60">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section id="faq" className="py-16 sm:py-24 md:py-28 px-4 bg-[hsl(213,72%,8%)]">
        <div className="container max-w-3xl">
          <motion.div className="text-center mb-10 sm:mb-14" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full bg-accent/10 text-accent mb-4">FAQ</span>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-white">Common Questions</h2>
            <p className="text-white/65 max-w-lg mx-auto text-sm sm:text-base">Everything you need to know about our digital platform.</p>
          </motion.div>

          <div className="space-y-2.5 sm:space-y-3">
            {faqs.map((faq, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-accent/20 transition-all duration-300 group">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-sm sm:text-[15px] text-white">{faq.q}</h3>
                    <ChevronDown size={16} className={`text-white/60 shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                  </div>
                  <motion.div initial={false} animate={{ height: openFaq === i ? 'auto' : 0, opacity: openFaq === i ? 1 : 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                    <p className="text-xs sm:text-sm text-white/65 leading-relaxed mt-3 pr-6">{faq.a}</p>
                  </motion.div>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
{/* ───── DOWNLOAD APP ───── */}
{!isInstalled && (
<section className="py-12 sm:py-16 px-4 bg-[hsl(213,72%,10%)] relative overflow-hidden">
<div className="container max-w-3xl">
<motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
className="rounded-2xl p-6 sm:p-8 md:p-10 text-center bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20">
<div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-4 rounded-2xl bg-primary/20 flex items-center justify-center">
<Smartphone size={22} className="text-accent" />
</div>
<h3 className="font-display text-xl sm:text-2xl font-bold text-white mb-2">Download Dasnet App</h3>
<p className="text-white/65 max-w-md mx-auto mb-6 text-xs sm:text-sm leading-relaxed">
Install our app for a faster experience—offline support and instant notifications directly to your phone.
</p>
{canInstall ? (
<Button variant="hero" size="lg" onClick={promptInstall} className="shadow-gold-lg"><Smartphone size={18} /> Install App Now</Button>
) : (
<Button variant="hero" size="lg" onClick={() => alert('Open your browser menu and tap "Add to Home Screen" or "Install App" to install.')} className="shadow-gold-lg"><Smartphone size={18} /> Install App</Button>
)}
</motion.div>
</div>
</section>
)} 

      {/* ───── CTA ───── */}
      <section className="py-16 sm:py-24 px-4 bg-[hsl(213,72%,8%)]">
        <div className="container max-w-4xl">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            className="rounded-3xl p-8 sm:p-10 md:p-16 text-center relative overflow-hidden bg-gradient-to-br from-accent/20 via-accent/10 to-transparent border border-accent/20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(42_92%_56%_/_0.1),_transparent_70%)]" />
            <div className="relative z-10">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-5 sm:mb-6 rounded-2xl bg-accent/20 flex items-center justify-center">
                <Users size={26} className="text-accent" />
              </div>
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">Start Your Financial Journey Today</h2>
              <p className="text-white/65 max-w-lg mx-auto mb-6 sm:mb-8 leading-relaxed text-sm sm:text-base">
                Join Kenyans managing their group savings, personal wallets, and loans digitally with Dasnet Ventures.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/signup" className="w-full sm:w-auto">
                  <Button variant="hero" size="xl" className="w-full sm:w-auto min-w-[200px] shadow-gold-lg">Create Free Account <ArrowRight size={18} /></Button>
                </Link>
                <Link to="/contact" className="w-full sm:w-auto">
                  <Button variant="outline" size="xl" className="w-full sm:w-auto border-white/10 text-white hover:bg-white/[0.06] min-w-[160px]">Talk to Us</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="bg-[hsl(213,72%,6%)] text-white pt-12 sm:pt-16 pb-8 px-4 relative border-t border-white/[0.04]">
        <div className="container max-w-6xl relative z-10">
          <div className="grid gap-8 sm:gap-10 grid-cols-2 md:grid-cols-4 mb-10 sm:mb-12">
            <div className="col-span-2 md:col-span-1">
              <Logo variant="white" size="md" />
              <p className="text-xs sm:text-sm text-white/60 mt-4 leading-relaxed">
                Kenya's complete digital banking platform — Chama management, wallets, loans, and Harambee fundraising.
              </p>
              <div className="flex items-center gap-2 mt-4">
                {[Globe, Phone, Mail].map((Icon, i) => (
                  <div key={i} className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center hover:bg-white/[0.08] transition-colors cursor-pointer">
                    <Icon size={14} className="text-white/60" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70 mb-3 sm:mb-4">Platform</h4>
              <ul className="space-y-2">
                {[
                  { label: 'Chama Groups', path: '/signup' },
                  { label: 'Digital Wallet', path: '/signup' },
                  { label: 'Personal Loans', path: '/loan-products' },
                  { label: 'Harambee', path: '/signup' },
                  { label: 'M-Pesa Payments', path: '/signup' },
                ].map(p => (
                  <li key={p.label}>
                    <Link to={p.path} className="text-xs sm:text-sm text-white/60 hover:text-white/80 transition-colors">{p.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70 mb-3 sm:mb-4">Company</h4>
              <ul className="space-y-2">
                {[
                  { label: 'About Us', path: '/about' },
                  { label: 'Terms of Service', path: '/terms' },
                  { label: 'Privacy Policy', path: '/terms' },
                  { label: 'Contact Us', path: '/contact' },
                ].map(p => (
                  <li key={p.label}>
                    <Link to={p.path} className="text-xs sm:text-sm text-white/60 hover:text-white/80 transition-colors">{p.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70 mb-3 sm:mb-4">Contact</h4>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2.5 text-xs sm:text-sm text-white/65">
                  <Phone size={13} className="text-accent/60 shrink-0" /> +254 751 414 437
                </li>
                <li className="flex items-center gap-2.5 text-xs sm:text-sm text-white/65">
                  <Mail size={13} className="text-accent/60 shrink-0" /> support@dasnet.site
                </li>
                <li className="flex items-start gap-2.5 text-xs sm:text-sm text-white/65">
                  <MapPin size={13} className="text-accent/60 mt-0.5 shrink-0" /> Nairobi, Kenya
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 sm:pt-8 border-t border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[10px] sm:text-[11px] text-white/60">© {new Date().getFullYear()} Dasnet Ventures Ltd. All rights reserved.</p>
            <p className="text-[10px] sm:text-[11px] text-white/50">Chama Management &bull; Digital Wallet &bull; Loans &bull; Harambee</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
