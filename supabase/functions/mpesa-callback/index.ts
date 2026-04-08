import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * M-PESA CALLBACK EDGE FUNCTION
 * Fully automated processing for:
 * - Chama Savings & Arrears Backfilling
 * - Chama Penalties
 * - Harambee Contributions
 * - Loan Repayments
 * - Wallet Deposits & Activation
 * - Personal Savings
 * - Chama Joining Fees
 */

// Helper to return consistent JSON responses to Safaricom
const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

Deno.serve(async (req) => {
  // Only allow POST requests from Safaricom
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // ---------------------------------------------------------
    // 1. SAFE BODY PARSING & LOGGING
    // ---------------------------------------------------------
    let body: any;
    try {
      body = await req.json();
    } catch {
      console.error("Invalid JSON body received from Safaricom");
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    console.log("M-Pesa callback received:", JSON.stringify(body));

    const callback = body?.Body?.stkCallback;
    if (!callback) {
      console.error("Invalid callback structure: Missing stkCallback");
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc } = callback;

    if (!CheckoutRequestID) {
      console.error("Missing CheckoutRequestID in callback");
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // ---------------------------------------------------------
    // 2. INITIALIZE SUPABASE ADMIN
    // ---------------------------------------------------------
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing Supabase environment variables: URL or Service Key");
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // ---------------------------------------------------------
    // 3. FETCH TRANSACTION & USER PROFILE
    // ---------------------------------------------------------
    const { data: txn, error: findError } = await supabase
      .from("stk_transactions")
      .select("*, profiles(full_name)")
      .eq("checkout_request_id", CheckoutRequestID)
      .maybeSingle();

    if (findError || !txn) {
      console.error("Transaction record not found for ID:", CheckoutRequestID);
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // ---------------------------------------------------------
    // 4. IDEMPOTENCY GUARD
    // ---------------------------------------------------------
    if (txn.status === "success" || txn.status === "failed") {
      console.log("Transaction already processed or finalized:", txn.id);
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // ---------------------------------------------------------
    // 5. PROCESS SUCCESSFUL PAYMENT (ResultCode 0)
    // ---------------------------------------------------------
    if (ResultCode === 0) {
      const metadataItems = callback?.CallbackMetadata?.Item || [];
      const mpesaReceipt = metadataItems.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value || null;
      const actualAmount = metadataItems.find((i: any) => i.Name === "Amount")?.Value || txn.amount;
      const phoneNumber = metadataItems.find((i: any) => i.Name === "PhoneNumber")?.Value || null;
      const transDate = metadataItems.find((i: any) => i.Name === "TransactionDate")?.Value || null;

      // Update the primary transaction record
      await supabase.from("stk_transactions").update({
        status: "success",
        result_code: String(ResultCode),
        result_desc: ResultDesc,
        mpesa_receipt: mpesaReceipt,
        updated_at: new Date().toISOString(),
      }).eq("id", txn.id);

      const purpose = txn.purpose;
      const userName = txn.profiles?.full_name || "Member";
      
      // Default professional notification
      let notificationMsg = `Dear ${userName}, your payment of KES ${actualAmount.toLocaleString()} has been received successfully. Receipt: ${mpesaReceipt}. Thank you for using our platform.`;

      // --- LOGIC: CHAMA SAVINGS & ARREARS BACKFILLING ---
      if (purpose === "chama_savings" && txn.group_id) {
        const metadata = txn.metadata || {};
        const isArrears = metadata.isArrears === true || metadata.type === 'arrears_clearance';
        
        if (isArrears) {
          notificationMsg = `Dear ${userName}, you have successfully cleared your arrears of KES ${actualAmount.toLocaleString()}. Your account is now up to date. Receipt: ${mpesaReceipt}.`;
          
          // Automation: Backfill missed months so the "Pay Now" button disappears correctly
          const missedCount = metadata.missed_count || 1; 
          const individualAmount = actualAmount / missedCount;
          const arrearsEntries = [];
          
          for (let i = 0; i < missedCount; i++) {
            const entryDate = new Date();
            // Offset the month string back for each missed payment to maintain history
            entryDate.setMonth(entryDate.getMonth() - i);
            arrearsEntries.push({
              group_id: txn.group_id,
              user_id: txn.user_id,
              amount: individualAmount,
              stk_reference: mpesaReceipt || txn.reference,
              month: entryDate.toISOString().slice(0, 7),
              description: `Arrears Clearance (${i + 1}/${missedCount})`
            });
          }
          await supabase.from("chama_savings").insert(arrearsEntries);
        } else {
          notificationMsg = `Dear ${userName}, you have successfully saved KES ${actualAmount.toLocaleString()} to your group. Receipt: ${mpesaReceipt}.`;
          await supabase.from("chama_savings").insert({
            group_id: txn.group_id,
            user_id: txn.user_id,
            amount: actualAmount,
            stk_reference: mpesaReceipt || txn.reference,
            month: new Date().toISOString().slice(0, 7),
            description: "Regular Savings"
          });
        }
      }

      // --- LOGIC: CHAMA PENALTY ---
      if (purpose === "chama_penalty") {
        notificationMsg = `Dear ${userName}, your penalty payment of KES ${actualAmount.toLocaleString()} has been received. Your record has been cleared. Receipt: ${mpesaReceipt}.`;
        const penaltyId = txn.penalty_id || txn.metadata?.penaltyId;
        if (penaltyId) {
          await supabase.from("chama_penalties").update({ is_paid: true }).eq("id", penaltyId);
        } else {
          // Fallback logic to clear oldest unpaid penalty if ID is missing
          await supabase.rpc('mark_oldest_penalty_paid', { 
            p_user_id: txn.user_id, 
            p_group_id: txn.group_id 
          });
        }
      }

      // --- LOGIC: HARAMBEE CONTRIBUTIONS ---
      if (purpose === "harambee" && txn.harambee_id) {
        notificationMsg = `Dear ${userName}, thank you for your generous contribution of KES ${actualAmount.toLocaleString()} towards the Harambee. Receipt: ${mpesaReceipt}.`;
        const { data: harambee } = await supabase.from("chama_harambees").select("raised_amount").eq("id", txn.harambee_id).maybeSingle();
        if (harambee) {
          const newTotal = (harambee.raised_amount || 0) + actualAmount;
          await supabase.from("chama_harambees").update({ raised_amount: newTotal }).eq("id", txn.harambee_id);
          await supabase.from("chama_harambee_contributions").insert({ 
            harambee_id: txn.harambee_id, 
            user_id: txn.user_id, 
            amount: actualAmount, 
            stk_reference: mpesaReceipt || txn.reference 
          });
        }
      }

      // --- LOGIC: LOAN REPAYMENT ---
      if (purpose === "loan_repayment") {
        notificationMsg = `Dear ${userName}, your loan repayment of KES ${actualAmount.toLocaleString()} has been processed. Thank you for making your payment on time. Receipt: ${mpesaReceipt}.`;
        
        // Find the active disbursement
        const { data: disb } = await supabase.from("loan_disbursements")
          .select("*")
          .eq(txn.disbursement_id ? "id" : "user_id", txn.disbursement_id || txn.user_id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (disb) {
          const newBalance = Math.max(0, (disb.outstanding_balance || 0) - actualAmount);
          const newStatus = newBalance <= 0 ? "paid" : "active";
          
          await supabase.from("loan_disbursements")
            .update({ outstanding_balance: newBalance, status: newStatus })
            .eq("id", disb.id);
            
          // If fully paid, update the original application status
          if (newStatus === "paid") {
            await supabase.from("loan_applications").update({ status: "paid" }).eq("id", disb.loan_id);
          }

          // Log the payment in loan_repayments table
          await supabase.from("loan_repayments").insert({
            disbursement_id: disb.id,
            user_id: txn.user_id,
            amount: actualAmount,
            mpesa_reference: mpesaReceipt,
            status: 'completed'
          });
        }
      }

      // --- LOGIC: WALLET DEPOSITS / ACCOUNT ACTIVATION ---
      if (["activation", "wallet_deposit"].includes(purpose)) {
        notificationMsg = `Dear ${userName}, your wallet has been successfully credited with KES ${actualAmount.toLocaleString()}. Receipt: ${mpesaReceipt}.`;
        
        const { data: wallet } = await supabase.from("wallets")
          .select("id, balance")
          .eq("user_id", txn.user_id)
          .maybeSingle();

        if (wallet) {
          const newBal = (wallet.balance || 0) + actualAmount;
          await supabase.from("wallets").update({ balance: newBal }).eq("id", wallet.id);
          
          await supabase.from("wallet_transactions").insert({
            wallet_id: wallet.id,
            user_id: txn.user_id,
            type: "deposit",
            amount: actualAmount,
            description: `M-Pesa Deposit: ${mpesaReceipt}`,
            reference_id: mpesaReceipt || txn.reference,
            status: "completed"
          });
        }
      }

      // --- LOGIC: PERSONAL SAVINGS ---
      if (purpose === "personal_savings" && txn.savings_id) {
        notificationMsg = `Dear ${userName}, your personal savings deposit of KES ${actualAmount.toLocaleString()} was successful. Receipt: ${mpesaReceipt}.`;
        
        const { data: ps } = await supabase.from("personal_savings")
          .select("saved_amount")
          .eq("id", txn.savings_id)
          .maybeSingle();

        if (ps) {
          const newSavingsTotal = (ps.saved_amount || 0) + actualAmount;
          await supabase.from("personal_savings").update({ saved_amount: newSavingsTotal }).eq("id", txn.savings_id);
          
          await supabase.from("personal_savings_deposits").insert({
            savings_id: txn.savings_id,
            user_id: txn.user_id,
            amount: actualAmount,
            stk_reference: mpesaReceipt || txn.reference,
          });
        }
      }

      // --- LOGIC: CHAMA JOINING FEES ---
      if (purpose === "chama_joining_fee" || purpose === "chama_join") {
        notificationMsg = `Dear ${userName}, your joining fee of KES ${actualAmount.toLocaleString()} has been received. Welcome to the group! Receipt: ${mpesaReceipt}.`;
        
        if (txn.group_id) {
          // Record the fee
          await supabase.from("chama_joining_fees").insert({ 
            group_id: txn.group_id, 
            user_id: txn.user_id, 
            amount: actualAmount,
            reference: mpesaReceipt
          });
          
          // Add to members table
          await supabase.from("chama_members").insert({ 
            group_id: txn.group_id, 
            user_id: txn.user_id, 
            role: "member" 
          });
          
          // Finalize any pending join requests
          await supabase.from("chama_join_requests")
            .update({ status: "completed" })
            .eq("group_id", txn.group_id)
            .eq("user_id", txn.user_id);
        }
      }

      // ---------------------------------------------------------
      // 6. FINALIZE SUCCESS NOTIFICATION
      // ---------------------------------------------------------
      await supabase.from("notifications").insert({
        user_id: txn.user_id,
        title: "Payment Confirmed ✅",
        message: notificationMsg,
        type: "payment",
        metadata: {
          receipt: mpesaReceipt,
          amount: actualAmount,
          purpose: purpose
        }
      });

    } else {
      // ---------------------------------------------------------
      // 7. PROCESS FAILED PAYMENT (User cancelled or timeout)
      // ---------------------------------------------------------
      await supabase.from("stk_transactions").update({
        status: "failed",
        result_code: String(ResultCode),
        result_desc: ResultDesc,
        updated_at: new Date().toISOString(),
      }).eq("id", txn.id);

      await supabase.from("notifications").insert({
        user_id: txn.user_id,
        title: "Payment Failed ❌",
        message: `Dear ${txn.profiles?.full_name || "Member"}, your transaction of KES ${txn.amount.toLocaleString()} was unsuccessful: ${ResultDesc}. Please try again.`,
        type: "payment",
      });
    }

    // ---------------------------------------------------------
    // 8. FINAL ACKNOWLEDGMENT TO SAFARICOM
    // ---------------------------------------------------------
    return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });

  } catch (error) {
    console.error("CRITICAL SYSTEM ERROR IN EDGE FUNCTION:", error);
    // We still return 200 to Safaricom to prevent them from retrying an already failed processing attempt
    return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});
 
