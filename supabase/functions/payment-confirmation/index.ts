// C2B Confirmation — clean URL alias (no "mpesa" in path so Safaricom accepts).
// Mirrors mpesa-confirmation logic exactly: dedup, classify, credit.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, classifyBillRef } from "../_shared/mpesa.ts";
import { sendUserSMS, sendSMS, SMS, fmt } from "../_shared/sms.ts";

const ADMIN_PHONE = "0751414437";

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

  console.log("Payment Confirmation:", JSON.stringify(body));

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
      console.log(`Receipt ${transId} already credited via STK; skipping business logic.`);
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

  // 4. Process
  try {
    if (route.type === "wallet") {
      const { data: w } = await supabase.from("wallets").select("user_id, balance").eq("user_id", route.user_id).maybeSingle();
      const newBalance = (Number(w?.balance) || 0) + amount;
      if (!w) {
        await supabase.from("wallets").insert({ user_id: route.user_id, balance: amount });
      } else {
        await supabase.from("wallets").update({ balance: newBalance }).eq("user_id", route.user_id);
      }
      await supabase.from("wallet_transactions").insert({
        user_id: route.user_id, type: "deposit", amount,
        description: `M-Pesa deposit · ${transId}`, reference_id: transId,
      });
      await supabase.from("notifications").insert({
        user_id: route.user_id, title: "Deposit Received",
        message: `KES ${amount.toLocaleString()} credited to your wallet. Receipt: ${transId}`, type: "payment",
      });
      await sendUserSMS(supabase, route.user_id, SMS.walletDeposit("{name}", amount, newBalance, transId));
    } else if (route.type === "savings") {
      const { data: s } = await supabase.from("personal_savings").select("saved_amount, name").eq("id", route.savings_id).maybeSingle();
      const newTotal = (Number(s?.saved_amount) || 0) + amount;
      await supabase.from("personal_savings")
        .update({ saved_amount: newTotal })
        .eq("id", route.savings_id);
      await supabase.from("personal_savings_deposits").insert({
        user_id: route.user_id, savings_id: route.savings_id, amount, stk_reference: transId,
      });
      await supabase.from("notifications").insert({
        user_id: route.user_id, title: "Savings Deposit",
        message: `KES ${amount.toLocaleString()} added to your savings. Receipt: ${transId}`, type: "payment",
      });
      await sendUserSMS(supabase, route.user_id, SMS.personalSavings("{name}", amount, newTotal, s?.name || "Savings"));
    } else if (route.type === "chama") {
      // Prefer depositor identified by classifier (chama A/B/C ref); fall back to MSISDN match.
      let depositorUserId: string | null = (route as any).user_id ?? null;
      if (!depositorUserId && msisdn) {
        const variants = [msisdn, "0" + msisdn.slice(3), "+" + msisdn];
        const { data: prof } = await supabase.from("profiles").select("user_id").in("phone", variants).maybeSingle();
        depositorUserId = prof?.user_id ?? null;
      }
      if (depositorUserId) {
        await supabase.from("chama_savings").insert({
          group_id: route.group_id, user_id: depositorUserId, amount, stk_reference: transId,
        });
        const { data: g } = await supabase.from("chama_groups").select("name").eq("id", route.group_id).maybeSingle();
        const { data: agg } = await supabase.from("chama_savings").select("amount").eq("group_id", route.group_id).eq("user_id", depositorUserId);
        const total = (agg || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        await supabase.from("notifications").insert({
          user_id: depositorUserId, title: "Chama Contribution",
          message: `KES ${amount.toLocaleString()} contributed to ${g?.name || "your chama"}. Receipt: ${transId}`, type: "payment",
        });
        await sendUserSMS(supabase, depositorUserId, SMS.chamaContribution("{name}", amount, g?.name || "your chama", total));
      } else {
        await supabase.from("mpesa_unmapped_payments").insert({
          c2b_transaction_id: c2bRow.id, bill_ref_number: billRef, amount, msisdn,
          reason: "Chama deposit but depositor not identified",
        });
      }
    } else if (route.type === "loan" && route.loan_id) {
      const { data: disb } = await supabase.from("loan_disbursements")
        .select("id, outstanding_balance, disbursed_amount")
        .eq("loan_id", route.loan_id)
        .maybeSingle();
      let newBal = 0;
      let totalPaid = amount;
      if (disb) {
        newBal = Math.max(0, (Number(disb.outstanding_balance) || 0) - amount);
        totalPaid = (Number(disb.disbursed_amount) || 0) - newBal;
        await supabase.from("loan_disbursements")
          .update({ outstanding_balance: newBal, status: newBal === 0 ? "completed" : "active" })
          .eq("id", disb.id);
      }
      await supabase.from("notifications").insert({
        user_id: route.user_id, title: "Loan Repayment Received",
        message: `KES ${amount.toLocaleString()} applied to your loan. Receipt: ${transId}`, type: "payment",
      });
      await sendUserSMS(supabase, route.user_id, SMS.loanRepayment("{name}", amount, totalPaid, newBal));
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
        // Update raised_amount on the harambee itself
        const { data: hRow } = await supabase.from("chama_harambees").select("raised_amount").eq("id", route.harambee_id).maybeSingle();
        await supabase.from("chama_harambees")
          .update({ raised_amount: (Number(hRow?.raised_amount) || 0) + amount })
          .eq("id", route.harambee_id);
        if (route.type === "harambee_user" && (route as any).user_id) {
          const { data: h } = await supabase.from("chama_harambees").select("beneficiary_name, title").eq("id", route.harambee_id).maybeSingle();
          await sendUserSMS(supabase, (route as any).user_id,
            SMS.harambeeContribution("{name}", amount, h?.beneficiary_name || h?.title || "the cause"));
        }
      } else {
        await supabase.from("mpesa_unmapped_payments").insert({
          c2b_transaction_id: c2bRow.id, bill_ref_number: billRef, amount, msisdn,
          reason: `Harambee not found for slug ${billRef}`,
        });
        await sendSMS(ADMIN_PHONE, `[Dasnet ALERT] Unmapped harambee payment: ${billRef} ${fmt(amount)} from ${msisdn}. Please reconcile.`);
      }
    } else if ((route as any).type === "mgr") {
      const r: any = route;
      // Insert MGR contribution
      await supabase.from("chama_mgr_contributions").insert({
        cycle_id: r.cycle_id, group_id: r.group_id, user_id: r.user_id,
        amount, payment_method: "paybill", reference: transId,
      });
      const { data: g } = await supabase.from("chama_groups").select("name").eq("id", r.group_id).maybeSingle();
      await supabase.from("notifications").insert({
        user_id: r.user_id, title: "Merry-Go-Round Payment",
        message: `KES ${amount.toLocaleString()} contributed to merry-go-round in ${g?.name || "your chama"}. Receipt: ${transId}`, type: "payment",
      });
      await sendUserSMS(supabase, r.user_id, SMS.chamaContribution("{name}", amount, `${g?.name || "your chama"} (Merry-go-round)`, amount));
    } else {
      await supabase.from("mpesa_unmapped_payments").insert({
        c2b_transaction_id: c2bRow.id, bill_ref_number: billRef, amount, msisdn,
        reason: route.type === "unmapped" ? route.reason : "Unhandled route",
      });
      const reason = route.type === "unmapped" ? route.reason : "Unhandled route";
      const payerName = [body.FirstName, body.MiddleName, body.LastName].filter(Boolean).join(" ").trim() || "Unknown";
      const ts = new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
      await sendSMS(ADMIN_PHONE,
        `[Dasnet ALERT] Unmapped payment ${fmt(amount)} from ${payerName} (${msisdn}) at ${ts}. Ref: ${billRef}. Reason: ${reason}.`);
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
