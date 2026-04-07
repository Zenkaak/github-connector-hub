import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Phone, Mail, MapPin, Clock, Send, MessageSquare } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { toast } from 'sonner';

export default function ContactPage() {
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast.success('Message sent! We will get back to you shortly.');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-border/40">
        <div className="container flex items-center justify-between h-16 px-4 md:px-6">
          <Link to="/"><Logo size="md" /></Link>
          <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft size={14} /> Back Home</Button></Link>
        </div>
      </header>

      <div className="pt-28 pb-20 px-4">
        <div className="container max-w-5xl">
          <div className="text-center mb-14">
            <span className="section-label mb-4 inline-block">Get in Touch</span>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">Contact Us</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Have a question or need help? Our team is ready to assist you.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-5">
            {/* Contact Info */}
            <div className="lg:col-span-2 space-y-5">
              {[
                { icon: Phone, label: 'Phone', value: '+254 725 336 731', sub: 'Mon-Fri 8am-6pm EAT' },
                { icon: Mail, label: 'Email', value: 'support@dasnet.site', sub: 'We reply within 2 hours' },
                { icon: MapPin, label: 'Office', value: 'Nairobi, Kenya', sub: 'CBD, Kenyatta Avenue' },
                { icon: Clock, label: 'Working Hours', value: 'Mon - Fri: 8AM - 6PM', sub: 'Sat: 9AM - 1PM' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <item.icon size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">{item.label}</p>
                    <p className="font-semibold text-sm mt-0.5">{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-3"
            >
              <div className="premium-card p-6 md:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <MessageSquare size={20} className="text-accent" />
                  <h2 className="font-display font-bold text-lg">Send a Message</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</Label>
                      <Input placeholder="John Doe" className="mt-2 h-12 rounded-xl" required />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
                      <Input type="email" placeholder="john@example.com" className="mt-2 h-12 rounded-xl" required />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject</Label>
                    <Input placeholder="How can we help?" className="mt-2 h-12 rounded-xl" required />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Message</Label>
                    <Textarea placeholder="Tell us more..." className="mt-2 min-h-[120px] rounded-xl resize-none" required />
                  </div>
                  <Button type="submit" variant="gold" className="w-full h-12 text-base shadow-gold" disabled={sending}>
                    {sending ? 'Sending...' : (<>Send Message <Send size={16} /></>)}
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <footer className="py-8 border-t border-border/50 text-center">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Nyota Foundation. All rights reserved.</p>
      </footer>
    </div>
  );
}
