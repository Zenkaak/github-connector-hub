import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowLeft, Search, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export default function PublicHarambeesListPage() {
  const [harambees, setHarambees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    document.title = 'Active Harambees — DASNET';
    (async () => {
      const { data } = await supabase
        .from('chama_harambees')
        .select('*')
        .eq('is_public', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      setHarambees(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = harambees.filter((h) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (h.title || '').toLowerCase().includes(q) ||
      (h.beneficiary_name || '').toLowerCase().includes(q) ||
      (h.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[hsl(213,72%,8%)] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[hsl(213,72%,8%)]/80 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-[13px]">
            <ArrowLeft size={16} /> Back home
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-accent-foreground">
              <ShieldCheck size={15} />
            </div>
            <span className="font-display font-bold text-white text-[15px]">DASNET</span>
            <span className="text-accent/80 text-[9px] font-semibold tracking-[0.2em] uppercase">Ventures</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 sm:px-6 pt-10 pb-6 max-w-6xl mx-auto">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] px-2.5 py-1 rounded-full bg-white/[0.04] text-white/60 mb-4 border border-white/[0.06]">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> Live appeals
        </span>
        <h1 className="font-display text-[1.85rem] sm:text-[2.5rem] font-semibold tracking-[-0.02em] mb-2">
          Active Harambees
        </h1>
        <p className="text-white/55 text-[14px] max-w-xl mb-6">
          Verified fundraisers from real Kenyans. Contribute directly via M-Pesa — no account needed.
        </p>
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search appeals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white/[0.04] border-white/[0.08] text-white text-[13px] placeholder:text-white/35"
          />
        </div>
      </section>

      {/* Grid */}
      <section className="px-4 sm:px-6 pb-16 max-w-6xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white/[0.02] border border-white/[0.06] h-56 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-10 text-center">
            <Heart size={28} className="text-white/30 mx-auto mb-3" />
            <p className="text-white/60 text-[14px] font-medium">
              {search ? 'No appeals match your search' : 'No active public harambees right now'}
            </p>
            <p className="text-white/35 text-[12px] mt-1">
              {search ? 'Try a different keyword.' : 'Check back soon — new fundraisers are listed as they get verified.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((h, i) => {
              const progress = h.target_amount > 0 ? Math.min(100, Math.round((Number(h.raised_amount || 0) / Number(h.target_amount)) * 100)) : 0;
              const daysLeft = h.deadline ? Math.max(0, Math.ceil((new Date(h.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
              const publicHref = h.order_number ? `/harambee/${h.order_number}` : '#';
              return (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.4 }}
                  className="rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all overflow-hidden flex flex-col"
                >
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
                      <h3 className="font-display font-semibold text-[15px] text-white leading-snug tracking-[-0.01em] line-clamp-2">
                        {h.title || `Harambee for ${h.beneficiary_name}`}
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
                        <span className="text-white/85 font-medium">KES {Number(h.raised_amount || 0).toLocaleString()}</span>
                        <span className="text-white/40">of {Number(h.target_amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-3 bg-white/[0.015] border-t border-white/[0.04] flex gap-2">
                    <Link to={publicHref} className="flex-1">
                      <Button variant="gold" size="sm" className="w-full text-[12px] h-8 !shadow-none font-semibold">
                        Contribute
                      </Button>
                    </Link>
                    <Link to={publicHref} className="flex-1">
                      <Button variant="ghost" size="sm" className="w-full text-[12px] h-8 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] border border-white/[0.05]">
                        View
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
