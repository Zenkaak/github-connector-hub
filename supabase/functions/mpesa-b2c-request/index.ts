// B2C Withdrawal — authenticated. Deducts wallet immediately, calls Daraja.
// On failure (insufficient float, etc.) we DO NOT refund here — the b2c-result
// or the retry worker handles it. User always sees "processing" UX.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";
import { corsHeaders, getAccessToken, MPESA_BASE, PAYBILL, CALLBACKS } from "../_shared/mpesa.ts";
import { sendUserSMS, SMS } from "../_shared/sms.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Please sign in to continue" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Please sign in to continue" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { amount, phone, remarks = "Withdrawal", occasion = "Wallet withdrawal" } = await req.json();
    if (!amount || amount < 10) {
      return new Response(JSON.stringify({ error: "Minimum withdrawal is KES 10" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone number is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let normalized = String(phone).replace(/\D/g, "");
    if (normalized.startsWith("0")) normalized = "254" + normalized.slice(1);
    if (normalized.startsWith("7") || normalized.startsWith("1")) normalized = "254" + normalized;
    if (!/^254[17]\d{8}$/.test(normalized)) {
      return new Response(JSON.stringify({ error: "Invalid phone number format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Deduct wallet via RPC (also creates b2c request row)
    const { data: requestId, error: rpcErr } = await admin.rpc("create_b2c_withdrawal", {
      _user_id: userId, _amount: amount, _phone: normalized,
      _remarks: remarks, _occasion: occasion,
    });
    if (rpcErr) {
      // Only "Insufficient wallet balance" is a real user error — show it
      const msg = rpcErr.message || "Withdrawal could not be initiated";
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reqRow } = await admin.from("mpesa_b2c_requests")
      .select("originator_conversation_id").eq("id", requestId).single();
    const origConv = reqRow?.originator_conversation_id;

    // NOTE: We intentionally DO NOT send a "processing" SMS here.
    // Only ONE SMS is sent — either success (b2c-result) or failure/refund.

    // Step 2: Try Daraja B2C
    const tryDaraja = async (): Promise<{ ok: boolean; data: any }> => {
      const accessToken = await getAccessToken();
      const initiator = Deno.env.get("MPESA_INITIATOR_NAME");
      const securityCred = Deno.env.get("MPESA_SECURITY_CREDENTIAL");
      if (!initiator || !securityCred) throw new Error("B2C credentials not configured");

      const payload = {
        OriginatorConversationID: origConv,
        InitiatorName: initiator,
        SecurityCredential: securityCred,
        CommandID: "BusinessPayment",
        Amount: Math.round(amount),
        PartyA: PAYBILL,
        PartyB: normalized,
        Remarks: remarks.slice(0, 100),
        QueueTimeOutURL: CALLBACKS.b2cTimeout,
        ResultURL: CALLBACKS.b2cResult,
        Occasion: (occasion || "").slice(0, 100),
      };
      const res = await fetch(`${MPESA_BASE}/mpesa/b2c/v1/paymentrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log("Daraja B2C response:", JSON.stringify(data));
      return { ok: data.ResponseCode === "0", data };
    };

    try {
      const { ok, data } = await tryDaraja();
      const nowIso = new Date().toISOString();
      const nextRetry = new Date(Date.now() + 60_000).toISOString(); // 1 min

      await admin.from("mpesa_b2c_requests").update({
        conversation_id: data.ConversationID || null,
        request_payload: { response: data },
        status: ok ? "processing" : "retrying",
        result_code: data.ResponseCode,
        result_desc: data.ResponseDescription,
        last_attempt_at: nowIso,
        next_retry_at: ok ? null : nextRetry,
        retry_count: ok ? 0 : 1,
      }).eq("id", requestId);

      // Always reply success-shaped to the client — actual outcome arrives via callback/SMS
      return new Response(JSON.stringify({
        success: true,
        request_id: requestId,
        message: "Withdrawal is being processed. You will receive an SMS shortly.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (darajaErr) {
      console.error("Daraja unreachable, scheduling retry:", darajaErr);
      const nextRetry = new Date(Date.now() + 60_000).toISOString();
      await admin.from("mpesa_b2c_requests").update({
        status: "retrying",
        result_desc: String(darajaErr),
        last_attempt_at: new Date().toISOString(),
        next_retry_at: nextRetry,
        retry_count: 1,
      }).eq("id", requestId);

      return new Response(JSON.stringify({
        success: true,
        request_id: requestId,
        message: "Withdrawal is being processed. You will receive an SMS shortly.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    console.error("B2C request error:", err);
    return new Response(JSON.stringify({ error: "Withdrawal could not be initiated. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
