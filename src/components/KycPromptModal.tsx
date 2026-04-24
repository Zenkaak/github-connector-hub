import { useEffect, useState, useRef } from 'react';
import { Upload, ShieldCheck, Camera, CreditCard, X, CheckCircle2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DOC_TYPES = [
  { key: 'id_front', label: 'ID Front', icon: CreditCard },
  { key: 'id_back', label: 'ID Back', icon: CreditCard },
  { key: 'selfie', label: 'Selfie', icon: Camera },
] as const;

const DISMISS_KEY = 'dasnet_kyc_prompt_dismissed_until';

export function KycPromptModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [existing, setExisting] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!user) return;
    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() < dismissedUntil) return;

    (async () => {
      const { data } = await supabase
        .from('kyc_documents' as any)
        .select('document_type')
        .eq('user_id', user.id);
      const have: Record<string, boolean> = {};
      (data || []).forEach((d: any) => { have[d.document_type] = true; });
      setExisting(have);
      const missing = DOC_TYPES.some(t => !have[t.key]);
      if (missing) setOpen(true);
    })();
  }, [user]);

  const handleFile = async (key: string, file: File) => {
    if (!user || !file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Max file size is 5 MB');
      return;
    }
    setUploading(key);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${key}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('kyc-documents')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from('kyc_documents' as any)
        .upsert({ user_id: user.id, document_type: key, file_path: path, status: 'pending' }, { onConflict: 'user_id,document_type' });
      if (dbErr) throw dbErr;

      setExisting(p => ({ ...p, [key]: true }));
      toast.success(`${DOC_TYPES.find(t => t.key === key)?.label} uploaded`);
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const dismiss = (days: number) => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000));
    setOpen(false);
  };

  const allDone = DOC_TYPES.every(t => existing[t.key]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(1); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck size={18} className="text-primary" />
            Verify your identity
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Upload your ID (both sides) and a selfie to unlock larger limits and full account features.
            You can do this later from settings.
          </p>

          {DOC_TYPES.map(({ key, label, icon: Icon }) => {
            const done = existing[key];
            return (
              <div key={key} className={cn(
                'flex items-center justify-between p-3 rounded-xl border',
                done ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-muted/20 border-border/40'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    done ? 'bg-emerald-500/15 text-emerald-600' : 'bg-primary/10 text-primary'
                  )}>
                    {done ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{done ? 'Uploaded — under review' : 'JPG / PNG · max 5 MB'}</p>
                  </div>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  capture={key === 'selfie' ? 'user' : undefined}
                  ref={(el) => { inputRefs.current[key] = el; }}
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(key, e.target.files[0])}
                />
                <Button
                  size="sm"
                  variant={done ? 'outline' : 'default'}
                  disabled={uploading === key}
                  onClick={() => inputRefs.current[key]?.click()}
                >
                  {uploading === key ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : done ? 'Replace' : (
                    <>
                      <Upload size={14} className="mr-1" /> Upload
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" size="sm" className="flex-1" onClick={() => dismiss(7)}>
            Remind me later
          </Button>
          <Button size="sm" className="flex-1" onClick={() => setOpen(false)} disabled={!allDone}>
            {allDone ? 'Done' : 'Skip for now'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
