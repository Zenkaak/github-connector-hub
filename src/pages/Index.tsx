import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Shield, Users, CheckCircle, Star, Zap, MapPin,
  ArrowUpRight, FileCheck, HeartHandshake, ChevronDown, Wallet, BadgeCheck,
  Globe, TrendingUp, PiggyBank, UserPlus, HandCoins, FileText,
  Heart, Lock, Send, ArrowDownUp, Landmark, Eye, ShieldCheck,
  Building2, Banknote, QrCode, Menu, X, Sparkles, Phone, Mail, Clock
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import bgHero from "@/assets/bg-hero.png";
import bgHarambee from "@/assets/bg-harambee.png";
import bgChama from "@/assets/bg-chama.png";
import bgWallet from "@/assets/bg-wallet.png";
import bgLoans from "@/assets/bg-loans.png";
import bgSecurity from "@/assets/bg-security.png";

function Logo({ size = "md", variant = "white" }: { size?: "sm" | "md" | "lg", variant?: "white" | "gold" }) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl"
  };
  return (
    <div className={cn("font-display font-bold tracking-tight flex items-center gap-2", sizeClasses[size])}>
      <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-accent-foreground shadow-[0_0_24px_-4px_hsl(42_88%_55%_/_0.55)]">
        <ShieldCheck size={16} />
      </div>
      <div className="flex items-baseline gap-1.5 leading-none">
        <span className={variant === "white" ? "text-white" : "text-accent"}>DASNET</span>
        <span className="text-accent/90 text-[10px] font-semibold tracking-[0.22em] uppercase">Ventures</span>
      </div>
    </div>
  );
}

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
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Explore Chamas', href: '/signup' },
  ]},
];

const activeHarambees = [
  { id: 1, title: 'Medical Bill', beneficiary_name: 'John Kamau', description: 'Help us cover emergency surgery costs for our father following a severe accident.', target_amount: 500000, raised_amount: 320000, deadline: '2024-12-31' },
  { id: 2, title: 'University Fees', beneficiary_name: 'Grace Wanjiku', description: 'Raising tuition fees for Grace to join University of Nairobi for her Engineering degree.', target_amount: 150000, raised_amount: 85000, deadline: '2024-09-15' },
  { id: 3, title: 'Business Rebuild', beneficiary_name: 'Peter Ochieng', description: 'Assisting Peter rebuild his electronics shop after the recent market fire.', target_amount: 300000, raised_amount: 45000, deadline: '2024-10-30' }
];

const publicChamas = [
  { id: 1, name: 'Umoja Investment Group', description: 'A group of young professionals pooling resources for real estate investments in Kitengela.', contribution_amount: 5000, contribution_frequency: 'monthly', max_members: 50, members_count: 42 },
  { id: 2, name: 'Baraka Women Savings', description: 'Women supporting women through table banking and small business loans.', contribution_amount: 1000, contribution_frequency: 'weekly', max_members: 30, members_count: 28 },
  { id: 3, name: 'Tech Innovators Chama', description: 'Software developers saving towards launching a tech startup incubator.', contribution_amount: 10000, contribution_frequency: 'monthly', max_members: 20, members_count: 15 }
];

const liveStats = {
  members: 12480,
  groups: 312,
  savings: 48500000
};

const testimonials = [
  { initials: 'JK', name: 'Joyce Kariuki', role: 'Chairperson, Umoja Group · Nairobi',
    quote: 'DASNET took our 30-member chama from messy WhatsApp tracking to a transparent system. Withdrawals are smooth and everyone trusts the books now.' },
  { initials: 'SM', name: 'Samuel Mwangi', role: 'Treasurer · Mombasa',
    quote: 'M-Pesa STK push made monthly contributions effortless. We grew from KES 80,000 to KES 1.2M in eight months without ever chasing a member.' },
  { initials: 'AW', name: 'Amina Wekesa', role: 'Harambee Organizer · Eldoret',
    quote: 'I raised KES 240,000 for my sister\u2019s medical bill in less than two weeks. The verification gave donors real confidence to give.' },
];

const appHighlights = [
  { icon: BadgeCheck, label: 'KYC verified accounts' },
  { icon: Lock, label: 'Biometric login' },
  { icon: Zap, label: 'Real-time alerts' },
  { icon: ShieldCheck, label: 'Secure offline mode' },
];

