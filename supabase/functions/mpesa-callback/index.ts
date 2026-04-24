import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendUserSMS, SMS } from "../_shared/sms.ts";

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
    let userName = "Member";

    for (let i = 0; i < 5; i++) {
      const { data, error } = await supabase
        .from("stk_transactions")
        .select("*")
        .eq("checkout_request_id", CheckoutRequestID)
        .maybeSingle();

      if (error) {
        console.error("❌ Failed to fetch stk transaction:", JSON.stringify(error));
      }

      if (data) {
        txn = data;
        break;
      }

      await new Promise((r) => setTimeout(r, 500));
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

    if (txn.user_id) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", txn.user_id)
        .maybeSingle();

      if (profileError) {
        console.error("❌ Failed to fetch profile for notification:", JSON.stringify(profileError));
      } else if (profile?.full_name) {
        userName = profile.full_name;
      }
    }

    // =====================================================
    // ⛔ DUPLICATE GUARD
    // =====================================================
    if (txn.status === "success") {
      console.log("⏭️ Already processed as success, skipping:", txn.id);
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // =====================================================
    // ❌ FAILURE FLOW
    // =====================================================
    if (ResultCode !== 0) {
      const { error: failError } = await supabase
        .from("stk_transactions")
        .update({
          status: "failed",
          result_code: String(ResultCode),
          result_desc: ResultDesc,
          updated_at: now,
        })
        .eq("id", txn.id);

      if (failError) {
        console.error("❌ Failed to update status to 'failed':", failError);
      }

      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // =====================================================
    // ✅ SUCCESS FLOW
    // =====================================================
    console.log("📝 Updating stk_transactions to success for id:", txn.id);

    const { error: updateError } = await supabase
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
      .eq("id", txn.id);

    if (updateError) {
      console.error("❌ Primary update failed:", JSON.stringify(updateError));
      // Fallback by checkout_request_id
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
    }

    // STK is the source of truth for STK-initiated payments. C2B confirmation
    // checks `stk_transactions.status='success'` and defers to us. We always credit.
    const purpose = txn.purpose;
    userName = userName || txn.contributor_name || "Member";

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
          });
        }

        const { error: arrErr } = await supabase.from("chama_savings").insert(arrearsEntries);
        if (arrErr) console.error("❌ Arrears insert failed:", JSON.stringify(arrErr));
      } else {
        // ---- EMERGENCY FEE AUTO-DEDUCTION ----
        let savingsAmount = actualAmount;

        // Check for unpaid emergency contributions
        const { data: unpaidEmergency } = await supabase
          .from("chama_emergency_contributions")
          .select("id, amount")
          .eq("group_id", txn.group_id)
          .eq("user_id", txn.user_id)
          .eq("status", "pending")
          .order("created_at", { ascending: true });

        if (unpaidEmergency && unpaidEmergency.length > 0) {
          for (const ec of unpaidEmergency) {
            if (savingsAmount <= 0) break;

            const deduction = Math.min(savingsAmount, ec.amount);
            savingsAmount -= deduction;

            // Mark emergency contribution as paid
            await supabase
              .from("chama_emergency_contributions")
              .update({ status: "paid", stk_reference: mpesaReceipt })
              .eq("id", ec.id);

            // Credit the group emergency fund
            await supabase.rpc("increment_emergency_fund", {
              _group_id: txn.group_id,
              _amount: deduction,
            });

            console.log(`✅ Emergency fee KES ${deduction} deducted for user ${txn.user_id}`);
          }

          // Notify user about the deduction
          if (savingsAmount < actualAmount && txn.user_id) {
            const deducted = actualAmount - savingsAmount;
            await supabase.from("notifications").insert({
              user_id: txn.user_id,
              title: "Emergency Fund Deducted",
              message: `KES ${deducted} was auto-deducted from your deposit for emergency fund. KES ${savingsAmount} credited to savings.`,
              type: "chama_emergency",
            });
          }
        }

        // Only insert savings if there's remaining amount
        if (savingsAmount > 0) {
          const { error: savErr } = await supabase.from("chama_savings").insert({
            group_id: txn.group_id,
            user_id: txn.user_id,
            amount: savingsAmount,
            stk_reference: mpesaReceipt,
            month: new Date().toISOString().slice(0, 7),
          });
          if (savErr) console.error("❌ Savings insert failed:", JSON.stringify(savErr));
        }
      }
    }

    // ---------------- CHAMA PENALTY ----------------
    if (purpose === "chama_penalty") {
      const penaltyId = txn.penalty_id || txn.metadata?.penaltyId || null;

      if (penaltyId) {
        await supabase
          .from("chama_penalties")
          .update({ is_paid: true })
          .eq("id", penaltyId);
      }
    }

    // ---------------- HARAMBEE ----------------
    if (purpose === "harambee" && txn.harambee_id) {
      const contributionRecord: Record<string, any> = {
        harambee_id: txn.harambee_id,
        amount: actualAmount,
        stk_reference: mpesaReceipt,
      };

      if (txn.user_id) {
        contributionRecord.user_id = txn.user_id;
      }

      if (txn.contributor_name) {
        contributionRecord.contributor_name = txn.contributor_name;
      }

      const { error: contribError } = await supabase
        .from("chama_harambee_contributions")
        .insert(contributionRecord);

      if (contribError) {
        console.error("❌ Harambee contribution insert failed:", JSON.stringify(contribError));
      }
    }

    // ---------------- LOAN REPAYMENT ----------------
    if (purpose === "loan_repayment") {
      const disbursementId = txn.disbursement_id || txn.metadata?.disbursement_id;
      
      let d = null;
      if (disbursementId) {
        const { data } = await supabase
          .from("loan_disbursements")
          .select("*")
          .eq("id", disbursementId)
          .maybeSingle();
        d = data;
      }
      
      if (!d && txn.user_id) {
        const { data } = await supabase
          .from("loan_disbursements")
          .select("*")
          .eq("user_id", txn.user_id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        d = data;
      }

      if (d) {
        const newBal = Math.max(0, (d.outstanding_balance || 0) - actualAmount);
        const newStatus = newBal <= 0 ? "paid" : "active";

        await supabase
          .from("loan_disbursements")
          .update({ outstanding_balance: newBal, status: newStatus })
          .eq("id", d.id);

        if (newStatus === "paid") {
          await supabase
            .from("loan_applications")
            .update({ status: "paid" })
            .eq("id", d.loan_id);
        }
      }
    }

    // ---------------- WALLET ----------------
    if (["activation", "wallet_deposit"].includes(purpose) && txn.user_id) {
      const { data: w } = await supabase
        .from("wallets")
        .select("id, balance")
        .eq("user_id", txn.user_id)
        .maybeSingle();

      if (w) {
        await supabase
          .from("wallets")
          .update({ balance: Number(w.balance || 0) + Number(actualAmount) })
          .eq("id", w.id);

        const { error: wtErr } = await supabase.from("wallet_transactions").insert({
          user_id: txn.user_id,
          type: "deposit",
          amount: actualAmount,
          description: `M-Pesa Deposit: ${mpesaReceipt}`,
          reference_id: mpesaReceipt,
          status: "completed",
        });
        if (wtErr) console.error("❌ Wallet tx insert failed:", JSON.stringify(wtErr));
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
          .update({ saved_amount: (ps.saved_amount || 0) + actualAmount })
          .eq("id", txn.savings_id);

        const { error: depErr } = await supabase.from("personal_savings_deposits").insert({
          savings_id: txn.savings_id,
          user_id: txn.user_id,
          amount: actualAmount,
          stk_reference: mpesaReceipt,
        });
        if (depErr) console.error("❌ Savings deposit insert failed:", JSON.stringify(depErr));
      }
    }

    // ---------------- MERRY-GO-ROUND ----------------
    if (purpose === "merry_go_round" && txn.user_id && txn.group_id) {
      const cycleId = txn.metadata?.cycle_id;
      if (cycleId) {
        // Idempotency: skip if a contribution with this receipt already exists
        const { data: existing } = await supabase
          .from("chama_mgr_contributions")
          .select("id")
          .eq("reference", mpesaReceipt)
          .maybeSingle();

        if (!existing) {
          const { error: mgrErr } = await supabase
            .from("chama_mgr_contributions")
            .insert({
              cycle_id: cycleId,
              group_id: txn.group_id,
              user_id: txn.user_id,
              amount: actualAmount,
              payment_method: "stk",
              reference: mpesaReceipt,
            });
          if (mgrErr) {
            console.error("❌ MGR contribution insert failed:", JSON.stringify(mgrErr));
          } else {
            // Notify the recipient that someone paid
            const { data: cycle } = await supabase
              .from("chama_mgr_cycles")
              .select("recipient_id, cycle_number")
              .eq("id", cycleId)
              .maybeSingle();
            if (cycle?.recipient_id && cycle.recipient_id !== txn.user_id) {
              await supabase.from("notifications").insert({
                user_id: cycle.recipient_id,
                title: "💰 Merry-Go-Round Contribution",
                message: `${userName} contributed KES ${actualAmount.toLocaleString()} to cycle #${cycle.cycle_number}.`,
                type: "mgr_payment",
              });
            }
          }
        }
      } else {
        console.warn("⚠️ MGR STK without cycle_id in metadata:", txn.id);
      }
    }

    // ---------------- CHAMA JOIN ----------------
    if (purpose === "chama_joining_fee" || purpose === "chama_join") {
      if (txn.group_id && txn.user_id) {
        const { error: feeErr } = await supabase.from("chama_joining_fees").insert({
          group_id: txn.group_id,
          user_id: txn.user_id,
          amount: actualAmount,
        });
        if (feeErr) console.error("❌ Joining fee insert failed:", JSON.stringify(feeErr));

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
    if (txn.user_id) {
      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: txn.user_id,
        title: "Payment Confirmed ✅",
        message: notificationMsg,
        type: "payment",
      });
      if (notifErr) console.error("❌ Notification insert failed:", JSON.stringify(notifErr));

      // --- SMS NOTIFICATION (Africa's Talking) ---
      try {
        let smsMsg = "";
        if (purpose === "wallet_deposit" || purpose === "activation") {
          const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", txn.user_id).maybeSingle();
          smsMsg = SMS.walletDeposit("{name}", actualAmount, Number(w?.balance || 0), mpesaReceipt);
        } else if (purpose === "personal_savings" && txn.savings_id) {
          const { data: ps } = await supabase.from("personal_savings").select("saved_amount, name").eq("id", txn.savings_id).maybeSingle();
          smsMsg = SMS.personalSavings("{name}", actualAmount, Number(ps?.saved_amount || 0), ps?.name || "Savings");
        } else if (purpose === "chama_savings" && txn.group_id) {
          const { data: g } = await supabase.from("chama_groups").select("name").eq("id", txn.group_id).maybeSingle();
          const { data: agg } = await supabase.from("chama_savings").select("amount").eq("group_id", txn.group_id).eq("user_id", txn.user_id);
          const total = (agg || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
          smsMsg = SMS.chamaContribution("{name}", actualAmount, g?.name || "your chama", total);
        } else if (purpose === "loan_repayment") {
          const { data: d } = await supabase.from("loan_disbursements").select("outstanding_balance, disbursed_amount").eq("user_id", txn.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
          const bal = Number(d?.outstanding_balance || 0);
          const paid = Number(d?.disbursed_amount || 0) - bal;
          smsMsg = SMS.loanRepayment("{name}", actualAmount, paid, bal);
        } else if (purpose === "harambee" && txn.harambee_id) {
          const { data: h } = await supabase.from("chama_harambees").select("beneficiary_name, title").eq("id", txn.harambee_id).maybeSingle();
          smsMsg = SMS.harambeeContribution("{name}", actualAmount, h?.beneficiary_name || h?.title || "the cause");
        }
        if (smsMsg) await sendUserSMS(supabase, txn.user_id, smsMsg);
      } catch (smsErr) {
        console.error("⚠️ SMS notification failed (non-fatal):", smsErr);
      }


      // --- EMAIL NOTIFICATION ---
      try {
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", txn.user_id)
          .maybeSingle();

        if (userProfile?.email) {
          const purposeLabels: Record<string, string> = {
            chama_savings: "Chama Savings",
            chama_penalty: "Penalty Payment",
            harambee: "Harambee Contribution",
            loan_repayment: "Loan Repayment",
            activation: "Account Activation",
            wallet_deposit: "Wallet Deposit",
            personal_savings: "Personal Savings",
            chama_joining_fee: "Joining Fee",
            chama_join: "Joining Fee",
          };

          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "transaction-notification",
              recipientEmail: userProfile.email,
              idempotencyKey: `txn-${txn.id}-${mpesaReceipt}`,
              templateData: {
                type: purposeLabels[purpose] || purpose || "Payment",
                amount: `KES ${Number(actualAmount).toLocaleString()}`,
                reference: mpesaReceipt,
                status: "Completed",
                date: new Date().toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }),
                description: ResultDesc || "",
                name: userProfile.full_name || userName,
              },
            },
          });
        }
      } catch (emailErr) {
        console.error("⚠️ Email notification failed (non-fatal):", emailErr);
      }
    }

    return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("CRITICAL ERROR:", error);
    return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});
