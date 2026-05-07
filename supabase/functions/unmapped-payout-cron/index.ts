// Auto-payout cron: forwards queued unmapped M-Pesa payments to admin's
// personal M-Pesa via B2C. Runs every minute. Only sends when amount >= 10.
// Items <10 stay queued indefinitely until they can be combined or topped up
// (we send each row independently; rows under 10 wait — they'll never be sent
// alone because Daraja rejects <10. The user asked us to queue and trigger
// when KES 10+, which matches: anything <10 simply waits in the queue.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";
import { corsHeaders, getAccessToken, MPESA_BASE, PAYBILL, CALLBACKS } from "../_shared/mpesa.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { data: queued } = await admin
    .from("mpesa_admin_payout_queue")
    .select("*")
    .eq("status", "queued")
    .gte("amount", 10)
    .order("created_at", { ascending: true })
    .limit(10);

  const results: any[] = [];
  for (const row of queued || []) {
    try {
      // Mark in-progress
      await admin.from("mpesa_admin_payout_queue")
        .update({ status: "submitted", attempts: (row.attempts || 0) + 1, last_attempt_at: new Date().toISOString() })
        .eq("id", row.id);

      // Create b2c request row (no user, system payout)
      const { data: b2cReq, error: b2cErr } = await admin.from("mpesa_b2c_requests").insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        amount: row.amount,
        phone: row.destination_phone,
        remarks: 'Unmapped payment forward to admin',
        occasion: 'Auto-forward',
        status: 'processing',
        originator_conversation_id: crypto.randomUUID(),
      }).select().single();

      if (b2cErr || !b2cReq) {
        await admin.from("mpesa_admin_payout_queue").update({
          status: 'queued', last_error: b2cErr?.message || 'b2c row insert failed',
        }).eq("id", row.id);
        results.push({ id: row.id, status: 'b2c_row_failed', error: b2cErr?.message });
        continue;
      }

      const accessToken = await getAccessToken();
      const initiator = Deno.env.get("MPESA_INITIATOR_NAME")!;
      const securityCred = Deno.env.get("MPESA_SECURITY_CREDENTIAL")!;

      const payload = {
        OriginatorConversationID: b2cReq.originator_conversation_id,
        InitiatorName: initiator,
        SecurityCredential: securityCred,
        CommandID: "BusinessPayment",
        Amount: Math.round(row.amount),
        PartyA: PAYBILL,
        PartyB: row.destination_phone,
        Remarks: 'Forward unmapped',
        QueueTimeOutURL: CALLBACKS.b2cTimeout,
        ResultURL: CALLBACKS.b2cResult,
        Occasion: 'Auto-forward',
      };
      const res = await fetch(`${MPESA_BASE}/mpesa/b2c/v1/paymentrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const ok = data.ResponseCode === "0";

      if (ok) {
        await admin.from("mpesa_b2c_requests").update({
          conversation_id: data.ConversationID || null,
          result_code: data.ResponseCode,
          result_desc: data.ResponseDescription,
          last_attempt_at: new Date().toISOString(),
        }).eq("id", b2cReq.id);
        await admin.from("mpesa_admin_payout_queue").update({
          status: 'paid', b2c_request_id: b2cReq.id, last_error: null,
        }).eq("id", row.id);
        results.push({ id: row.id, status: 'submitted' });
      } else {
        // Re-queue (insufficient float, etc.) so it retries next minute
        await admin.from("mpesa_b2c_requests").update({
          status: 'failed',
          result_code: data.ResponseCode,
          result_desc: data.ResponseDescription,
        }).eq("id", b2cReq.id);
        await admin.from("mpesa_admin_payout_queue").update({
          status: 'queued', last_error: data.ResponseDescription || 'Daraja rejected', b2c_request_id: b2cReq.id,
        }).eq("id", row.id);
        results.push({ id: row.id, status: 'requeued', error: data.ResponseDescription });
      }
    } catch (err) {
      await admin.from("mpesa_admin_payout_queue").update({
        status: 'queued', last_error: String(err),
      }).eq("id", row.id);
      results.push({ id: row.id, status: 'error', error: String(err) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
