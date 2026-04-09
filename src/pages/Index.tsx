import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Shield,
  Clock,
  Users,
  CheckCircle,
  Star,
  Zap,
  Phone,
  Mail,
  MapPin,
  ArrowUpRight,
  FileCheck,
  CreditCard,
  HeartHandshake,
  ChevronDown,
  Wallet,
  BadgeCheck,
  Globe,
  TrendingUp,
  Award,
  PiggyBank,
  UserPlus,
  HandCoins,
  FileText,
  MessageSquare,
  Smartphone,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

// --- Animation Variants ---
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

// --- Professional Copy Data ---
const faqs = [
  { q: 'What is a Chama?', a: 'A Chama is a traditional Kenyan investment and savings group. DASNET VENTURES digitizes this model to streamline contribution tracking, enhance security, and automate financial reporting.' },
  { q: 'How do I establish a Chama group?', a: 'Upon registration, navigate to "Chama Groups" and select "New Group." You will be designated as the Chairperson. You can then invite members via phone number and assign administrative roles such as Secretary and Treasurer.' },
  { q: 'How are contributions managed?', a: 'Groups can configure daily, weekly, or monthly fiscal cycles. Contributions are processed via integrated M-Pesa STK Push, providing real-time visibility into group liquidity and arrears.' },
  { q: 'What is the withdrawal protocol?', a: 'Withdrawals require a multi-level authorization workflow. Requests are initiated by the Treasurer and must be digitally approved by the Chairperson and Secretary before final disbursement.' },
  { q: 'Are credit facilities available?', a: 'Yes. Beyond group savings, DASNET VENTURES provides access to specialized credit products, including Biashara, Elimu, and Youth Fund loans, subject to account verification.' },
  { q: 'How is data and capital secured?', a: 'We utilize bank-grade encryption and multi-factor authorization. Every transaction is recorded on a transparent digital audit trail with immutable timestamps for absolute accountability.' },
];

