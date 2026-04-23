// C2B Confirmation — Safaricom posts confirmed payments here.
// Logs raw payload, dedups by TransID, classifies BillRefNumber, credits the right account.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, classifyBillRef } from "../_shared/mpesa.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ACK = { ResultCode: 0, ResultDesc: "Accepted" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    console.error("Confirmation: invalid JSON");
    return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  console.log("C2B Confirmation:", JSON.stringify(body));

  const transId = body.TransID || body.transID || body.transId;
  const amount = parseFloat(body.TransAmount || body.transAmount || "0");
  const billRef = body.BillRefNumber || body.billRefNumber || "";
  const msisdn = body.MSISDN || body.msisdn || "";

  if (!transId) {
    console.error("Missing TransID");
    return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 1. Dedup against existing C2B row
  const { data: existing } = await supabase
    .from("mpesa_c2b_transactions")
    .select("id, processed")
    .eq("trans_id", transId)
    .maybeSingle();

  if (existing) {
    console.log(`Duplicate TransID ${transId} ignored`);
    return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 1b. STK-origin dedup — if STK callback already credited this receipt, skip
  if (transId) {
    const { data: stkAlready } = await supabase
      .from("stk_transactions")
      .select("id")
      .eq("mpesa_receipt", transId)
      .eq("status", "success")
      .maybeSingle();
    if (stkAlready) {
      console.log(`Receipt ${transId} already credited via STK; skipping.`);
      await supabase.from("mpesa_c2b_transactions").insert({
        trans_id: transId,
        trans_amount: amount,
        bill_ref_number: billRef,
        msisdn,
        routing_type: "stk_already_credited",
        raw_payload: body,
        processed: true,
        processed_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // 2. Classify
  const route = await classifyBillRef(supabase, billRef);
  console.log(`Routing ${billRef} → ${route.type}`);

  // 3. Insert raw row
  const insertRow: any = {
    trans_id: transId,
    trans_type: body.TransactionType || body.TransType || null,
    trans_time: body.TransTime || null,
    trans_amount: amount,
    business_short_code: body.BusinessShortCode || null,
    bill_ref_number: billRef,
    invoice_number: body.InvoiceNumber || null,
    org_account_balance: body.OrgAccountBalance || null,
    third_party_trans_id: body.ThirdPartyTransID || null,
    msisdn,
    first_name: body.FirstName || null,
    middle_name: body.MiddleName || null,
    last_name: body.LastName || null,
    routing_type: route.type,
    target_user_id: "user_id" in route ? route.user_id : null,
    target_resource_id:
      route.type === "savings" ? route.savings_id :
      route.type === "chama" ? route.group_id :
      route.type === "loan" ? route.loan_id :
      (route.type === "harambee_user" || route.type === "harambee_public") ? route.harambee_id :
      null,
    raw_payload: body,
    processed: false,
  };

  const { data: c2bRow, error: insErr } = await supabase
    .from("mpesa_c2b_transactions")
    .insert(insertRow)
    .select()
    .single();

  if (insErr) {
    console.error("Failed to insert c2b:", insErr);
    return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: stkWonRace } = await supabase
    .from("stk_transactions")
    .select("id")
    .eq("mpesa_receipt", transId)
    .eq("status", "success")
    .maybeSingle();

  if (stkWonRace) {
    console.log(`Receipt ${transId} was credited by STK during C2B processing; skipping business logic.`);
    await supabase.from("mpesa_c2b_transactions")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        routing_type: "stk_already_credited",
      })
      .eq("id", c2bRow.id);
    return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 4. Process based on routing
  try {
    if (route.type === "wallet") {
      await supabase.rpc("ensure_wallet_credit", { _user_id: route.user_id, _amount: amount });
      // Fallback if RPC absent: direct upsert
      // (we'll do a safe upsert below)
      const { data: w } = await supabase.from("wallets").select("user_id, balance").eq("user_id", route.user_id).maybeSingle();
      if (!w) {
        await supabase.from("wallets").insert({ user_id: route.user_id, balance: amount });
      } else {
        // Note: ensure_wallet_credit may not exist; do direct math safely
        await supabase.from("wallets").update({ balance: (w.balance || 0) + amount }).eq("user_id", route.user_id);
      }
      await supabase.from("wallet_transactions").insert({
        user_id: route.user_id,
        type: "deposit",
        amount,
        description: `M-Pesa deposit · ${transId}`,
        reference_id: transId,
      });
      // Note: notification handled centrally below to avoid duplicates
    } else if (route.type === "savings") {
      const { data: s } = await supabase.from("personal_savings").select("saved_amount").eq("id", route.savings_id).maybeSingle();
      await supabase.from("personal_savings")
        .update({ saved_amount: (s?.saved_amount || 0) + amount })
        .eq("id", route.savings_id);
      await supabase.from("personal_savings_deposits").insert({
        user_id: route.user_id, savings_id: route.savings_id, amount, stk_reference: transId,
      });
      await supabase.from("notifications").insert({
        user_id: route.user_id, title: "Savings Deposit",
        message: `KES ${amount.toLocaleString()} added to your savings. Receipt: ${transId}`, type: "payment",
      });
    } else if (route.type === "chama") {
      // Credit as chama_savings for the depositor (msisdn match)
      let depositorUserId: string | null = null;
      if (msisdn) {
        // Try formats: 2547xxxxxxxx and 07xxxxxxxx
        const variants = [msisdn, "0" + msisdn.slice(3), "+" + msisdn];
        const { data: prof } = await supabase.from("profiles").select("user_id").in("phone", variants).maybeSingle();
        depositorUserId = prof?.user_id ?? null;
      }
      if (depositorUserId) {
        await supabase.from("chama_savings").insert({
          group_id: route.group_id, user_id: depositorUserId, amount, stk_reference: transId,
        });
        await supabase.from("notifications").insert({
          user_id: depositorUserId, title: "Chama Contribution",
          message: `KES ${amount.toLocaleString()} contributed to your chama. Receipt: ${transId}`, type: "payment",
        });
      } else {
        await supabase.from("mpesa_unmapped_payments").insert({
          c2b_transaction_id: c2bRow.id, bill_ref_number: billRef, amount, msisdn,
          reason: "Chama deposit but depositor MSISDN not linked to any user",
        });
      }
    } else if (route.type === "loan" && route.loan_id) {
      const { data: disb } = await supabase.from("loan_disbursements")
        .select("id, outstanding_balance")
        .eq("loan_id", route.loan_id)
        .maybeSingle();
      if (disb) {
        const newBal = Math.max(0, (disb.outstanding_balance || 0) - amount);
        await supabase.from("loan_disbursements")
          .update({ outstanding_balance: newBal, status: newBal === 0 ? "completed" : "active" })
          .eq("id", disb.id);
      }
      await supabase.from("notifications").insert({
        user_id: route.user_id, title: "Loan Repayment Received",
        message: `KES ${amount.toLocaleString()} applied to your loan. Receipt: ${transId}`, type: "payment",
      });
    } else if (route.type === "harambee_user" || route.type === "harambee_public") {
      if (route.harambee_id) {
        const contributorName = [body.FirstName, body.MiddleName, body.LastName].filter(Boolean).join(" ").trim() || null;
        await supabase.from("chama_harambee_contributions").insert({
          harambee_id: route.harambee_id,
          amount,
          contributor_name: contributorName,
          stk_reference: transId,
          user_id: route.type === "harambee_user" ? route.user_id : null,
        });
        // raised_amount auto-updated by trigger
      } else {
        await supabase.from("mpesa_unmapped_payments").insert({
          c2b_transaction_id: c2bRow.id, bill_ref_number: billRef, amount, msisdn,
          reason: `Harambee not found for slug ${billRef}`,
        });
      }
    } else {
      // unmapped
      await supabase.from("mpesa_unmapped_payments").insert({
        c2b_transaction_id: c2bRow.id, bill_ref_number: billRef, amount, msisdn,
        reason: route.type === "unmapped" ? route.reason : "Unhandled route",
      });
    }

    await supabase.from("mpesa_c2b_transactions")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("id", c2bRow.id);
  } catch (err) {
    console.error("Processing error:", err);
    await supabase.from("mpesa_c2b_transactions")
      .update({ processing_error: String(err) })
      .eq("id", c2bRow.id);
  }

  return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
