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
    <div className="min-h-screen overflow-x-hidden bg-[hsl(213,72%,8%)] text-white">
      {/* ───── NAVIGATION ───── */}
      <header className="fixed top-0 left-0 right-0 z-50 p-4 transition-all duration-300">
        <div className="mx-auto max-w-7xl">
          <div className="glass-dark rounded-2xl shadow-2xl border border-white/[0.08] backdrop-blur-xl">
            <div className="flex items-center justify-between h-16 px-6">
              <Logo size="md" variant="white" />
              
              <nav className="hidden md:flex items-center gap-8">
                {navLinks.map(link => (
                  <a key={link.href} href={link.href} className="text-[13px] font-medium text-white/60 hover:text-accent transition-colors">
                    {link.label}
                  </a>
                ))}
              </nav>

              <div className="flex items-center gap-3">
                <Link to="/auth" className="hidden sm:block">
                  <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">Sign In</Button>
                </Link>
                <Link to="/signup">
                  <Button variant="gold" size="sm" className="shadow-gold-sm font-bold">Get Started</Button>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 text-white/70 hover:bg-white/10 rounded-lg"
                >
                  {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Nav Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden mt-2 overflow-hidden"
            >
              <div className="glass-dark rounded-2xl border border-white/[0.1] p-4 flex flex-col gap-1">
                {navLinks.map(link => (
                  <a key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-xl hover:bg-white/5 transition-colors font-medium">
                    {link.label}
                  </a>
                ))}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full">Sign In</Button>
                    </Link>
                    <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="gold" size="sm" className="w-full">Sign Up</Button>
                    </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ───── HERO ───── */}
      <section className="relative pt-44 pb-20 md:pt-56 md:pb-32 px-4 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent/10 blur-[130px] rounded-full" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-500/5 blur-[130px] rounded-full" />
          <div className="absolute inset-0 grid-pattern opacity-[0.03]" />
        </div>

        <motion.div className="container max-w-6xl text-center" initial="hidden" animate="visible" variants={stagger}>
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold tracking-[0.1em] text-accent mb-8 uppercase">
            <ShieldCheck size={14} /> Chama • Wallet • Loans • Harambee • M-Pesa
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} className="font-display text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
            Your Complete <br />
            <span className="bg-gradient-to-r from-accent via-gold-400 to-accent bg-clip-text text-transparent animate-gradient">Digital Banking</span>
            <br /> Platform
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} className="text-sm sm:text-lg text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Manage Chama groups, digital wallets, personal loans, and Harambee fundraising — all with seamless M-Pesa integration and bank-grade security.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup" className="w-full sm:w-auto">
              <Button variant="hero" size="xl" className="w-full px-8 shadow-gold-lg text-base">
                Open Free Account <ArrowRight size={18} className="ml-2" />
              </Button>
            </Link>
            <Link to="/auth" className="w-full sm:w-auto">
              <Button variant="outline" size="xl" className="w-full px-8 border-white/10 hover:bg-white/5 backdrop-blur-md">
                <Shield size={18} className="mr-2" /> Sign In
              </Button>
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} custom={3.5} className="mt-6">
            <Link to="/signup" className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent/80 font-semibold">
              <HeartHandshake size={16} /> Start a Fundraiser <ArrowRight size={14} />
            </Link>
          </motion.div>

          {/* Live Stats Row */}
          <motion.div variants={fadeUp} custom={4} className="max-w-4xl mx-auto mt-20 pt-12 border-t border-white/5">
            <div className="grid grid-cols-3 gap-4 md:gap-12">
              {[
                { value: liveStats.members > 0 ? `${liveStats.members.toLocaleString()}+` : '—', label: 'Active Members' },
                { value: liveStats.groups > 0 ? `${liveStats.groups.toLocaleString()}+` : '—', label: 'Chama Groups' },
                { value: liveStats.savings > 0 ? formatCompact(liveStats.savings) : '—', label: 'Savings Managed' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-2xl sm:text-4xl font-bold font-display text-white">{stat.value}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mt-2">{stat.label}</p>
                </div>
              ))}
            </div>

            {!isInstalled && (
              <motion.div variants={fadeUp} custom={5} className="mt-12 flex flex-col items-center gap-3">
                <Button variant="gold" size="lg" onClick={canInstall ? promptInstall : undefined} className="gap-2 shadow-gold">
                  <Smartphone size={18} /> Download App
                </Button>
                <p className="text-[11px] text-white/40">
                  {canInstall ? 'Tap to install for a faster, offline-ready experience' : 'Open browser menu → "Add to Home Screen" to install'}
                </p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* ───── TRUST BADGES ───── */}
      <section className="py-12 bg-white/[0.02] border-y border-white/5">
        <div className="container max-w-6xl px-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-8 items-center justify-items-center opacity-60">
            {[
              { icon: Lock, label: 'SSL Encrypted' },
              { icon: ShieldCheck, label: 'Bank-Grade' },
              { icon: Banknote, label: 'M-Pesa Linked' },
              { icon: BadgeCheck, label: 'KYC Verified' },
              { icon: Eye, label: 'Transparent' },
              { icon: Building2, label: 'Kenyan Reg' },
            ].map((badge, i) => (
              <div key={i} className="flex items-center gap-2">
                <badge.icon size={14} className="text-accent" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── FEATURES ───── */}
      <section id="features" className="py-24 px-4 bg-[hsl(213,72%,8%)]">
        <div className="container max-w-6xl">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-4 block">Core Platform</span>
            <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">Everything You Need, One Platform</h2>
            <p className="text-white/50 max-w-xl mx-auto">From group savings to personal wallets — a complete digital financial ecosystem.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: PiggyBank, title: 'Smart Savings', desc: 'Daily, weekly, or monthly contributions via M-Pesa STK push.' },
              { icon: Wallet, title: 'Digital Wallet', desc: 'Deposit, transfer, request money. Full history and instant top-up.' },
              { icon: HandCoins, title: 'Secure Withdrawals', desc: 'Multi-level approval: Treasurer, Leaders, and Admin clearance.' },
              { icon: Heart, title: 'Harambee', desc: 'Create public fundraising campaigns. Accept M-Pesa from anyone.' },
              { icon: Landmark, title: 'Personal Loans', desc: 'Apply for Biashara, Elimu, or Youth Fund loans from your dashboard.' },
              { icon: Users, title: 'Role Management', desc: 'Assign Chairperson, Secretary, and Treasurer permissions.' },
              { icon: Shield, title: 'Emergency Fund', desc: 'Automatic monthly deductions to keep your group protected.' },
              { icon: Zap, title: 'Real-Time Alerts', desc: 'Instant notifications for payments, withdrawals, and approvals.' },
            ].map((feature, i) => (
              <motion.div key={i} whileHover={{ y: -5 }} className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-accent/30 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon size={22} className="text-accent" />
                </div>
                <h3 className="font-bold text-base mb-2">{feature.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── WALLET PREVIEW ───── */}
      <section id="wallet" className="py-24 px-4 bg-[hsl(213,72%,10%)] relative overflow-hidden">
        <div className="container max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="text-emerald-400 text-xs font-bold tracking-widest uppercase mb-4 block">M-Pesa Wallet</span>
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">Your Money,<br />Your Control</h2>
              <p className="text-white/60 mb-10 leading-relaxed">A full-featured digital wallet powered by M-Pesa. Deposit, transfer to members, request payments, and track every shilling.</p>
              
              <div className="space-y-4">
                {[
                  { icon: QrCode, title: 'M-Pesa Deposit', desc: 'Top up instantly via STK push' },
                  { icon: Send, title: 'Peer-to-Peer', desc: 'Send money to any registered member' },
                  { icon: ArrowDownUp, title: 'Money Requests', desc: 'Request payments from other users' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-emerald-500/20 transition-all">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><item.icon size={20} /></div>
                    <div>
                      <h4 className="font-bold text-sm">{item.title}</h4>
                      <p className="text-[11px] text-white/40">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="relative">
              {/* Wallet Mockup Card */}
              <div className="mx-auto max-w-[340px] p-8 rounded-[2.5rem] bg-gradient-to-br from-emerald-600/30 to-black border border-emerald-500/30 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Total Balance</p>
                    <p className="text-3xl font-display font-bold">KES 24,500</p>
                  </div>
                  <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400"><Wallet size={24} /></div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-8 text-center">
                  {['Deposit', 'Send', 'Pay'].map(act => (
                    <div key={act} className="bg-white/5 p-3 rounded-2xl border border-white/5 cursor-pointer hover:border-emerald-500/40 transition-all">
                      <p className="text-[10px] font-bold uppercase text-white/60">{act}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Recent Transactions</p>
                  {[
                    { n: 'Grace W.', t: 'Received', a: '+1,200', c: 'text-emerald-400' },
                    { n: 'M-Pesa Top Up', t: 'Deposit', a: '+5,000', c: 'text-emerald-400' },
                    { n: 'Peter O.', t: 'Sent', a: '-800', c: 'text-red-400' },
                  ].map((tx, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-xs font-bold">{tx.n}</p>
                        <p className="text-[10px] text-white/30">{tx.t}</p>
                      </div>
                      <span className={`text-xs font-bold ${tx.c}`}>{tx.a}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ───── HOW IT WORKS ───── */}
      <section id="how-it-works" className="py-24 px-4 bg-[hsl(213,72%,8%)]">
        <div className="container max-w-6xl">
          <div className="text-center mb-20">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-4 block">Quick Start</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold">Start in 4 Simple Steps</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 relative">
            <div className="hidden md:block absolute top-12 left-20 right-20 h-[2px] bg-white/5" />
            {[
              { i: FileCheck, s: '01', t: 'Create Account', d: 'Sign up with phone and ID in minutes.' },
              { i: Users, s: '02', t: 'Form Group', d: 'Name your Chama and set the roles.' },
              { i: UserPlus, s: '03', t: 'Add Members', d: 'Invite members via phone numbers.' },
              { i: PiggyBank, s: '04', t: 'Start Saving', d: 'Pay contributions via M-Pesa STK.' },
            ].map((step, i) => (
              <div key={i} className="text-center relative group">
                <div className="w-20 h-20 rounded-2xl bg-accent border-b-4 border-black/20 flex items-center justify-center mx-auto mb-6 shadow-gold transition-transform group-hover:scale-110">
                  <step.i size={28} className="text-black" />
                </div>
                <span className="text-[10px] font-bold text-accent uppercase tracking-widest block mb-2">Step {step.s}</span>
                <h3 className="text-lg font-bold mb-2">{step.t}</h3>
                <p className="text-xs text-white/40 max-w-[180px] mx-auto leading-relaxed">{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CHAMA EXPLORER ───── */}
      {publicChamas.length > 0 && (
        <section className="py-24 px-4 bg-white/[0.01]">
          <div className="container max-w-6xl">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
              <div>
                <h2 className="text-3xl font-display font-bold mb-2">Public Chama Groups</h2>
                <p className="text-white/50">Discover active groups and start saving together.</p>
              </div>
              <Link to="/signup">
                <Button variant="outline" className="border-white/10 hover:bg-white/5">View All Groups <ArrowRight size={16} className="ml-2" /></Button>
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicChamas.map((chama) => (
                <div key={chama.id} className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-accent/30 transition-all flex flex-col justify-between">
                  <div className="flex items-center gap-4 mb-6">
                    {chama.profile_image_url ? (
                      <img src={chama.profile_image_url} alt={chama.name} className="w-12 h-12 rounded-xl object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center font-bold text-accent">{chama.name[0]}</div>
                    )}
                    <div>
                      <h4 className="font-bold text-sm">{chama.name}</h4>
                      <p className="text-[10px] text-white/40 line-clamp-1">{chama.description || 'Public saving group'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <span className="text-[11px] font-bold text-white/60">KES {chama.contribution_amount?.toLocaleString()} / {chama.contribution_frequency}</span>
                    <Link to="/signup" className="text-accent text-[11px] font-bold hover:underline">Request to Join</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───── HARAMBEES ───── */}
      {activeHarambees.length > 0 && (
        <section className="py-24 px-4 bg-[hsl(213,72%,8%)]">
          <div className="container max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">Active Harambees</h2>
              <p className="text-white/50 max-w-xl mx-auto mb-8">Support community causes or start your own fundraiser with verified tracking.</p>
              <Link to="/signup">
                <Button variant="hero" size="lg" className="shadow-gold-lg gap-2">
                  <HeartHandshake size={20} /> Start a Fundraiser
                </Button>
              </Link>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-8 no-scrollbar snap-x px-4 -mx-4">
              {activeHarambees.map((h, i) => {
                const progress = h.target_amount > 0 ? Math.min(100, Math.round((h.raised_amount / h.target_amount) * 100)) : 0;
                const daysLeft = h.deadline ? Math.max(0, Math.ceil((new Date(h.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
                return (
                  <div key={h.id} className="min-w-[300px] snap-start shrink-0 rounded-3xl bg-white/[0.03] border border-white/5 overflow-hidden flex flex-col p-6 hover:border-accent/20 transition-all">
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400"><Heart size={20} /></div>
                      {daysLeft !== null && <span className="text-[10px] font-bold bg-white/5 px-2 py-1 rounded-full text-white/60">{daysLeft}d left</span>}
                    </div>
                    <h4 className="font-bold mb-2 line-clamp-1">{h.title}</h4>
                    <p className="text-xs text-white/40 line-clamp-2 mb-6 leading-relaxed">{h.description}</p>
                    
                    <div className="mt-auto space-y-3">
                      <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-accent">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span>KES {h.raised_amount.toLocaleString()}</span>
                        <span className="text-[10px] text-white/30">Target: {h.target_amount.toLocaleString()}</span>
                      </div>
                      <Link to={`/harambee/${h.order_number}`} className="block pt-2">
                        <Button variant="gold" size="sm" className="w-full text-xs">Contribute Now</Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ───── LOANS ───── */}
      <section id="loans" className="py-24 px-4 bg-[hsl(213,72%,10%)]">
        <div className="container max-w-6xl">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-4 block">Financing</span>
            <h2 className="text-3xl md:text-5xl font-display font-bold">Personal & Business Loans</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Biashara Loan', desc: 'For business growth and expansion', rate: '10%', max: '500,000', icon: '🏪' },
              { name: 'Elimu Loan', desc: 'Education financing for students', rate: '8%', max: '300,000', icon: '📚' },
              { name: 'Youth Fund', desc: 'Empowering young entrepreneurs', rate: '8%', max: '200,000', icon: '🚀' },
            ].map((loan, i) => (
              <div key={i} className="rounded-3xl bg-white/[0.03] border border-white/5 p-8 flex flex-col hover:bg-white/[0.05] transition-all">
                <div className="flex justify-between items-start mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl">{loan.icon}</div>
                  <div className="px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold">{loan.rate} p.a</div>
                </div>
                <h3 className="text-xl font-bold mb-3">{loan.name}</h3>
                <p className="text-sm text-white/50 leading-relaxed mb-10">{loan.desc}</p>
                <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-white/30 font-bold uppercase">Up to</p>
                    <p className="text-lg font-display font-bold">KES {loan.max}</p>
                  </div>
                  <Link to="/signup"><Button variant="gold" size="sm">Apply</Button></Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── SECURITY ───── */}
      <section className="py-24 px-4">
        <div className="container max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-red-400 text-xs font-bold tracking-widest uppercase mb-4 block">Data Protection</span>
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">Bank-Grade<br />Security Built In</h2>
              <p className="text-white/60 text-lg leading-relaxed mb-8">Your money and personal data are protected by multi-layered encryption and decentralized approval flows.</p>
              
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Lock, title: 'Encryption', desc: 'End-to-end data security' },
                  { icon: ShieldCheck, title: 'Multi-Sig', desc: 'Leader approval for funds' },
                  { icon: BadgeCheck, title: 'KYC', desc: 'ID verified transactions' },
                  { icon: Eye, title: 'Audit Trail', desc: 'Full activity logging' },
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <item.icon size={18} className="text-red-400 mb-2" />
                    <h4 className="font-bold text-xs mb-1">{item.title}</h4>
                    <p className="text-[10px] text-white/40">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative group">
               <div className="absolute inset-0 bg-red-500/10 blur-[100px] rounded-full group-hover:bg-red-500/20 transition-colors" />
               <div className="relative p-10 rounded-[3rem] bg-white/[0.03] border border-white/10 backdrop-blur-sm text-center">
                  <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShieldCheck size={40} className="text-red-400" />
                  </div>
                  <h3 className="text-2xl font-display font-bold mb-4">Secured by Dasnet</h3>
                  <div className="space-y-4">
                     {[ '128-bit Encryption', 'Biometric Support', '3-Factor Withdrawal' ].map(txt => (
                       <div key={txt} className="flex items-center gap-3 text-sm text-white/60 justify-center">
                         <CheckCircle size={14} className="text-emerald-500" /> {txt}
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section id="faq" className="py-24 px-4 bg-[hsl(213,72%,8%)]">
        <div className="container max-w-3xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-display font-bold">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <span className="font-bold text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown className={`transition-transform duration-300 ${openFaq === i ? 'rotate-180 text-accent' : 'text-white/20'}`} size={18} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-6 pb-6 text-sm text-white/50 leading-relaxed"
                    >
                      {faq.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── DOWNLOAD ───── */}
      {!isInstalled && (
        <section className="py-20 px-4">
          <div className="container max-w-4xl">
            <div className="p-8 md:p-12 rounded-[2.5rem] bg-gradient-to-br from-accent/20 to-transparent border border-accent/20 text-center">
              <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-accent"><Smartphone size={32} /></div>
              <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Install Dasnet for Mobile</h2>
              <p className="text-white/50 mb-8 max-w-md mx-auto">Get instant notifications, offline access, and a native app experience on your smartphone.</p>
              <Button variant="hero" size="xl" onClick={canInstall ? promptInstall : undefined} className="shadow-gold-lg">
                {canInstall ? 'Install App Now' : 'Check Browser Menu to Install'}
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ───── FOOTER ───── */}
      <footer className="bg-black/40 border-t border-white/5 pt-24 pb-12 px-6">
        <div className="container max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2 md:col-span-1">
              <Logo size="md" variant="white" />
              <p className="text-sm text-white/40 mt-6 leading-relaxed">Kenya's most trusted digital banking for Chamas, wallets, and community fundraisers.</p>
              <div className="flex gap-4 mt-8">
                {[Globe, Phone, Mail].map((Icon, idx) => (
                  <div key={idx} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-accent hover:text-black transition-all cursor-pointer">
                    <Icon size={18} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-8">Platform</h4>
              <ul className="space-y-4 text-sm text-white/60">
                <li><Link to="/signup" className="hover:text-accent">Chama Groups</Link></li>
                <li><Link to="/signup" className="hover:text-accent">Digital Wallet</Link></li>
                <li><Link to="/loan-products" className="hover:text-accent">Loans</Link></li>
                <li><Link to="/signup" className="hover:text-accent">Harambee</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-8">Company</h4>
              <ul className="space-y-4 text-sm text-white/60">
                <li><Link to="/about" className="hover:text-accent">About Us</Link></li>
                <li><Link to="/contact" className="hover:text-accent">Contact</Link></li>
                <li><Link to="/terms" className="hover:text-accent">Terms of Service</Link></li>
                <li><Link to="/terms" className="hover:text-accent">Privacy Policy</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-8">Contacts</h4>
              <div className="space-y-4 text-sm text-white/60">
                <p className="flex items-center gap-3"><Phone size={14} className="text-accent" /> +254 725 336 731</p>
                <p className="flex items-center gap-3"><Mail size={14} className="text-accent" /> support@dasnet.site</p>
                <p className="flex items-center gap-3"><MapPin size={14} className="text-accent" /> Nairobi, Kenya</p>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[11px] text-white/20 font-bold uppercase tracking-widest">© {new Date().getFullYear()} DASNET VENTURES LTD. ALL RIGHTS RESERVED.</p>
            <div className="flex items-center gap-6 text-[10px] font-bold text-white/40 uppercase tracking-widest">
              <span>Chama</span> <span>Wallet</span> <span>Loans</span> <span>Harambee</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
