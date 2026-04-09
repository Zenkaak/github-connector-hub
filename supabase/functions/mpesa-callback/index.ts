import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * M-PESA CALLBACK EDGE FUNCTION
 * Full Version: Handles all utility types (Savings, Loans, Harambee, Wallet, Penalties)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    console.log("M-Pesa callback received:", JSON.stringify(body));

    const callback = body?.Body?.stkCallback;
    if (!callback) {
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc } = callback;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // =====================================================
    // 🔁 RETRY FETCH (handles race condition)
    // =====================================================
    let txn = null;

    for (let i = 0; i < 3; i++) {
      const { data } = await supabase
        .from("stk_transactions")
        .select("*, profiles(full_name)")
        .eq("checkout_request_id", CheckoutRequestID)
        .maybeSingle();

      if (data) {
        txn = data;
        break;
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    const metadataItems = callback?.CallbackMetadata?.Item || [];

    const getMeta = (name: string) =>
      metadataItems.find((i: any) => i.Name === name)?.Value || null;

    const mpesaReceipt = String(getMeta("MpesaReceiptNumber") || "");
    const actualAmount = Number(getMeta("Amount") || txn?.amount || 0);
    const phone = getMeta("PhoneNumber");

    const now = new Date().toISOString();

    // =====================================================
    // 🚨 FALLBACK INSERT (if callback arrives before insert)
    // =====================================================
    if (!txn) {
      console.warn("⚠️ Transaction not found — inserting fallback");

      await supabase.from("stk_transactions").insert({
        checkout_request_id: CheckoutRequestID,
        merchant_request_id: callback.MerchantRequestID,
        phone,
        amount: actualAmount,
        status: ResultCode === 0 ? "success" : "failed",
        result_code: String(ResultCode),
        result_desc: ResultDesc,
        mpesa_receipt: mpesaReceipt,
        paid_at: ResultCode === 0 ? now : null,
        callback_result: JSON.stringify(callback),
        purpose: "unknown",
      });

      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // =====================================================
    // ⛔ DUPLICATE GUARD
    // =====================================================
    if (txn.status === "success") {
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // =====================================================
    // ✅ SUCCESS FLOW
    // =====================================================
    if (ResultCode === 0) {
      await supabase
        .from("stk_transactions")
        .update({
          status: "success",
          result_code: String(ResultCode),
          result_desc: ResultDesc,
          mpesa_receipt: mpesaReceipt,
          paid_at: now,
          callback_result: JSON.stringify(callback),
          updated_at: now,
        })
        .eq("checkout_request_id", CheckoutRequestID);

      const purpose = txn.purpose;
      const userName = txn.profiles?.full_name || "Member";

      const notificationMsg = `Dear ${userName}, payment of KES ${Number(
        actualAmount
      ).toLocaleString()} received. Receipt: ${mpesaReceipt}.`;

      // =====================================================
      // 🧠 BUSINESS LOGIC ROUTER
      // =====================================================

      // ---------------- CHAMA SAVINGS ----------------
      if (purpose === "chama_savings" && txn.group_id) {
        const metadata = txn.metadata || {};

        if (metadata.isArrears || metadata.type === "arrears_clearance") {
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
              description: `Arrears Clearance (${i + 1}/${missedCount})`,
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
            description: "Regular Savings",
          });
        }
      }

      // ---------------- CHAMA PENALTY ----------------
      if (purpose === "chama_penalty") {
        const penaltyId =
          txn.penalty_id || txn.metadata?.penaltyId || null;

        if (penaltyId) {
          await supabase
            .from("chama_penalties")
            .update({ is_paid: true })
            .eq("id", penaltyId);
        } else {
          await supabase.rpc("mark_oldest_penalty_paid", {
            p_user_id: txn.user_id,
            p_group_id: txn.group_id,
          });
        }
      }

      // ---------------- HARAMBEE ----------------
      if (purpose === "harambee" && txn.harambee_id) {
        const { data: h } = await supabase
          .from("chama_harambees")
          .select("raised_amount")
          .eq("id", txn.harambee_id)
          .maybeSingle();

        if (h) {
          await supabase
            .from("chama_harambees")
            .update({
              raised_amount: (h.raised_amount || 0) + actualAmount,
            })
            .eq("id", txn.harambee_id);

          await supabase.from("chama_harambee_contributions").insert({
            harambee_id: txn.harambee_id,
            user_id: txn.user_id,
            amount: actualAmount,
            stk_reference: mpesaReceipt,
          });
        }
      }

      // ---------------- LOAN REPAYMENT ----------------
      if (purpose === "loan_repayment") {
        const { data: d } = await supabase
          .from("loan_disbursements")
          .select("*")
          .eq("user_id", txn.user_id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (d) {
          const newBal = Math.max(
            0,
            (d.outstanding_balance || 0) - actualAmount
          );

          const newStatus = newBal <= 0 ? "paid" : "active";

          await supabase
            .from("loan_disbursements")
            .update({
              outstanding_balance: newBal,
              status: newStatus,
            })
            .eq("id", d.id);

          if (newStatus === "paid") {
            await supabase
              .from("loan_applications")
              .update({ status: "paid" })
              .eq("id", d.loan_id);
          }

          await supabase.from("loan_repayments").insert({
            disbursement_id: d.id,
            user_id: txn.user_id,
            amount: actualAmount,
            mpesa_reference: mpesaReceipt,
            status: "completed",
          });
        }
      }

      // ---------------- WALLET ----------------
      if (["activation", "wallet_deposit"].includes(purpose)) {
        const { data: w } = await supabase
          .from("wallets")
          .select("id, balance")
          .eq("user_id", txn.user_id)
          .maybeSingle();

        if (w) {
          await supabase
            .from("wallets")
            .update({
              balance: Number(w.balance || 0) + Number(actualAmount),
            })
            .eq("id", w.id);

          await supabase.from("wallet_transactions").insert({
            wallet_id: w.id,
            user_id: txn.user_id,
            type: "deposit",
            amount: actualAmount,
            description: `M-Pesa Deposit: ${mpesaReceipt}`,
            reference_id: mpesaReceipt,
            status: "completed",
          });
        }
      }

      // ---------------- PERSONAL SAVINGS ----------------
      if (purpose === "personal_savings" && txn.savings_id) {
        const { data: ps } = await supabase
          .from("personal_savings")
          .select("saved_amount")
          .eq("id", txn.savings_id)
          .maybeSingle();

        if (ps) {
          await supabase
            .from("personal_savings")
            .update({
              saved_amount: (ps.saved_amount || 0) + actualAmount,
            })
            .eq("id", txn.savings_id);

          await supabase.from("personal_savings_deposits").insert({
            savings_id: txn.savings_id,
            user_id: txn.user_id,
            amount: actualAmount,
            stk_reference: mpesaReceipt,
          });
        }
      }

      // ---------------- CHAMA JOIN ----------------
      if (purpose === "chama_joining_fee" || purpose === "chama_join") {
        if (txn.group_id) {
          await supabase.from("chama_joining_fees").insert({
            group_id: txn.group_id,
            user_id: txn.user_id,
            amount: actualAmount,
            reference: mpesaReceipt,
          });

          await supabase.from("chama_members").insert({
            group_id: txn.group_id,
            user_id: txn.user_id,
            role: "member",
          });

          await supabase
            .from("chama_join_requests")
            .update({ status: "completed" })
            .eq("group_id", txn.group_id)
            .eq("user_id", txn.user_id);
        }
      }

      // ---------------- NOTIFICATION ----------------
      await supabase.from("notifications").insert({
        user_id: txn.user_id,
        title: "Payment Confirmed ✅",
        message: notificationMsg,
        type: "payment",
        metadata: {
          receipt: mpesaReceipt,
          amount: actualAmount,
          purpose,
        },
      });
    } else {
      // =====================================================
      // ❌ FAILURE FLOW
      // =====================================================
      await supabase
        .from("stk_transactions")
        .update({
          status: "failed",
          result_code: String(ResultCode),
          result_desc: ResultDesc,
          updated_at: now,
        })
        .eq("checkout_request_id", CheckoutRequestID);
    }

    return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("CRITICAL ERROR:", error);
    return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});
