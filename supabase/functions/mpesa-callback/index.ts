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

      // --- PURPOSE LOGIC: HARAMBEE (STRICT FIX) ---
      if (purpose === "harambee") {
        // We use the harambee_id that was saved during the STK initiation
        const targetHarambeeId = txn.harambee_id;
        
        if (targetHarambeeId) {
          // 1. Record the individual contribution
          await supabase.from("chama_harambee_contributions").insert({
            harambee_id: targetHarambeeId,
            user_id: txn.user_id,
            amount: txn.amount,
            stk_reference: txn.reference,
            contributor_name: "Member" // Optional: You can fetch user name here if needed
          });
          
          // 2. Fetch current amount
          const { data: harambee } = await supabase
            .from("chama_harambees")
            .select("raised_amount")
            .eq("id", targetHarambeeId)
            .single();
            
          // 3. Update the total raised amount in the Harambee table
          if (harambee) {
            await supabase
              .from("chama_harambees")
              .update({ raised_amount: (harambee.raised_amount || 0) + txn.amount })
              .eq("id", targetHarambeeId);
          }
        } else {
          console.error("Harambee contribution failed: No harambee_id found in transaction record.");
        }
      }

      // --- PURPOSE LOGIC: LOAN REPAYMENT ---
      if (purpose === "loan_repayment") {
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

          if (newStatus === "paid") {
            await supabase.from("loan_applications").update({ status: "paid" }).eq("id", disbData.loan_id);
          }
        }
      }

      // --- PURPOSE LOGIC: WALLET / ACTIVATION ---
      if (["activation", "wallet_deposit", "chama_joining_fee"].includes(purpose)) {
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

      // Notification
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
        message: `Transaction failed: ${ResultDesc}`,
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
 