export default function Index() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const formatCompact = (n: number) => {
    if (n >= 1000000) return `KES ${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `KES ${(n / 1000).toFixed(0)}K`;
    return `KES ${n.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[hsl(218,55%,6%)] antialiased text-white/90 selection:bg-accent/25 selection:text-white">

      {/* ───── HEADER ───── */}
      <header className="fixed top-0 left-0 right-0 z-50">
        {/* Top contact strip */}
        <div className="hidden md:block bg-[hsl(218,55%,4%)]/95 backdrop-blur-xl border-b border-white/[0.05]">
          <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-[11px] text-white/60 h-9">
            <div className="flex items-center gap-5">
              <span className="flex items-center gap-1.5"><Phone size={11} className="text-accent" /> +254 700 000 000</span>
              <span className="flex items-center gap-1.5"><Mail size={11} className="text-accent" /> support@dasnet.co.ke</span>
              <span className="flex items-center gap-1.5"><Banknote size={11} className="text-accent" /> M-Pesa Paybill: 522522</span>
            </div>
            <div className="flex items-center gap-5">
              <span className="flex items-center gap-1.5"><Clock size={11} className="text-accent" /> Mon–Sat · 8am – 8pm EAT</span>
              <a href="#download" className="flex items-center gap-1 text-accent hover:text-white transition-colors font-semibold">
                Get the App <ArrowRight size={10} />
              </a>
            </div>
          </div>
        </div>

        <div className="mx-3 sm:mx-6 mt-3 sm:mt-3">
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
                  <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                    <Button variant="ghost" size="sm" className="w-full text-white/85 hover:bg-white/[0.05] rounded-full">
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/signup" onClick={() => setMobileMenuOpen(false)} className="flex-1">
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
      <section className="relative pt-28 pb-20 sm:pt-36 sm:pb-28 md:pt-52 md:pb-36 px-4 overflow-hidden bg-[hsl(218,55%,6%)]">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${bgHero})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(218,55%,6%)]/85 via-[hsl(218,55%,6%)]/75 to-[hsl(218,55%,6%)]/95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,_hsl(42_88%_55%_/_0.07),_transparent_70%)]" />
        
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
            Save smarter.
            <br />
            <span className="text-accent">Grow together.</span>
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

          <motion.div
            variants={fadeUp}
            custom={5}
            className="max-w-2xl mx-auto mt-16 sm:mt-20 pt-10 border-t border-white/[0.06]"
          >
            <div className="grid grid-cols-3 divide-x divide-white/[0.05]">
              {[
                { value: `${liveStats.members.toLocaleString()}+`, label: 'Active members' },
                { value: `${liveStats.groups.toLocaleString()}+`, label: 'Chama groups' },
                { value: formatCompact(liveStats.savings), label: 'Savings managed' },
              ].map((stat, i) => (
                <div key={i} className="text-center px-2 sm:px-4">
                  <p className="text-2xl sm:text-3xl md:text-[2.25rem] font-semibold text-white font-display tracking-[-0.02em]">
                    {stat.value}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-white/45 mt-2 uppercase tracking-[0.16em] font-medium">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
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
      <section className="py-16 sm:py-24 px-4 relative">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${bgHarambee})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(218,55%,7%)]/95 via-[hsl(218,55%,7%)]/90 to-[hsl(218,55%,7%)]/95" />
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
                      <Link to="/signup" className="flex-1">
                        <Button variant="gold" size="sm" className="w-full text-[12px] h-8 !shadow-none font-semibold">
                          Contribute
                        </Button>
                      </Link>
                      <Link to="/signup" className="flex-1">
                        <Button variant="ghost" size="sm" className="w-full text-[12px] h-8 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] border border-white/[0.05]">
                          Share
                        </Button>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          <div className="mt-8 text-center sm:hidden">
            <Link to="/signup">
              <Button variant="ghost" size="sm" className="text-white/65 hover:text-accent gap-1 text-[13px]">
                View all appeals <ArrowRight size={13} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ───── PLATFORM FEATURES ───── */}
      <section id="features" className="py-20 sm:py-28 px-4 border-t border-white/[0.04] bg-[hsl(218,55%,6%)]">
        <div className="container max-w-6xl">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16 sm:mb-20"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-[1.75rem] sm:text-[2.5rem] font-semibold mb-4 text-white tracking-[-0.02em] leading-[1.1]">
              Everything a modern Chama needs
            </h2>
            <p className="text-[14px] sm:text-[16px] text-white/55 leading-relaxed">
              We've digitized every aspect of traditional savings groups, adding transparency, security, and automated M-Pesa integration.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group p-5 sm:p-6 rounded-2xl bg-white/[0.015] border border-white/[0.05] hover:bg-white/[0.03] hover:border-white/[0.1] transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-[hsl(218,55%,12%)] border border-white/[0.08] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <feature.icon size={18} className="text-accent" />
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-2 tracking-[-0.01em]">{feature.title}</h3>
                <p className="text-[13px] text-white/50 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
            {/* ───── PUBLIC CHAMAS ───── */}
      <section className="py-16 sm:py-24 px-4 relative">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${bgChama})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(218,55%,6%)]/95 via-[hsl(218,55%,6%)]/90 to-[hsl(218,55%,6%)]/95" />
        <div className="container max-w-6xl relative z-10">
          <motion.div
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 sm:mb-12"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/60 mb-4 border border-white/[0.06]">
                <Globe size={12} className="text-accent" /> Public Groups
              </span>
              <h2 className="font-display text-[1.75rem] sm:text-[2.25rem] md:text-[2.5rem] font-semibold mb-2 text-white tracking-[-0.025em] leading-[1.1]">
                Join an open Chama
              </h2>
              <p className="text-white/55 max-w-lg text-[14px] sm:text-[15px] leading-relaxed">
                Looking for a group to join? Browse publicly listed savings groups looking for new members.
              </p>
            </div>
            <Link to="/signup" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm" className="text-white/65 hover:text-accent hover:bg-transparent gap-1 -mr-2 text-[13px]">
                Explore all groups <ArrowRight size={13} />
              </Button>
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicChamas.map((group, i) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/signup`} className="block group h-full">
                  <div className="p-5 sm:p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] group-hover:border-white/[0.15] group-hover:bg-white/[0.04] transition-all duration-300 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl bg-[hsl(218,55%,12%)] border border-white/[0.08] flex items-center justify-center shrink-0">
                        <Users size={20} className="text-white/70" />
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[14px] font-semibold text-white">
                          KES {group.contribution_amount.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                          per {group.contribution_frequency}
                        </span>
                      </div>
                    </div>
                    
                    <h3 className="font-display font-semibold text-[16px] text-white mb-2 group-hover:text-accent transition-colors">
                      {group.name}
                    </h3>
                    
                    {group.description && (
                      <p className="text-[13px] text-white/50 line-clamp-2 mb-6 flex-1 leading-relaxed">
                        {group.description}
                      </p>
                    )}
                    
                    <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2 text-[12px] text-white/60">
                        <Users size={14} className="text-white/40" />
                        <span>{group.members_count} / {group.max_members} members</span>
                      </div>
                      <span className="text-accent group-hover:translate-x-1 transition-transform">
                        <ArrowRight size={16} />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link to="/signup">
              <Button variant="ghost" size="sm" className="text-white/65 hover:text-accent gap-1 text-[13px]">
                Explore all groups <ArrowRight size={13} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ───── WALLET ───── */}
      <section id="wallet" className="py-20 sm:py-28 px-4 border-t border-white/[0.04] relative">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${bgWallet})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(218,55%,6%)]/95 via-[hsl(218,55%,6%)]/90 to-[hsl(218,55%,6%)]/95" />
        <div className="container max-w-6xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/60 mb-6 border border-white/[0.06]">
                <Wallet size={12} className="text-accent" /> Digital Wallet
              </span>
              <h2 className="font-display text-[2rem] sm:text-[2.5rem] font-semibold mb-4 text-white tracking-[-0.02em] leading-[1.1]">
                Your money, under your control.
              </h2>
              <p className="text-[15px] sm:text-[16px] text-white/55 mb-8 leading-relaxed">
                The DASNET digital wallet allows you to deposit funds via M-Pesa, transfer to other members instantly, and receive payouts securely.
              </p>

              <div className="space-y-4">
                {walletFeatures.map((feature, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                      <feature.icon size={18} className="text-white/70" />
                    </div>
                    <div>
                      <h4 className="text-[14px] font-semibold text-white mb-1">{feature.title}</h4>
                      <p className="text-[13px] text-white/50 leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <Link to="/signup">
                  <Button variant="gold" className="rounded-full !shadow-none font-semibold px-6">
                    Create Wallet
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute inset-0 bg-accent/20 blur-[100px] rounded-full" />
              <div className="relative rounded-3xl bg-[hsl(218,55%,8%)] border border-white/[0.08] shadow-2xl p-6 sm:p-8 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2" />
                
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <p className="text-[12px] text-white/50 uppercase tracking-wider font-medium mb-1">Available Balance</p>
                    <p className="font-display text-3xl font-semibold text-white">KES 45,250.00</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                    <Wallet size={20} className="text-accent" />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-8">
                  {[
                    { icon: ArrowDownUp, label: 'Send' },
                    { icon: QrCode, label: 'Deposit' },
                    { icon: Send, label: 'Request' },
                    { icon: Shield, label: 'Save' },
                  ].map((action, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.06] transition-colors cursor-pointer">
                        <action.icon size={18} className="text-white/70" />
                      </div>
                      <span className="text-[11px] text-white/60 font-medium">{action.label}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-[12px] font-medium text-white/50 uppercase tracking-wider mb-4">Recent Activity</p>
                  <div className="space-y-4">
                    {[
                      { title: 'Chama Contribution', desc: 'Umoja Group', amount: '-5,000', type: 'out' },
                      { title: 'Wallet Deposit', desc: 'M-Pesa STK', amount: '+10,000', type: 'in' },
                      { title: 'Loan Disbursement', desc: 'Biashara Loan', amount: '+50,000', type: 'in' },
                    ].map((tx, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center",
                            tx.type === 'in' ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.04] text-white/60"
                          )}>
                            {tx.type === 'in' ? <ArrowDownUp size={14} className="rotate-180" /> : <ArrowDownUp size={14} />}
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-white">{tx.title}</p>
                            <p className="text-[11px] text-white/40">{tx.desc}</p>
                          </div>
                        </div>
                        <span className={cn(
                          "text-[13px] font-semibold",
                          tx.type === 'in' ? "text-emerald-400" : "text-white"
                        )}>{tx.amount}</span>
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
      <section id="loans" className="py-20 sm:py-28 px-4 relative border-t border-white/[0.04]">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${bgLoans})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(218,55%,5%)]/95 via-[hsl(218,55%,5%)]/90 to-[hsl(218,55%,5%)]/95" />
        <div className="container max-w-5xl relative z-10">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/60 mb-4 border border-white/[0.06]">
              <Landmark size={12} className="text-accent" /> Personal Loans
            </span>
            <h2 className="font-display text-[1.75rem] sm:text-[2.5rem] font-semibold mb-4 text-white tracking-[-0.02em] leading-[1.1]">
              Credit that grows with you
            </h2>
            <p className="text-[14px] sm:text-[16px] text-white/55 leading-relaxed">
              Access affordable personal loans based on your Chama savings history and wallet activity.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
            {loanProducts.map((loan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
                  <loan.icon size={22} className="text-accent" />
                </div>
                <h3 className="font-display text-[18px] font-semibold text-white mb-2">{loan.name}</h3>
                <p className="text-[13px] text-white/50 mb-6 min-h-[40px]">{loan.desc}</p>
                
                <div className="space-y-3 mb-8">
                  <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                    <span className="text-[12px] text-white/50">Interest Rate</span>
                    <span className="text-[13px] font-semibold text-white">{loan.rate}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                    <span className="text-[12px] text-white/50">Max Amount</span>
                    <span className="text-[13px] font-semibold text-white">{loan.max}</span>
                  </div>
                </div>

                <Link to="/signup" className="block">
                  <Button variant="outline" className="w-full text-white/70 hover:text-white border-white/[0.1] hover:bg-white/[0.05]">
                    Apply Now
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
            {/* ───── SECURITY ───── */}
      <section className="py-20 sm:py-28 px-4 relative border-t border-white/[0.04]">
        <div className="absolute inset-0" style={{ backgroundImage: `url(${bgSecurity})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0 bg-[hsl(218,55%,6%)]/95" />
        <div className="container max-w-5xl relative z-10">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <ShieldCheck size={32} className="text-accent mx-auto mb-6 opacity-80" />
            <h2 className="font-display text-[1.75rem] sm:text-[2.5rem] font-semibold mb-4 text-white tracking-[-0.02em] leading-[1.1]">
              Bank-grade security built-in
            </h2>
            <p className="text-[14px] sm:text-[16px] text-white/55 leading-relaxed">
              We protect your funds and data with enterprise-level security protocols, multi-signature approvals, and continuous audits.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {securityFeatures.map((sec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="text-center p-6"
              >
                <sec.icon size={24} className="text-white/40 mx-auto mb-4" />
                <h4 className="text-[14px] font-semibold text-white mb-2">{sec.title}</h4>
                <p className="text-[12px] text-white/40 leading-relaxed">{sec.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
            {/* ───── HOW IT WORKS ───── */}
      <section id="how-it-works" className="py-20 sm:py-28 px-4 border-t border-white/[0.04] bg-[hsl(218,55%,7%)]">
        <div className="container max-w-4xl">
          <motion.div
            className="text-center mb-16 sm:mb-20"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-[1.75rem] sm:text-[2.5rem] font-semibold mb-4 text-white tracking-[-0.02em] leading-[1.1]">
              Start saving in minutes
            </h2>
            <p className="text-[14px] sm:text-[16px] text-white/55 leading-relaxed">
              No paperwork, no bank queues. Set up your group entirely from your phone.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-10 sm:gap-y-16">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                className="relative flex gap-5"
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="shrink-0 pt-1">
                  <div className="text-[10px] font-bold text-accent/60 uppercase tracking-widest mb-2">{step.step}</div>
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                    <step.icon size={20} className="text-white/80" />
                  </div>
                </div>
                <div className="pt-7">
                  <h3 className="text-[16px] font-semibold text-white mb-2 tracking-[-0.01em]">{step.title}</h3>
                  <p className="text-[14px] text-white/50 leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="mt-16 sm:mt-20 text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Link to="/signup">
              <Button variant="gold" size="lg" className="rounded-full px-8 !shadow-none font-semibold h-12">
                Create your account
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ───── TESTIMONIALS ───── */}
      <section className="py-20 sm:py-28 px-4 border-t border-white/[0.04] bg-[hsl(218,55%,6%)]">
        <div className="container max-w-6xl">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-14"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/60 mb-4 border border-white/[0.06]">
              <Star size={11} className="text-accent" /> Loved by Kenyans
            </span>
            <h2 className="font-display text-[1.75rem] sm:text-[2.5rem] font-semibold mb-4 text-white tracking-[-0.02em] leading-[1.1]">
              Trusted by groups across Kenya
            </h2>
            <p className="text-[14px] sm:text-[16px] text-white/55 leading-relaxed">
              Real stories from members who rely on DASNET VENTURES every day.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-6 flex flex-col hover:border-white/[0.12] transition-colors"
              >
                <div className="flex gap-0.5 mb-4 text-accent">
                  {[...Array(5)].map((_, s) => <Star key={s} size={13} fill="currentColor" />)}
                </div>
                <p className="text-[14px] text-white/75 leading-relaxed flex-1">"{t.quote}"</p>
                <div className="mt-6 pt-5 border-t border-white/[0.05] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-accent font-semibold text-[13px]">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-white">{t.name}</p>
                    <p className="text-[11px] text-white/45 flex items-center gap-1"><MapPin size={10} /> {t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
            {/* ───── FAQ ───── */}
      <section id="faq" className="py-20 sm:py-28 px-4 border-t border-white/[0.04] bg-[hsl(218,55%,5%)]">
        <div className="container max-w-3xl">
          <motion.div
            className="text-center mb-12 sm:mb-16"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-[1.75rem] sm:text-[2.25rem] font-semibold mb-4 text-white tracking-[-0.02em]">
              Common questions
            </h2>
          </motion.div>

          <div className="space-y-2 sm:space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.01] overflow-hidden"
              >
                <button
                  className="w-full text-left px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between focus:outline-none focus-visible:bg-white/[0.02]"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-[14px] sm:text-[15px] text-white/90 pr-4">{faq.q}</span>
                  <ChevronDown
                    size={18}
                    className={cn(
                      "text-white/40 shrink-0 transition-transform duration-300",
                      openFaq === i && "rotate-180 text-accent"
                    )}
                  />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-5 sm:px-6 pb-5 pt-1 text-[13.5px] sm:text-[14px] text-white/55 leading-relaxed">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── DOWNLOAD APP ───── */}
      <section id="download" className="py-20 sm:py-28 px-4 border-t border-white/[0.04] bg-[hsl(218,55%,7%)] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,_hsl(42_88%_55%_/_0.07),_transparent_60%)]" />
        <div className="container max-w-5xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/60 mb-4 border border-white/[0.06]">
                <Sparkles size={11} className="text-accent" /> Mobile App
              </span>
              <h2 className="font-display text-[1.75rem] sm:text-[2.5rem] font-semibold mb-4 text-white tracking-[-0.02em] leading-[1.1]">
                Carry your Chama in your pocket
              </h2>
              <p className="text-[14px] sm:text-[16px] text-white/55 leading-relaxed mb-8">
                Manage contributions, approve withdrawals, and track Harambees — all from your phone. Coming soon to iOS and Android.
              </p>
              <div className="flex flex-wrap gap-3">
                <a href="#" className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center"><Phone size={16} className="text-accent" /></div>
                  <div className="leading-tight">
                    <p className="text-[10px] text-white/50 uppercase tracking-wider">Coming soon</p>
                    <p className="text-[14px] font-semibold text-white">App Store</p>
                  </div>
                </a>
                <a href="#" className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center"><Phone size={16} className="text-accent" /></div>
                  <div className="leading-tight">
                    <p className="text-[10px] text-white/50 uppercase tracking-wider">Coming soon</p>
                    <p className="text-[14px] font-semibold text-white">Google Play</p>
                  </div>
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="grid grid-cols-2 gap-3"
            >
              {appHighlights.map((item, i) => (
                <div key={i} className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-5 flex flex-col gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                    <item.icon size={16} className="text-accent" />
                  </div>
                  <p className="text-[13px] font-medium text-white/85 leading-snug">{item.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>
            {/* ───── CTA FOOTER ───── */}
      <section className="py-24 sm:py-32 px-4 border-t border-white/[0.04] bg-[hsl(218,55%,6%)] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,_hsl(42_88%_55%_/_0.08),_transparent_60%)]" />
        <div className="container max-w-4xl text-center relative z-10">
          <h2 className="font-display text-[2rem] sm:text-[3rem] font-semibold mb-6 text-white tracking-[-0.02em] leading-[1.05]">
            Ready to modernize your savings?
          </h2>
          <p className="text-[15px] sm:text-[16px] text-white/55 mb-10 max-w-xl mx-auto leading-relaxed">
            Join thousands of Kenyans using DASNET VENTURES LTD to manage their Chamas, access loans, and support each other.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup" className="w-full sm:w-auto">
              <Button variant="gold" size="lg" className="w-full sm:w-auto rounded-full font-semibold px-8 h-12 !shadow-none">
                Open Free Account
              </Button>
            </Link>
            <Link to="/auth" className="w-full sm:w-auto">
              <Button variant="ghost" size="lg" className="w-full sm:w-auto rounded-full text-white/70 hover:text-white border border-white/[0.08] hover:bg-white/[0.04] h-12 px-8">
                Sign In to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="border-t border-white/[0.06] bg-[hsl(218,55%,4%)] pt-16 pb-8 px-4">
        <div className="container max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-y-12 gap-x-8 mb-16">
            <div className="col-span-2">
              <Logo size="md" variant="white" />
              <p className="text-[13px] text-white/45 mt-5 max-w-xs leading-relaxed">
                Kenya's premier digital banking platform for Chamas, personal loans, wallets, and Harambee fundraising. Built for trust.
              </p>
              <div className="mt-6 flex items-center gap-4 text-white/40">
                <a href="mailto:support@dasnett.site" className="hover:text-white transition-colors" aria-label="Email Support"><Mail size={18} /></a>
                <a href="tel:+254751414437" className="hover:text-white transition-colors" aria-label="Phone Support"><Phone size={18} /></a>
              </div>
            </div>

            {footerColumns.map((col, i) => (
              <div key={i}>
                <h4 className="font-semibold text-white text-[13px] mb-5 tracking-wide">{col.title}</h4>
                <ul className="space-y-3.5">
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <Link to={link.href} className="text-[13px] text-white/50 hover:text-accent transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-white/40">
            <p>© {new Date().getFullYear()} DASNET VENTURES LTD. All rights reserved.</p>
            <div className="flex gap-6">
              <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-white">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
