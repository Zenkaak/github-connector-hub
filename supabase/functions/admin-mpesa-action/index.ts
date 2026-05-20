// Admin-initiated M-Pesa actions for the reconcile screen:
//   - "refund": send the unmapped payment back to the original sender via B2C
//   - "send":   admin sends an arbitrary amount to a phone via B2C
//   - "status": update the unmapped-payment status (failed/processing/completed)
// All actions require an authenticated admin (checked via has_role).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";
import { corsHeaders, getAccessToken, MPESA_BASE, PAYBILL, CALLBACKS } from "../_shared/mpesa.ts";

const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

function normalizePhone(p: string) {
  let n = String(p || "").replace(/\D/g, "");
  if (n.startsWith("0")) n = "254" + n.slice(1);
  if (n.startsWith("7") || n.startsWith("1")) n = "254" + n;
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: any, s = 200) => new Response(JSON.stringify(b), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: u } = await admin.auth.getUser(auth);
    const userId = u?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { data: adminProf } = await admin.from("profiles").select("is_admin").eq("user_id", userId).maybeSingle();
    if (!adminProf?.is_admin) {
      const { data: roleCheck } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (!roleCheck) return json({ error: "Forbidden" }, 403);
    }

    const { action, payment_id, amount, phone, remarks, status, notes } = await req.json();

    // STATUS UPDATE
    if (action === "status") {
      if (!payment_id || !status) return json({ error: "payment_id and status required" }, 400);
      const allowed = ["pending", "processing", "completed", "failed"];
      if (!allowed.includes(status)) return json({ error: "Invalid status" }, 400);

      const updates: any = { status };
      if (status === "completed") { updates.resolved = true; updates.resolved_at = new Date().toISOString(); updates.resolved_by = userId; }
      if (notes) updates.resolution_notes = notes;
      const { error } = await admin.from("mpesa_unmapped_payments").update(updates).eq("id", payment_id);
      if (error) return json({ error: error.message }, 400);

      await admin.from("audit_logs").insert({
        admin_id: userId, action: "mpesa_unmapped_status_update",
        details: { payment_id, status, notes },
      });
      return json({ ok: true });
    }

    // REFUND or SEND — both invoke B2C
    if (action !== "refund" && action !== "send") return json({ error: "Unknown action" }, 400);

    let payAmount = Number(amount);
    let dest: string | null = null;
    let actionRemarks = remarks || (action === "refund" ? "Refund unmapped payment" : "Admin payout");

    if (action === "refund") {
      if (!payment_id) return json({ error: "payment_id required" }, 400);
      const { data: p } = await admin.from("mpesa_unmapped_payments").select("*").eq("id", payment_id).maybeSingle();
      if (!p) return json({ error: "Payment not found" }, 404);
      payAmount = Number(p.amount);
      dest = normalizePhone(p.msisdn);
    } else {
      if (!phone) return json({ error: "phone required" }, 400);
      dest = normalizePhone(phone);
    }

    if (!payAmount || payAmount < 10) return json({ error: "Minimum amount is KES 10" }, 400);
    if (!dest || !/^254[17]\d{8}$/.test(dest)) return json({ error: "Invalid phone" }, 400);

    // Insert b2c row
    const { data: b2cRow, error: rowErr } = await admin.from("mpesa_b2c_requests").insert({
      user_id: SYSTEM_USER,
      amount: payAmount,
      phone: dest,
      remarks: actionRemarks,
      occasion: action === "refund" ? "Refund" : "Admin send",
      status: "processing",
      originator_conversation_id: crypto.randomUUID(),
    }).select().single();
    if (rowErr || !b2cRow) return json({ error: rowErr?.message || "Could not create B2C row" }, 400);

    // Call Daraja
    const accessToken = await getAccessToken();
    const initiator = Deno.env.get("MPESA_INITIATOR_NAME")!;
    const securityCred = Deno.env.get("MPESA_SECURITY_CREDENTIAL")!;
    const payload = {
      OriginatorConversationID: b2cRow.originator_conversation_id,
      InitiatorName: initiator,
      SecurityCredential: securityCred,
      CommandID: "BusinessPayment",
      Amount: Math.round(payAmount),
      PartyA: PAYBILL,
      PartyB: dest,
      Remarks: String(actionRemarks).slice(0, 100),
      QueueTimeOutURL: CALLBACKS.b2cTimeout,
      ResultURL: CALLBACKS.b2cResult,
      Occasion: action === "refund" ? "Refund" : "Admin",
    };
    const res = await fetch(`${MPESA_BASE}/mpesa/b2c/v1/paymentrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    const ok = data.ResponseCode === "0";

    await admin.from("mpesa_b2c_requests").update({
      conversation_id: data.ConversationID || null,
      status: ok ? "processing" : "failed",
      result_code: data.ResponseCode,
      result_desc: data.ResponseDescription,
      last_attempt_at: new Date().toISOString(),
    }).eq("id", b2cRow.id);

    if (action === "refund" && ok && payment_id) {
      await admin.from("mpesa_unmapped_payments").update({
        resolved: true, resolved_at: new Date().toISOString(), resolved_by: userId,
        resolution_notes: `Refunded to sender ${dest}`,
        status: "completed",
      }).eq("id", payment_id);
    }

    await admin.from("audit_logs").insert({
      admin_id: userId,
      action: action === "refund" ? "mpesa_admin_refund" : "mpesa_admin_send",
      details: { payment_id, amount: payAmount, phone: dest, daraja: data },
    });

    return json({ ok, request_id: b2cRow.id, daraja: data });
  } catch (e) {
    console.error("[admin-mpesa-action]", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
