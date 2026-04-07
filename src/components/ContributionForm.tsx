import React, { useState } from 'react';
import { useConnectivity } from '@/contexts/ConnectivityProvider';
import { supabase } from '@/integrations/supabase/client';

const ContributionForm = ({ harambeeId, userId }: { harambeeId: string; userId: string }) => {
  const { online: isOnline } = useConnectivity();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOnline) return;
    if (!harambeeId) {
      console.error("Missing harambeeId");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke("initiate-stk-push", {
        body: {
          phone: "", // 👉 you should collect this from user
          amount: Number(amount),
          userId,
          purpose: "harambee",
          harambee_id: harambeeId, // ✅ THIS FIXES YOUR ISSUE
        },
      });

      if (error) {
        console.error("STK Error:", error);
      } else {
        console.log("STK initiated:", data);
      }
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card p-6 rounded-2xl shadow-md max-w-md mx-auto my-5">
      <h3 className="text-lg font-semibold mb-4">Chama Contribution</h3>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-muted-foreground mb-1">
            Amount (KES)
          </label>
          <input
            type="number"
            placeholder="e.g. 1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="fintech-input"
            required
          />
        </div>

        <button
          type="submit"
          disabled={!isOnline || loading}
          className={`w-full py-3.5 rounded-xl text-base font-bold transition-all ${
            isOnline
              ? 'bg-primary text-primary-foreground cursor-pointer'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          {loading ? 'Processing...' : isOnline ? 'Pay via M-Pesa' : 'Offline: Check Connection'}
        </button>

        {!isOnline && (
          <div className="mt-4 p-3 bg-destructive/10 border-l-4 border-destructive text-destructive text-sm leading-relaxed">
            <p className="m-0">
              ⚠️ <b>M-Pesa pushes</b> require an active connection.
            </p>
          </div>
        )}
      </form>
    </div>
  );
};

export default ContributionForm;
