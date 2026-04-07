import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  // Only allow POST requests from Safaricom
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    console.log("M-Pesa callback received:", JSON.stringify(body));

    const callback = body?.Body?.stkCallback;
    if (!callback) {
      console.error("Invalid callback body");
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc } = callback;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Find the pending transaction in our database
    const { data: txn, error: findError } = await supabase
      .from("stk_transactions")
      .select("*")
      .eq("checkout_request_id", CheckoutRequestID)
      .single();

    if (findError || !txn) {
      console.error("Transaction not found for CheckoutRequestID:", CheckoutRequestID);
      // We return 200/Accepted to Safaricom to stop retries, even if we can't find it locally
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (ResultCode === 0) {
      // SUCCESS CASE
      let mpesaReceipt = "";
      const metadata = callback.CallbackMetadata?.Item || [];
      for (const item of metadata) {
        if (item.Name === "MpesaReceiptNumber") {
          mpesaReceipt = item.Value;
        }
      }

      // Update the main transaction record
      await supabase
        .from("stk_transactions")
        .update({
          status: "success",
          result_code: String(ResultCode),
          result_desc: ResultDesc,
          mpesa_receipt: mpesaReceipt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", txn.id);

      const purpose = txn.purpose || "activation";
      console.log(`Processing successful payment. Purpose: ${purpose}, Amount: ${txn.amount}`);

      // --- PURPOSE LOGIC: CHAMA SAVINGS ---
      if (purpose === "chama_savings" && txn.group_id) {
        await supabase.from("chama_savings").insert({
          group_id: txn.group_id,
          user_id: txn.user_id,
          amount: txn.amount,
          stk_reference: txn.reference,
        });
      }

      // --- PURPOSE LOGIC: PERSONAL SAVINGS ---
      if (purpose === "personal_savings" && txn.savings_id) {
        await supabase.from("personal_savings_deposits").insert({
          savings_id: txn.savings_id,
          user_id: txn.user_id,
          amount: txn.amount,
          stk_reference: txn.reference,
        });
        
        const { data: savings } = await supabase
          .from("personal_savings")
          .select("saved_amount")
          .eq("id", txn.savings_id)
          .single();
          
        if (savings) {
          await supabase
            .from("personal_savings")
            .update({ saved_amount: (savings.saved_amount || 0) + txn.amount })
            .eq("id", txn.savings_id);
        }
      }

      // --- PURPOSE LOGIC: HARAMBEE (FIXED) ---
      if (purpose === "harambee") {
        const targetHarambeeId = txn.harambee_id || txn.group_id;
        
        if (targetHarambeeId) {
          await supabase.from("chama_harambee_contributions").insert({
            harambee_id: targetHarambeeId,
            user_id: txn.user_id,
            amount: txn.amount,
            stk_reference: txn.reference,
          });
          
          const { data: harambee } = await supabase
            .from("chama_harambees")
            .select("raised_amount")
            .eq("id", targetHarambeeId)
            .single();
            
          if (harambee) {
            await supabase
              .from("chama_harambees")
              .update({ raised_amount: (harambee.raised_amount || 0) + txn.amount })
              .eq("id", targetHarambeeId);
          }
        }
      }

      // --- PURPOSE LOGIC: LOAN REPAYMENT ---
      if (purpose === "loan_repayment") {
        // Use disbursement_id if available, otherwise find the active one
        const targetDisbId = txn.disbursement_id;
        
        let disbData = null;
        if (targetDisbId) {
          const { data } = await supabase.from("loan_disbursements").select("*").eq("id", targetDisbId).single();
          disbData = data;
        } else {
          const { data } = await supabase
            .from("loan_disbursements")
            .select("*")
            .eq("user_id", txn.user_id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1);
          if (data && data.length > 0) disbData = data[0];
        }

        if (disbData) {
          const newBalance = Math.max(0, (disbData.outstanding_balance || 0) - txn.amount);
          const newStatus = newBalance <= 0 ? "paid" : "active";

          await supabase
            .from("loan_disbursements")
            .update({ outstanding_balance: newBalance, status: newStatus })
            .eq("id", disbData.id);

          await supabase.from("wallet_transactions").insert({
            user_id: txn.user_id,
            type: "debit",
            amount: txn.amount,
            description: `Loan repayment: ${mpesaReceipt}`,
            reference_id: txn.reference,
          });

          if (newStatus === "paid") {
            await supabase.from("loan_applications").update({ status: "paid" }).eq("id", disbData.loan_id);
          }
        }
      }

      // --- PURPOSE LOGIC: WALLET / ACTIVATION ---
      if (purpose === "activation" || purpose === "wallet_deposit" || purpose === "chama_joining_fee") {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", txn.user_id)
          .single();
          
        if (wallet) {
          await supabase
            .from("wallets")
            .update({ balance: (wallet.balance || 0) + txn.amount })
            .eq("user_id", txn.user_id);
        }
        
        await supabase.from("wallet_transactions").insert({
          user_id: txn.user_id,
          type: "deposit",
          amount: txn.amount,
          description: `M-Pesa Deposit: ${mpesaReceipt}`,
          reference_id: txn.reference,
        });
      }

      // Global Notification for Success
      await supabase.from("notifications").insert({
        user_id: txn.user_id,
        title: "Payment Confirmed ✅",
        message: `Your payment of KES ${txn.amount} was successful. Receipt: ${mpesaReceipt}`,
        type: "payment",
      });

    } else {
      // FAILURE CASE
      await supabase
        .from("stk_transactions")
        .update({
          status: "failed",
          result_code: String(ResultCode),
          result_desc: ResultDesc,
          updated_at: new Date().toISOString(),
        })
        .eq("id", txn.id);

      await supabase.from("notifications").insert({
        user_id: txn.user_id,
        title: "Payment Failed ❌",
        message: `Transaction for KES ${txn.amount} failed: ${ResultDesc}`,
        type: "payment",
      });
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Callback processing error:", error);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
});
 
