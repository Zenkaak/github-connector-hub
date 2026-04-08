import React, { useState } from 'react';
import { useConnectivity } from '@/contexts/ConnectivityProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const ContributionForm = ({ harambeeId, userId }: { harambeeId: string; userId: string }) => {
  const { online: isOnline } = useConnectivity();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState(""); // Added state for phone
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOnline) return;
    if (!harambeeId) {
      toast({ title: "Error", description: "Missing Harambee ID", variant: "destructive" });
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 1) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);

      // Ensure we pass 'public-user' if userId is not present to trigger our backend logic
      const submitUserId = userId || 'public-user';

      const { data, error } = await supabase.functions.invoke("initiate-stk-push", {
        body: {
          phone: phone.trim(),
          amount: numAmount,
          userId: submitUserId,
          purpose: "harambee",
          harambee_id: harambeeId, // Matches Edge Function destructuring
        },
      });

      if (error) throw error;

      toast({ 
        title: "Request Sent", 
        description: "Check your phone for the M-Pesa prompt." 
      });

    } catch (err: any) {
      console.error("STK Error:", err);
      toast({ 
        title: "Payment Failed", 
        description: err.message || "Could not initiate payment", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card p-6 rounded-2xl shadow-md max-w-md mx-auto my-5 border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Chama Contribution</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Phone Input */}
        <div>
          <label className="block text-sm font-semibold text-muted-foreground mb-1">
            M-Pesa Phone Number
          </label>
          <input
            type="tel"
            placeholder="0712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-3 bg-background border border-input rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
            required
            disabled={loading}
          />
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-semibold text-muted-foreground mb-1">
            Amount (KES)
          </label>
          <input
            type="number"
            placeholder="e.g. 1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-3 bg-background border border-input rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
            required
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={!isOnline || loading}
          className={`w-full py-3.5 rounded-xl text-base font-bold transition-all flex items-center justify-center gap-2 ${
            isOnline && !loading
              ? 'bg-primary text-primary-foreground hover:opacity-90 cursor-pointer'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          {loading ? (
            <><Loader2 className="animate-spin" size={18} /> Processing...</>
          ) : isOnline ? (
            'Pay via M-Pesa'
          ) : (
            'Offline: Check Connection'
          )}
        </button>

        {!isOnline && (
          <div className="p-3 bg-destructive/10 border-l-4 border-destructive text-destructive text-sm rounded-r-lg">
            <p className="m-0 font-medium">
              ⚠️ <b>M-Pesa pushes</b> require an active connection.
            </p>
          </div>
        )}
      </form>
    </div>
  );
};

export default ContributionForm;