export default function Index() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[hsl(213,72%,8%)]">
      {/* ───── NAVIGATION ───── */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-4 mt-3">
          <div className="glass-dark rounded-2xl shadow-lg max-w-6xl mx-auto border border-white/[0.06]">
            <div className="flex items-center justify-between h-[60px] px-5 md:px-6">
              <Logo size="md" variant="white" />
              <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-white/40">
                <a href="#features" className="hover:text-white/80 transition-colors">Features</a>
                <a href="#how-it-works" className="hover:text-white/80 transition-colors">Process</a>
                <a href="#loans" className="hover:text-white/80 transition-colors">Credit</a>
                <a href="#faq" className="hover:text-white/80 transition-colors">Support</a>
              </nav>
              <div className="flex items-center gap-2">
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-[13px] text-white/60 hover:text-white hover:bg-white/[0.06]">Sign In</Button>
                </Link>
                <Link to="/signup">
                  <Button variant="gold" size="sm" className="text-[13px] shadow-gold">
                    Get Started
                    <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ───── HERO SECTION ───── */}
      <section className="hero-gradient pt-36 pb-32 md:pt-44 md:pb-44 px-4 relative overflow-hidden noise-overlay">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(42_92%_56%_/_0.08),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(156_72%_38%_/_0.05),_transparent_50%)]" />
        <div className="absolute inset-0 grid-pattern opacity-[0.02]" />
        
        <motion.div className="container max-w-5xl text-center relative z-10" initial="hidden" animate="visible" variants={stagger}>
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/80 text-[13px] mb-8">
            <Users size={14} className="text-accent" />
            Fintech Solutions &bull; Digital Chamas &bull; Strategic Credit
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} className="font-display text-[2.5rem] sm:text-5xl md:text-6xl lg:text-[4.25rem] font-bold text-white mb-6 leading-[1.06] tracking-tight">
            Collaborative Finance,
            <br />
            <span className="bg-gradient-to-r from-accent via-gold-300 to-accent bg-clip-text text-transparent animate-gradient">
              Digitally Reimagined
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} className="text-base sm:text-lg text-white/40 max-w-xl mx-auto mb-10 leading-relaxed">
            Revolutionize your savings group with institutional-grade management tools. Secure contributions, transparent governance, and seamless M-Pesa integration.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup">
              <Button variant="hero" size="xl" className="min-w-[220px] shadow-gold-lg">
                Establish Your Chama
                <ArrowRight size={20} />
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="outline" size="xl" className="border-white/10 text-white hover:bg-white/[0.06] backdrop-blur-sm min-w-[160px]">
                Member Login
              </Button>
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} custom={4} className="max-w-md mx-auto mt-16 pt-10 border-t border-white/[0.06]">
            <div className="grid grid-cols-3 gap-6 md:gap-12">
              {[
                { value: '5,000+', label: 'Verified Members' },
                { value: '1,200+', label: 'Active Chamas' },
                { value: 'KES 50M+', label: 'Capital Managed' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white font-display">{stat.value}</p>
                  <p className="text-[10px] text-white/25 mt-1 uppercase tracking-[0.15em] font-semibold">{stat.label}</p>
                </div>
              ))}
            </div>
            {!isInstalled && (
              <motion.div variants={fadeUp} custom={5} className="mt-8 flex flex-col items-center gap-2">
                <Button variant="gold" size="lg" onClick={promptInstall} className="animate-pulse gap-2.5 shadow-gold">
                  <Smartphone size={18} />
                  Download Platform
                </Button>
                <p className="text-[11px] text-white/30 text-center">Install for high-performance, offline-ready access</p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* ───── CORE FEATURES ───── */}
      <section id="features" className="py-24 md:py-28 px-4 bg-[hsl(213,72%,8%)] relative">
        <div className="container max-w-6xl">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.5 }}>
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full bg-accent/10 text-accent mb-4">Ecosystem Features</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-white">Institutional Grade Capabilities</h2>
            <p className="text-white/35 max-w-xl mx-auto leading-relaxed">
              A comprehensive digital suite engineered for the modern Kenyan savings group.
            </p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: PiggyBank, title: 'Smart Collections', desc: 'Automated contributions via M-Pesa STK Push with real-time tracking of individual liquidity and arrears.' },
              { icon: HandCoins, title: 'Authorized Payouts', desc: 'Secure multi-sig approval workflow: Treasurer initiation requiring verification from all three group leaders.' },
              { icon: MessageSquare, title: 'Encrypted Messaging', desc: 'Secure in-app communication channels with instant notification protocols for critical group updates.' },
              { icon: FileText, title: 'Digital Governance', desc: 'Formalize group bylaws with digital signature tracking and automated version control for compliance.' },
              { icon: Users, title: 'Granular Roles', desc: 'Role-based access control for Chairperson, Secretary, and Treasurer to maintain operational integrity.' },
              { icon: UserPlus, title: 'Verified Onboarding', desc: 'Seamless member integration via phone number verification ensuring a secure and trusted group environment.' },
              { icon: Shield, title: 'Fiscal Oversight', desc: 'Comprehensive dashboards providing a 360-degree view of group performance and member contribution health.' },
              { icon: Zap, title: 'Automated Alerts', desc: 'Critical notifications for payment deadlines, withdrawal authorizations, and governance amendments.' },
            ].map((feature, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ delay: i * 0.08, duration: 0.5 }}
                className="group p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-accent/20 hover:bg-white/[0.05] transition-all duration-400"
              >
                <div className="w-12 h-12 mb-5 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <feature.icon className="text-accent" size={22} />
                </div>
                <h3 className="font-display font-bold text-base mb-2 text-white">{feature.title}</h3>
                <p className="text-white/35 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── OPERATIONAL STATS ───── */}
      <section className="py-16 px-4 bg-[hsl(213,72%,12%)] relative overflow-hidden noise-overlay">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(42_92%_56%_/_0.06),_transparent_60%)]" />
        <div className="container max-w-5xl relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {[
              { value: '1,200+', label: 'Registered Chamas', icon: Users },
              { value: 'KES 50M+', label: 'Capital Managed', icon: PiggyBank },
              { value: '5,000+', label: 'Active Users', icon: Award },
              { value: '24/7', label: 'Financial Access', icon: Clock },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white/[0.06] flex items-center justify-center">
                  <stat.icon size={22} className="text-accent" />
                </div>
                <p className="text-2xl md:text-3xl font-bold text-white font-display">{stat.value}</p>
                <p className="text-[11px] text-white/25 mt-1 uppercase tracking-[0.15em] font-semibold">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── ONBOARDING PROCESS ───── */}
      <section id="how-it-works" className="py-24 md:py-28 px-4 bg-[hsl(213,72%,8%)] relative">
        <div className="container max-w-5xl">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full bg-accent/10 text-accent mb-4">Onboarding Flow</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-white">Initialize Your Chama in 4 Steps</h2>
            <p className="text-white/35 max-w-lg mx-auto">From registration to your first automated collection in minutes.</p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-4 relative">
            <div className="hidden md:block absolute top-[38px] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-white/[0.04] via-accent/20 to-white/[0.04]" />
            {[
              { step: '01', icon: FileCheck, title: 'KYC Verification', desc: 'Secure registration utilizing phone and National ID verification protocols.' },
              { step: '02', icon: Users, title: 'Entity Creation', desc: 'Establish your Chama identity and configure governance frameworks.' },
              { step: '03', icon: UserPlus, title: 'Member Curation', desc: 'Invite participants and assign administrative leadership roles.' },
              { step: '04', icon: PiggyBank, title: 'Active Treasury', desc: 'Set contribution frequencies and execute via integrated M-Pesa STK.' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.5 }} className="relative text-center">
                <div className="w-[76px] h-[76px] mx-auto mb-6 rounded-2xl bg-accent flex items-center justify-center shadow-gold-lg relative z-10">
                  <item.icon className="text-accent-foreground" size={28} />
                </div>
                <span className="text-[11px] font-bold text-accent uppercase tracking-[0.2em] mb-2 block">Stage {item.step}</span>
                <h3 className="font-display font-bold text-lg mb-2 text-white">{item.title}</h3>
                <p className="text-white/35 text-sm leading-relaxed max-w-[220px] mx-auto">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CREDIT FACILITIES ───── */}
      <section id="loans" className="py-24 md:py-28 px-4 bg-[hsl(213,72%,10%)]">
        <div className="container max-w-5xl">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full bg-accent/10 text-accent mb-4">Credit Solutions</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-white">Strategic Business & Personal Loans</h2>
            <p className="text-white/35 max-w-xl mx-auto">Accelerate your growth with affordable capital designed for entrepreneurs and students.</p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'Biashara Loan', desc: 'Strategic capital for business expansion and inventory management.', rate: '10%', max: 'KES 500,000', icon: '🏪' },
              { name: 'Elimu Loan', desc: 'Flexible financing for academic advancement and tuition fees.', rate: '8%', max: 'KES 300,000', icon: '📚' },
              { name: 'Youth Fund', desc: 'Empowering young innovators with early-stage business capital.', rate: '8%', max: 'KES 200,000', icon: '🚀' },
            ].map((product, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-accent/20 hover:bg-white/[0.05] transition-all duration-400 overflow-hidden flex flex-col"
              >
                <div className="p-6 flex-1">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.06] flex items-center justify-center text-2xl">{product.icon}</div>
                    <span className="text-xs font-bold text-accent bg-accent/10 px-3 py-1.5 rounded-full">{product.rate} p.a.</span>
                  </div>
                  <h3 className="font-display font-bold text-lg mb-2 text-white">{product.name}</h3>
                  <p className="text-sm text-white/35 leading-relaxed">{product.desc}</p>
                </div>
                <div className="px-6 py-4 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-white/25 uppercase tracking-wider">Ceiling</p>
                    <p className="font-display font-bold text-white">{product.max}</p>
                  </div>
                  <Link to="/signup">
                    <Button variant="gold" size="sm" className="shadow-gold">Apply Now</Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── TESTIMONIALS ───── */}
      <section className="py-24 md:py-28 px-4 bg-[hsl(213,72%,8%)] relative">
        <div className="container max-w-6xl">
          <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full bg-accent/10 text-accent mb-4">Case Studies</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-white">Trusted by Strategic Groups</h2>
            <p className="text-white/35 max-w-lg mx-auto">High-impact testimonials from groups successfully scaling with DASNET VENTURES.</p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'Grace Wanjiru', role: 'Chairperson, Umoja Savings', text: 'Digitizing our manual ledger has eliminated discrepancies. Our collective trust and operational efficiency have reached unprecedented levels.', rating: 5 },
              { name: 'Peter Ochieng', role: 'Treasurer, Vijana Group', text: 'The multi-sig authorization protocol ensures total accountability. M-Pesa integration has streamlined our entire collection cycle.', rating: 5 },
              { name: 'Amina Hassan', role: 'Member, Baraka Chama', text: 'The automated governance notifications and digital signature tracking provide genuine peace of mind for every stakeholder involved.', rating: 5 },
            ].map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, si) => (
                    <Star key={si} size={15} className="text-accent fill-accent" />
                  ))}
                </div>
                <p className="text-sm text-white/45 leading-relaxed mb-6">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs font-bold">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">{t.name}</p>
                    <p className="text-xs text-white/30">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section id="faq" className="py-24 md:py-28 px-4 bg-[hsl(213,72%,10%)]">
        <div className="container max-w-3xl">
          <motion.div className="text-center mb-14" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full bg-accent/10 text-accent mb-4">Support</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-white">Common Inquiries</h2>
            <p className="text-white/35 max-w-lg mx-auto">Comprehensive answers to common technical and operational questions.</p>
          </motion.div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-accent/20 transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-[15px] text-white">{faq.q}</h3>
                    <ChevronDown size={18} className={`text-white/30 shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                  </div>
                  <motion.div initial={false} animate={{ height: openFaq === i ? 'auto' : 0, opacity: openFaq === i ? 1 : 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                    <p className="text-sm text-white/35 leading-relaxed mt-3 pr-8">{faq.a}</p>
                  </motion.div>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── PWA INSTALL ───── */}
      {!isInstalled && (
        <section className="py-16 px-4 bg-[hsl(213,72%,10%)] relative overflow-hidden">
          <div className="container max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="rounded-2xl p-8 md:p-10 text-center bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20"
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/20 flex items-center justify-center">
                <Smartphone size={24} className="text-accent" />
              </div>
              <h3 className="font-display text-2xl font-bold text-white mb-2">Enhance Your Experience</h3>
              <p className="text-white/40 max-w-md mx-auto mb-6 text-sm leading-relaxed">
                Install the platform for optimized mobile performance, push notifications, and high-speed offline capabilities.
              </p>
              {canInstall ? (
                <Button variant="hero" size="lg" onClick={promptInstall} className="shadow-gold-lg">
                  Install Application
                </Button>
              ) : (
                <p className="text-xs text-white/25">Select "Add to Home Screen" from your browser menu to install.</p>
              )}
            </motion.div>
          </div>
        </section>
      )}

      {/* ───── CTA ───── */}
      <section className="py-24 px-4 bg-[hsl(213,72%,8%)]">
        <div className="container max-w-4xl">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            className="rounded-3xl p-10 md:p-16 text-center relative overflow-hidden bg-gradient-to-br from-accent/20 via-accent/10 to-transparent border border-accent/20"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(42_92%_56%_/_0.1),_transparent_70%)]" />
            <div className="relative z-10">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-accent/20 flex items-center justify-center">
                <Users size={28} className="text-accent" />
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
                Scale Your Collaborative Savings
              </h2>
              <p className="text-white/40 max-w-lg mx-auto mb-8 leading-relaxed">
                Join an ecosystem of Kenyan groups managing capital with precision and digital transparency.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/signup">
                  <Button variant="hero" size="xl" className="min-w-[220px] shadow-gold-lg">
                    Initialize Free Account
                    <ArrowRight size={20} />
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button variant="outline" size="xl" className="border-white/10 text-white hover:bg-white/[0.06] min-w-[160px]">
                    Consultation
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="bg-[hsl(213,72%,6%)] text-white pt-16 pb-8 px-4 relative border-t border-white/[0.04]">
        <div className="container max-w-6xl relative z-10">
          <div className="grid gap-10 md:grid-cols-4 mb-12">
            <div className="md:col-span-1">
              <Logo variant="white" size="md" />
              <p className="text-sm text-white/25 mt-4 leading-relaxed">
                Providing specialized digital infrastructure for Kenyan financial groups and strategic credit access.
              </p>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/20 mb-4">Solutions</h4>
              <ul className="space-y-2.5">
                {['Chama Management', 'Savings Audit', 'Multi-Sig Approvals', 'Credit Facilities'].map(p => (
                  <li key={p} className="text-sm text-white/30 hover:text-white/60 transition-colors cursor-pointer">{p}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/20 mb-4">Legal</h4>
              <ul className="space-y-2.5">
                {['About Us', 'Terms of Service', 'Privacy Policy', 'Cookie Policy'].map(p => (
                  <li key={p} className="text-sm text-white/30 hover:text-white/60 transition-colors cursor-pointer">{p}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/20 mb-4">Support</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2.5 text-sm text-white/30"><Phone size={14} className="text-accent/60" /> +254 725 336 731</li>
                <li className="flex items-center gap-2.5 text-sm text-white/30"><Mail size={14} className="text-accent/60" /> support@dasnet.site</li>
                <li className="flex items-start gap-2.5 text-sm text-white/30"><MapPin size={14} className="text-accent/60 mt-0.5" /> Nairobi, Kenya</li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-white/15">© {new Date().getFullYear()} DASNET VENTURES LTD. All rights reserved.</p>
            <p className="text-[11px] text-white/10 uppercase tracking-widest">Fintech &bull; Chama Management &bull; M-Pesa Integration</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
 
