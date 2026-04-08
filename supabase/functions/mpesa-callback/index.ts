import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * M-PESA CALLBACK EDGE FUNCTION
 * Full Version: Handles all utility types (Savings, Loans, Harambee, Wallet, Penalties)
 */

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    console.log("M-Pesa callback received:", JSON.stringify(body));

    const callback = body?.Body?.stkCallback;
    if (!callback) return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });

    const { CheckoutRequestID, ResultCode, ResultDesc } = callback;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch the pending transaction
    const { data: txn, error: findError } = await supabase
      .from("stk_transactions")
      .select("*, profiles(full_name)")
      .eq("checkout_request_id", CheckoutRequestID)
      .maybeSingle();

    if (findError || !txn) {
      console.error("Transaction not found for ID:", CheckoutRequestID);
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // 2. Stop if already processed
    if (txn.status === "success") return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });

    if (ResultCode === 0) {
      const metadataItems = callback?.CallbackMetadata?.Item || [];
      const mpesaReceipt = String(metadataItems.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value || "");
      const actualAmount = metadataItems.find((i: any) => i.Name === "Amount")?.Value || txn.amount;

      // --- CRITICAL: UPDATE THE TRANSACTION STATUS TO SUCCESS IMMEDIATELY ---
      const { error: updateTxError } = await supabase
        .from("stk_transactions")
        .update({
          status: "success",
          result_code: String(ResultCode),
          result_desc: "The service was accepted successfully",
          mpesa_receipt: mpesaReceipt,
          updated_at: new Date().toISOString(),
        })
        .eq("checkout_request_id", CheckoutRequestID);

      if (updateTxError) console.error("Database Update Failed:", updateTxError.message);

      const purpose = txn.purpose;
      const userName = txn.profiles?.full_name || "Member";
      let notificationMsg = `Dear ${userName}, payment of KES ${actualAmount.toLocaleString()} received. Receipt: ${mpesaReceipt}.`;

      // --- CHAMA SAVINGS & ARREARS LOGIC ---
      if (purpose === "chama_savings" && txn.group_id) {
        const metadata = txn.metadata || {};
        if (metadata.isArrears || metadata.type === 'arrears_clearance') {
          const missedCount = metadata.missed_count || 1;
          const individualAmount = actualAmount / missedCount;
          const arrearsEntries = [];
          for (let i = 0; i < missedCount; i++) {
            const entryDate = new Date();
            entryDate.setMonth(entryDate.getMonth() - i);
            arrearsEntries.push({
              group_id: txn.group_id,
              user_id: txn.user_id,
              amount: individualAmount,
              stk_reference: mpesaReceipt,
              month: entryDate.toISOString().slice(0, 7),
              description: `Arrears Clearance (${i + 1}/${missedCount})`
            });
          }
          await supabase.from("chama_savings").insert(arrearsEntries);
        } else {
          await supabase.from("chama_savings").insert({
            group_id: txn.group_id,
            user_id: txn.user_id,
            amount: actualAmount,
            stk_reference: mpesaReceipt,
            month: new Date().toISOString().slice(0, 7),
            description: "Regular Savings"
          });
        }
      }

      // --- CHAMA PENALTY LOGIC ---
      if (purpose === "chama_penalty") {
        const penaltyId = txn.penalty_id || txn.metadata?.penaltyId;
        if (penaltyId) {
          await supabase.from("chama_penalties").update({ is_paid: true }).eq("id", penaltyId);
        } else {
          await supabase.rpc('mark_oldest_penalty_paid', { p_user_id: txn.user_id, p_group_id: txn.group_id });
        }
      }

      // --- HARAMBEE LOGIC ---
      if (purpose === "harambee" && txn.harambee_id) {
        const { data: h } = await supabase.from("chama_harambees").select("raised_amount").eq("id", txn.harambee_id).maybeSingle();
        if (h) {
          await supabase.from("chama_harambees").update({ raised_amount: (h.raised_amount || 0) + actualAmount }).eq("id", txn.harambee_id);
          await supabase.from("chama_harambee_contributions").insert({ 
            harambee_id: txn.harambee_id, user_id: txn.user_id, amount: actualAmount, stk_reference: mpesaReceipt 
          });
        }
      }

      // --- LOAN REPAYMENT LOGIC ---
      if (purpose === "loan_repayment") {
        const { data: d } = await supabase.from("loan_disbursements")
          .select("*").eq("user_id", txn.user_id).eq("status", "active")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (d) {
          const newBal = Math.max(0, (d.outstanding_balance || 0) - actualAmount);
          const newStatus = newBal <= 0 ? "paid" : "active";
          await supabase.from("loan_disbursements").update({ outstanding_balance: newBal, status: newStatus }).eq("id", d.id);
          if (newStatus === "paid") await supabase.from("loan_applications").update({ status: "paid" }).eq("id", d.loan_id);
          await supabase.from("loan_repayments").insert({
            disbursement_id: d.id, user_id: txn.user_id, amount: actualAmount, mpesa_reference: mpesaReceipt, status: 'completed'
          });
        }
      }

      // --- WALLET / ACTIVATION LOGIC ---
      if (["activation", "wallet_deposit"].includes(purpose)) {
        const { data: w } = await supabase.from("wallets").select("id, balance").eq("user_id", txn.user_id).maybeSingle();
        if (w) {
          await supabase.from("wallets").update({ balance: (w.balance || 0) + actualAmount }).eq("id", w.id);
          await supabase.from("wallet_transactions").insert({
            wallet_id: w.id, user_id: txn.user_id, type: "deposit", amount: actualAmount, 
            description: `M-Pesa Deposit: ${mpesaReceipt}`, reference_id: mpesaReceipt, status: "completed"
          });
        }
      }

      // --- PERSONAL SAVINGS LOGIC ---
      if (purpose === "personal_savings" && txn.savings_id) {
        const { data: ps } = await supabase.from("personal_savings").select("saved_amount").eq("id", txn.savings_id).maybeSingle();
        if (ps) {
          await supabase.from("personal_savings").update({ saved_amount: (ps.saved_amount || 0) + actualAmount }).eq("id", txn.savings_id);
          await supabase.from("personal_savings_deposits").insert({
            savings_id: txn.savings_id, user_id: txn.user_id, amount: actualAmount, stk_reference: mpesaReceipt
          });
        }
      }

      // --- CHAMA JOINING LOGIC ---
      if (purpose === "chama_joining_fee" || purpose === "chama_join") {
        if (txn.group_id) {
          await supabase.from("chama_joining_fees").insert({ group_id: txn.group_id, user_id: txn.user_id, amount: actualAmount, reference: mpesaReceipt });
          await supabase.from("chama_members").insert({ group_id: txn.group_id, user_id: txn.user_id, role: "member" });
          await supabase.from("chama_join_requests").update({ status: "completed" }).eq("group_id", txn.group_id).eq("user_id", txn.user_id);
        }
      }

      // --- SEND NOTIFICATION ---
      await supabase.from("notifications").insert({
        user_id: txn.user_id,
        title: "Payment Confirmed ✅",
        message: notificationMsg,
        type: "payment",
        metadata: { receipt: mpesaReceipt, amount: actualAmount, purpose }
      });

    } else {
      // HANDLE FAILURE (Update status so it's not pending forever)
      await supabase.from("stk_transactions")
        .update({ 
          status: "failed", 
          result_code: String(ResultCode), 
          result_desc: ResultDesc, 
          updated_at: new Date().toISOString() 
        })
        .eq("checkout_request_id", CheckoutRequestID);
    }

    return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });

  } catch (error) {
    console.error("CRITICAL ERROR:", error);
    return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});
 
