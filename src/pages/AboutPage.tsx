import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Users, Target, Heart, Star, Award } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-border/40">
        <div className="container flex items-center justify-between h-16 px-4 md:px-6">
          <Link to="/"><Logo size="md" /></Link>
          <Link to="/">
            <Button variant="ghost" size="sm"><ArrowLeft size={14} /> Back Home</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-gradient pt-28 pb-20 px-4 relative overflow-hidden noise-overlay">
        <div className="absolute inset-0 grid-pattern opacity-[0.02]" />
        <div className="container max-w-4xl text-center relative z-10">
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="section-label mb-4 inline-block text-white bg-white/10">About Us</motion.span>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="font-display text-3xl md:text-5xl font-bold text-white mb-4">
            Empowering Kenya&apos;s
            <br />
            <span className="bg-gradient-to-r from-accent to-gold-300 bg-clip-text text-transparent">Financial Future</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-white/50 max-w-xl mx-auto leading-relaxed">
            Founded in 2020, Nyota Foundation is on a mission to make financial services accessible, fair, and transparent for every Kenyan.
          </motion.p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 px-4">
        <div className="container max-w-5xl">
          <div className="grid gap-6 md:grid-cols-2">
            {[
              { icon: Target, title: 'Our Mission', desc: 'To provide accessible, transparent, and affordable financial solutions that empower Kenyans to achieve their personal and professional goals.' },
              { icon: Star, title: 'Our Vision', desc: 'To become Kenya\'s most trusted digital lending platform, known for integrity, innovation, and genuine impact on people\'s lives.' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="premium-card p-8">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
                  <item.icon className="text-accent" size={24} />
                </div>
                <h3 className="font-display font-bold text-xl mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container max-w-5xl">
          <div className="text-center mb-14">
            <span className="section-label mb-4 inline-block">Our Values</span>
            <h2 className="font-display text-3xl font-bold">What We Stand For</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Shield, title: 'Integrity', desc: 'We operate with complete transparency in every transaction.' },
              { icon: Heart, title: 'Empathy', desc: 'We understand the challenges our customers face daily.' },
              { icon: Award, title: 'Excellence', desc: 'We strive for the highest standards in everything we do.' },
              { icon: Users, title: 'Community', desc: 'We believe in building lasting relationships with our members.' },
            ].map((v, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="premium-card p-6 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
                  <v.icon className="text-primary" size={22} />
                </div>
                <h3 className="font-display font-bold mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container max-w-3xl text-center">
          <h2 className="font-display text-2xl font-bold mb-4">Join Us Today</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">Start your financial journey with Nyota Foundation and experience the difference.</p>
          <Link to="/signup"><Button variant="gold" size="lg" className="shadow-gold">Get Started</Button></Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50 text-center">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Nyota Foundation. All rights reserved.</p>
      </footer>
    </div>
  );
}
