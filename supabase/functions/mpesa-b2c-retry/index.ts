// B2C Retry Worker — call every minute via cron.
// Retries pending withdrawals (status = retrying) up to 10 times (10 minutes).
// On 10th failure: refunds wallet + sends SMS.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";
import { corsHeaders, getAccessToken, MPESA_BASE, PAYBILL, CALLBACKS } from "../_shared/mpesa.ts";
import { sendUserSMS, SMS } from "../_shared/sms.ts";

const MAX_RETRIES = 10;
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Find requests due for retry
  const { data: pending } = await admin.from("mpesa_b2c_requests")
    .select("*")
    .eq("status", "retrying")
    .lte("next_retry_at", new Date().toISOString())
    .lt("retry_count", MAX_RETRIES)
    .limit(20);

  const results: any[] = [];
  for (const reqRow of pending || []) {
    try {
      const accessToken = await getAccessToken();
      const initiator = Deno.env.get("MPESA_INITIATOR_NAME")!;
      const securityCred = Deno.env.get("MPESA_SECURITY_CREDENTIAL")!;

      const payload = {
        OriginatorConversationID: reqRow.originator_conversation_id,
        InitiatorName: initiator,
        SecurityCredential: securityCred,
        CommandID: "BusinessPayment",
        Amount: Math.round(reqRow.amount),
        PartyA: PAYBILL,
        PartyB: reqRow.phone,
        Remarks: (reqRow.remarks || "Withdrawal").slice(0, 100),
        QueueTimeOutURL: CALLBACKS.b2cTimeout,
        ResultURL: CALLBACKS.b2cResult,
        Occasion: (reqRow.occasion || "").slice(0, 100),
      };

      const res = await fetch(`${MPESA_BASE}/mpesa/b2c/v1/paymentrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const ok = data.ResponseCode === "0";
      const newCount = (reqRow.retry_count || 0) + 1;

      if (ok) {
        await admin.from("mpesa_b2c_requests").update({
          status: "processing",
          conversation_id: data.ConversationID || null,
          result_code: data.ResponseCode,
          result_desc: data.ResponseDescription,
          last_attempt_at: new Date().toISOString(),
          retry_count: newCount,
          next_retry_at: null,
        }).eq("id", reqRow.id);
        results.push({ id: reqRow.id, status: "submitted" });
      } else if (newCount >= MAX_RETRIES) {
        // Final failure — refund
        await admin.from("mpesa_b2c_requests").update({
          status: "failed",
          result_code: data.ResponseCode,
          result_desc: data.ResponseDescription,
          last_attempt_at: new Date().toISOString(),
          retry_count: newCount,
          next_retry_at: null,
        }).eq("id", reqRow.id);
        if (!reqRow.refunded) {
          await admin.rpc("refund_b2c_withdrawal", {
            _request_id: reqRow.id,
            _reason: data.ResponseDescription || "Maximum retries exceeded",
          });
        }
        await sendUserSMS(admin, reqRow.user_id, SMS.walletWithdrawalFailed("{name}", reqRow.amount, "M-Pesa unavailable"));
        results.push({ id: reqRow.id, status: "failed_refunded" });
      } else {
        // Schedule next retry
        await admin.from("mpesa_b2c_requests").update({
          result_code: data.ResponseCode,
          result_desc: data.ResponseDescription,
          last_attempt_at: new Date().toISOString(),
          retry_count: newCount,
          next_retry_at: new Date(Date.now() + 60_000).toISOString(),
        }).eq("id", reqRow.id);
        results.push({ id: reqRow.id, status: "retry_scheduled", attempt: newCount });
      }
    } catch (err) {
      const newCount = (reqRow.retry_count || 0) + 1;
      if (newCount >= MAX_RETRIES) {
        await admin.from("mpesa_b2c_requests").update({
          status: "failed",
          result_desc: String(err),
          last_attempt_at: new Date().toISOString(),
          retry_count: newCount,
          next_retry_at: null,
        }).eq("id", reqRow.id);
        if (!reqRow.refunded) {
          await admin.rpc("refund_b2c_withdrawal", { _request_id: reqRow.id, _reason: String(err) });
        }
        await sendUserSMS(admin, reqRow.user_id, SMS.walletWithdrawalFailed("{name}", reqRow.amount, "Network error"));
      } else {
        await admin.from("mpesa_b2c_requests").update({
          result_desc: String(err),
          last_attempt_at: new Date().toISOString(),
          retry_count: newCount,
          next_retry_at: new Date(Date.now() + 60_000).toISOString(),
        }).eq("id", reqRow.id);
      }
      results.push({ id: reqRow.id, status: "error", error: String(err) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
