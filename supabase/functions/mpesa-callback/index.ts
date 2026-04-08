import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // -------------------------
    // ✅ SAFE BODY PARSING
    // -------------------------
    let body: any;
    try {
      body = await req.json();
    } catch {
      console.error("Invalid JSON body");
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    console.log("M-Pesa callback received:", JSON.stringify(body));

    const callback = body?.Body?.stkCallback;
    if (!callback) {
      console.error("Invalid callback structure");
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc } = callback;

    if (!CheckoutRequestID) {
      console.error("Missing CheckoutRequestID");
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // -------------------------
    // ✅ ENV VALIDATION
    // -------------------------
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // -------------------------
    // ✅ FETCH TRANSACTION
    // -------------------------
    const { data: txn, error: findError } = await supabase
      .from("stk_transactions")
      .select("*")
      .eq("checkout_request_id", CheckoutRequestID)
      .maybeSingle();

    if (findError || !txn) {
      console.error("Transaction not found:", CheckoutRequestID);
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // -------------------------
    // ✅ IDEMPOTENCY GUARD
    // -------------------------
    if (txn.status === "success" || txn.status === "failed") {
      console.log("Transaction already processed:", txn.id);
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // -------------------------
    // SUCCESS FLOW
    // -------------------------
    if (ResultCode === 0) {
      const metadataItems = callback?.CallbackMetadata?.Item || [];

      const mpesaReceipt =
        metadataItems.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value ||
        null;

      const amount =
        metadataItems.find((i: any) => i.Name === "Amount")?.Value ||
        txn.amount;

      // Update transaction first
      await supabase.from("stk_transactions").update({
        status: "success",
        result_code: String(ResultCode),
        result_desc: ResultDesc,
        mpesa_receipt: mpesaReceipt,
        updated_at: new Date().toISOString(),
      }).eq("id", txn.id);

      const purpose = txn.purpose;

      // -------------------------
      // CHAMA PENALTY
      // -------------------------
      if (purpose === "chama_penalty") {
        const penaltyId = txn.penalty_id || txn.metadata?.penaltyId;
        if (penaltyId) {
          await supabase
            .from("chama_penalties")
            .update({ is_paid: true })
            .eq("id", penaltyId);
        } else {
          // Fallback: mark the oldest unpaid penalty for this user/group as paid
          await supabase.rpc('mark_oldest_penalty_paid', { 
            p_user_id: txn.user_id, 
            p_group_id: txn.group_id 
          });
        }
      }

      // -------------------------
      // HARAMBEE
      // -------------------------
      if (purpose === "harambee" && txn.harambee_id) {
        const harambeeId = txn.harambee_id;

        const { data: harambee } = await supabase
          .from("chama_harambees")
          .select("raised_amount")
          .eq("id", harambeeId)
          .maybeSingle();

        if (harambee) {
          await supabase
            .from("chama_harambees")
            .update({
              raised_amount: (harambee.raised_amount || 0) + txn.amount,
            })
            .eq("id", harambeeId);

          await supabase.from("chama_harambee_contributions").insert({
            harambee_id: harambeeId,
            user_id: txn.user_id,
            amount: txn.amount,
            stk_reference: txn.reference,
          });
        } else {
          console.error("Harambee not found:", harambeeId);
        }
      }

      // -------------------------
      // PERSONAL SAVINGS
      // -------------------------
      if (purpose === "personal_savings" && txn.savings_id) {
        const { data: savings } = await supabase
          .from("personal_savings")
          .select("saved_amount")
          .eq("id", txn.savings_id)
          .maybeSingle();

        if (savings) {
          const newBalance = (savings.saved_amount || 0) + txn.amount;

          await supabase
            .from("personal_savings")
            .update({ saved_amount: newBalance })
            .eq("id", txn.savings_id);

          await supabase.from("personal_savings_deposits").insert({
            savings_id: txn.savings_id,
            user_id: txn.user_id,
            amount: txn.amount,
            stk_reference: txn.reference,
          });
        }
      }

      // -------------------------
      // LOAN REPAYMENT
      // -------------------------
      if (purpose === "loan_repayment") {
        const disbursementId = txn.disbursement_id;

        let disb = null;

        if (disbursementId) {
          const { data } = await supabase
            .from("loan_disbursements")
            .select("*")
            .eq("id", disbursementId)
            .maybeSingle();
          disb = data;
        } else {
          const { data } = await supabase
            .from("loan_disbursements")
            .select("*")
            .eq("user_id", txn.user_id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1);

          disb = data?.[0];
        }

        if (disb) {
          const newBalance = Math.max(
            0,
            (disb.outstanding_balance || 0) - txn.amount
          );

          const newStatus = newBalance <= 0 ? "paid" : "active";

          await supabase
            .from("loan_disbursements")
            .update({
              outstanding_balance: newBalance,
              status: newStatus,
            })
            .eq("id", disb.id);

          if (newStatus === "paid") {
            await supabase
              .from("loan_applications")
              .update({ status: "paid" })
              .eq("id", disb.loan_id);
          }
        }
      }

      // -------------------------
      // WALLET / DEPOSITS
      // -------------------------
      if (
        ["activation", "wallet_deposit"].includes(purpose)
      ) {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", txn.user_id)
          .maybeSingle();

        if (wallet) {
          const newBalance = (wallet.balance || 0) + txn.amount;

          await supabase
            .from("wallets")
            .update({ balance: newBalance })
            .eq("user_id", txn.user_id);
        }

        await supabase.from("wallet_transactions").insert({
          user_id: txn.user_id,
          type: "deposit",
          amount: txn.amount,
          description: `M-Pesa Deposit: ${mpesaReceipt || ""}`,
          reference_id: txn.reference,
        });
      }

      // -------------------------
      // CHAMA JOINING FEE
      // -------------------------
      if (purpose === "chama_joining_fee" || purpose === "chama_join") {
        // Record joining fee
        if (txn.group_id) {
          await supabase.from("chama_joining_fees").insert({
            group_id: txn.group_id,
            user_id: txn.user_id,
            amount: txn.amount,
          });

          // Auto-add member to group
          await supabase.from("chama_members").insert({
            group_id: txn.group_id,
            user_id: txn.user_id,
            role: "member",
          });

          // Update join request status
          await supabase
            .from("chama_join_requests")
            .update({ status: "completed" })
            .eq("group_id", txn.group_id)
            .eq("user_id", txn.user_id);
        }
      }

      // -------------------------
      // CHAMA SAVINGS
      // -------------------------
      if (purpose === "chama_savings" && txn.group_id) {
        await supabase.from("chama_savings").insert({
          group_id: txn.group_id,
          user_id: txn.user_id,
          amount: txn.amount,
          stk_reference: txn.reference,
          month: new Date().toISOString().slice(0, 7),
        });
      }

      // -------------------------
      // NOTIFICATION
      // -------------------------
      await supabase.from("notifications").insert({
        user_id: txn.user_id,
        title: "Payment Confirmed ✅",
        message: `KES ${txn.amount} received. Receipt: ${mpesaReceipt || "N/A"}`,
        type: "payment",
      });

    } else {
      // -------------------------
      // FAILURE FLOW
      // -------------------------
      await supabase.from("stk_transactions").update({
        status: "failed",
        result_code: String(ResultCode),
        result_desc: ResultDesc,
        updated_at: new Date().toISOString(),
      }).eq("id", txn.id);

      await supabase.from("notifications").insert({
        user_id: txn.user_id,
        title: "Payment Failed ❌",
        message: `Transaction failed: ${ResultDesc}`,
        type: "payment",
      });
    }

    return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });

  } catch (error) {
    console.error("Callback processing error:", error);
    return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

// -------------------------
// ✅ Helper
// -------------------------
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
