// Merry-Go-Round auto-payout worker (run every ~5 min via cron).
// For each open cycle whose payout_date has arrived:
//  1. Sum collected contributions
//  2. B2C the recipient on their registered phone
//  3. Mark cycle paid_out (or payout_failed)
//  4. Notify recipient + list non-payers to chairperson
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, getAccessToken, MPESA_BASE, PAYBILL, CALLBACKS } from "../_shared/mpesa.ts";
import { sendUserSMS, sendSMS, SMS, fmt } from "../_shared/sms.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Optional body: { cycle_id } — chairperson-triggered single-cycle payout
  let body: any = {};
  try { body = await req.clone().json(); } catch { /* no body */ }
  const cycleIdOverride: string | undefined = body?.cycle_id;

  // Auth: service-role / anon (cron) OR authenticated chair (with cycle_id)
  let authorized = auth === serviceKey || auth === anonKey;
  let chairTriggered = false;
  if (!authorized && cycleIdOverride && auth) {
    const { data: u } = await supabase.auth.getUser(auth);
    if (u?.user?.id) {
      const { data: cy } = await supabase.from("chama_mgr_cycles")
        .select("group_id").eq("id", cycleIdOverride).maybeSingle();
      if (cy?.group_id) {
        const { data: m } = await supabase.from("chama_members")
          .select("role").eq("group_id", cy.group_id).eq("user_id", u.user.id)
          .eq("is_active", true).maybeSingle();
        if (m?.role === "chairperson") { authorized = true; chairTriggered = true; }
      }
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const nowIso = new Date().toISOString();

  // ---- Reconciliation: cron-only run resolves any stuck payout_pending cycles
  // (chair & cron can both trigger, so we double-check the actual B2C status
  // before re-processing or letting them stay stuck.)
  const reconciled: any[] = [];
  if (!chairTriggered) {
    const { data: pending } = await supabase
      .from("chama_mgr_cycles").select("*")
      .eq("status", "payout_pending");
    for (const cy of pending || []) {
      const occasion = `MGR cycle #${cy.cycle_number}`.slice(0, 100);
      const { data: b2c } = await supabase
        .from("mpesa_b2c_requests")
        .select("id, status, last_attempt_at, result_desc")
        .eq("user_id", cy.recipient_id)
        .eq("occasion", occasion)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!b2c) {
        // No B2C request found — reset so cron/chair can try again
        await supabase.from("chama_mgr_cycles")
          .update({ status: "payout_failed" }).eq("id", cy.id);
        await notifyChairOfFailure(supabase, cy, "No B2C request found for pending payout");
        reconciled.push({ cycle_id: cy.id, action: "reset_no_request" });
        continue;
      }
      if (b2c.status === "completed") {
        await supabase.from("chama_mgr_cycles")
          .update({ status: "paid_out" }).eq("id", cy.id);
        reconciled.push({ cycle_id: cy.id, action: "marked_paid_out" });
        continue;
      }
      if (b2c.status === "failed") {
        await supabase.from("chama_mgr_cycles")
          .update({ status: "payout_failed" }).eq("id", cy.id);
        await notifyChairOfFailure(supabase, cy, b2c.result_desc || "B2C marked failed");
        reconciled.push({ cycle_id: cy.id, action: "marked_failed" });
        continue;
      }
      // Still processing — flag as failed if stale (>15 min) so chair can retry
      const lastAt = b2c.last_attempt_at ? new Date(b2c.last_attempt_at).getTime() : 0;
      if (lastAt && Date.now() - lastAt > 15 * 60 * 1000) {
        await supabase.from("chama_mgr_cycles")
          .update({ status: "payout_failed" }).eq("id", cy.id);
        await supabase.from("mpesa_b2c_requests")
          .update({ status: "failed", result_desc: "Timed out awaiting M-Pesa callback" })
          .eq("id", b2c.id);
        await notifyChairOfFailure(supabase, cy, "Timed out awaiting M-Pesa confirmation");
        reconciled.push({ cycle_id: cy.id, action: "timed_out" });
      } else {
        reconciled.push({ cycle_id: cy.id, action: "still_processing" });
      }
    }
  }

  let dueCycles: any[] = [];
  if (chairTriggered && cycleIdOverride) {
    const { data: cy, error } = await supabase
      .from("chama_mgr_cycles").select("*").eq("id", cycleIdOverride).maybeSingle();
    if (error || !cy) {
      return new Response(JSON.stringify({ error: "cycle not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cy.status === "paid_out") {
      return new Response(JSON.stringify({ error: "Already paid out" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cy.status === "payout_pending") {
      return new Response(JSON.stringify({ error: "Payout already in progress — awaiting M-Pesa confirmation" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // For chair retry, reset payout_failed -> open so processCycle proceeds
    if (cy.status === "payout_failed") {
      await supabase.from("chama_mgr_cycles").update({ status: "open" }).eq("id", cy.id);
      cy.status = "open";
    }
    dueCycles = [cy];
  } else {
    const { data, error } = await supabase
      .from("chama_mgr_cycles").select("*")
      .eq("status", "open").lte("payout_date", nowIso);
    if (error) {
      console.error("Failed to load due cycles:", error);
      return new Response(JSON.stringify({ error: "load_failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    dueCycles = data || [];
  }

  const results: any[] = [];
  for (const cycle of dueCycles) {
    try {
      const r = await processCycle(supabase, cycle);
      results.push({ cycle_id: cycle.id, ...r });
      if (r && r.ok === false && r.reason && r.reason !== "no_funds" && r.reason !== "already_in_flight") {
        await notifyChairOfFailure(supabase, cycle, r.reason);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`Cycle ${cycle.id} payout failed:`, reason);
      await supabase.from("chama_mgr_cycles")
        .update({ status: "payout_failed" }).eq("id", cycle.id);
      await notifyChairOfFailure(supabase, cycle, reason);
      results.push({ cycle_id: cycle.id, ok: false, error: reason });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function processCycle(supabase: any, cycle: any) {
  // Sum contributions
  const { data: contribs } = await supabase
    .from("chama_mgr_contributions")
    .select("user_id, amount")
    .eq("cycle_id", cycle.id);

  const total = (contribs || []).reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
  const paidUserIds = new Set((contribs || []).map((c: any) => c.user_id));

  if (total < 10) {
    // Nothing to pay out
    await supabase.from("chama_mgr_cycles")
      .update({ status: "closed_no_funds", payout_amount: 0, payout_processed_at: new Date().toISOString() })
      .eq("id", cycle.id);
    return { ok: false, reason: "no_funds", total };
  }

  // Recipient phone
  const { data: recipProfile } = await supabase
    .from("profiles").select("phone, full_name")
    .eq("user_id", cycle.recipient_id).maybeSingle();

  if (!recipProfile?.phone) {
    throw new Error("Recipient has no phone");
  }

  let normalized = String(recipProfile.phone).replace(/\D/g, "");
  if (normalized.startsWith("0")) normalized = "254" + normalized.slice(1);
  if (normalized.startsWith("7") || normalized.startsWith("1")) normalized = "254" + normalized;
  if (!/^254[17]\d{8}$/.test(normalized)) throw new Error(`Bad recipient phone: ${recipProfile.phone}`);

  const payoutAmount = Math.floor(total); // integer KES

  // Insert b2c request row first (idempotency: skip if exists for cycle)
  const occasion = `MGR cycle #${cycle.cycle_number}`.slice(0, 100);
  const { data: existing } = await supabase
    .from("mpesa_b2c_requests").select("id, status")
    .eq("user_id", cycle.recipient_id)
    .eq("occasion", occasion)
    .maybeSingle();
  if (existing && (existing.status === "processing" || existing.status === "completed")) {
    return { ok: true, reason: "already_in_flight", request_id: existing.id };
  }

  const origConv = `MGR-${cycle.id.slice(0, 8)}-${Date.now()}`.slice(0, 40);
  const { data: b2cRow, error: b2cInsErr } = await supabase
    .from("mpesa_b2c_requests").insert({
      user_id: cycle.recipient_id,
      amount: payoutAmount,
      phone: normalized,
      remarks: `Merry-go-round payout · cycle #${cycle.cycle_number}`,
      occasion,
      originator_conversation_id: origConv,
      status: "pending",
    }).select("id").single();
  if (b2cInsErr) throw b2cInsErr;

  // Call Daraja
  const accessToken = await getAccessToken();
  const initiator = Deno.env.get("MPESA_INITIATOR_NAME");
  const securityCred = Deno.env.get("MPESA_SECURITY_CREDENTIAL");
  if (!initiator || !securityCred) throw new Error("B2C credentials not configured");

  const payload = {
    OriginatorConversationID: origConv,
    InitiatorName: initiator,
    SecurityCredential: securityCred,
    CommandID: "BusinessPayment",
    Amount: payoutAmount,
    PartyA: PAYBILL,
    PartyB: normalized,
    Remarks: `Merry-go-round payout cycle ${cycle.cycle_number}`.slice(0, 100),
    QueueTimeOutURL: CALLBACKS.b2cTimeout,
    ResultURL: CALLBACKS.b2cResult,
    Occasion: occasion,
  };
  const res = await fetch(`${MPESA_BASE}/mpesa/b2c/v1/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log("MGR B2C response:", JSON.stringify(data));
  const ok = data.ResponseCode === "0";

  await supabase.from("mpesa_b2c_requests").update({
    conversation_id: data.ConversationID || null,
    request_payload: { response: data, source: "mgr_cron" },
    status: ok ? "processing" : "failed",
    result_code: data.ResponseCode,
    result_desc: data.ResponseDescription,
    last_attempt_at: new Date().toISOString(),
  }).eq("id", b2cRow.id);

  // Mark cycle. NOTE: when Daraja queues the request (ok), payout is still
  // pending — final state (paid_out / payout_failed) is set by the
  // mpesa-b2c-result callback. This prevents marking "paid out" before M-Pesa
  // actually completes the transaction.
  await supabase.from("chama_mgr_cycles").update({
    status: ok ? "payout_pending" : "payout_failed",
    payout_amount: payoutAmount,
    payout_processed_at: new Date().toISOString(),
  }).eq("id", cycle.id);

  // Notifications (queued — final confirmation comes from B2C result)
  if (ok) {
    await supabase.from("notifications").insert({
      user_id: cycle.recipient_id,
      title: "Merry-Go-Round Payout Queued 💰",
      message: `KES ${payoutAmount.toLocaleString()} payout for cycle #${cycle.cycle_number} is being processed by M-Pesa to ${normalized}. You will receive a confirmation SMS shortly.`,
      type: "payment",
    });
    await sendUserSMS(supabase, cycle.recipient_id,
      `Dear {name}, your merry-go-round payout of ${fmt(payoutAmount)} for cycle #${cycle.cycle_number} is being processed to ${normalized}. You will receive M-Pesa confirmation shortly.`);
  }

  // List non-payers (notify chairperson)
  const { data: members } = await supabase
    .from("chama_members").select("user_id, role")
    .eq("group_id", cycle.group_id).eq("is_active", true);
  const nonPayers = (members || []).filter((m: any) => !paidUserIds.has(m.user_id));
  if (nonPayers.length > 0) {
    const { data: profs } = await supabase
      .from("profiles").select("user_id, full_name, phone")
      .in("user_id", nonPayers.map((n: any) => n.user_id));
    const names = (profs || []).map((p: any) => `${p.full_name} (${p.phone})`).join(", ");
    const chair = (members || []).find((m: any) => m.role === "chairperson");
    if (chair) {
      await supabase.from("notifications").insert({
        user_id: chair.user_id,
        title: `Cycle #${cycle.cycle_number} non-payers`,
        message: `${nonPayers.length} member(s) did not pay: ${names}`,
        type: "chama",
      });
      await sendUserSMS(supabase, chair.user_id,
        `Dear {name}, ${nonPayers.length} member(s) missed cycle #${cycle.cycle_number}: ${names.slice(0, 200)}`);
    }
  }

  return {
    ok,
    payout: payoutAmount,
    non_payers: nonPayers.length,
    reason: ok ? undefined : (data.ResponseDescription || data.errorMessage || `Daraja code ${data.ResponseCode}`),
  };
}

async function notifyChairOfFailure(supabase: any, cycle: any, reason: string) {
  try {
    const { data: chair } = await supabase
      .from("chama_members")
      .select("user_id")
      .eq("group_id", cycle.group_id)
      .eq("role", "chairperson")
      .eq("is_active", true)
      .maybeSingle();
    if (!chair?.user_id) return;
    const shortReason = String(reason || "Unknown error").slice(0, 140);
    await supabase.from("notifications").insert({
      user_id: chair.user_id,
      title: `Merry-Go-Round payout FAILED — cycle #${cycle.cycle_number}`,
      message: `Automatic payout to recipient could not be completed. Reason: ${shortReason}. Please check the merry-go-round screen and retry.`,
      type: "alert",
    });
    await sendUserSMS(
      supabase,
      chair.user_id,
      `Dear {name}, the merry-go-round payout for cycle #${cycle.cycle_number} FAILED. Reason: ${shortReason}. Please review and retry on the Dasnet app.`
    );
  } catch (e) {
    console.error("notifyChairOfFailure error:", e);
  }
}
