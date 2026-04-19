// B2C Withdrawal — authenticated. Deducts wallet first, calls Daraja, refunds on failure.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";
import { corsHeaders, getAccessToken, MPESA_BASE, PAYBILL, CALLBACKS } from "../_shared/mpesa.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service-role client + getUser(token) — works with HS256 AND ES256 signing keys
    // (getClaims on older SDKs throws UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM for ES256)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !userData?.user?.id) {
      console.error("Auth failed:", authErr);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
      return new Response(JSON.stringify({ error: "Phone is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize phone to 2547XXXXXXXX
    let normalized = String(phone).replace(/\D/g, "");
    if (normalized.startsWith("0")) normalized = "254" + normalized.slice(1);
    if (normalized.startsWith("7") || normalized.startsWith("1")) normalized = "254" + normalized;
    if (!/^254[17]\d{8}$/.test(normalized)) {
      return new Response(JSON.stringify({ error: "Invalid phone number format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // (admin client already created above for auth)

    // Step 1: Deduct first via RPC (creates b2c request row)
    const { data: requestId, error: rpcErr } = await admin.rpc("create_b2c_withdrawal", {
      _user_id: userId,
      _amount: amount,
      _phone: normalized,
      _remarks: remarks,
      _occasion: occasion,
    });
    if (rpcErr) {
      console.error("RPC error:", rpcErr);
      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the originator_conversation_id we just generated
    const { data: reqRow } = await admin.from("mpesa_b2c_requests")
      .select("originator_conversation_id").eq("id", requestId).single();
    const origConv = reqRow?.originator_conversation_id;

    // Step 2: Call Daraja B2C
    try {
      const accessToken = await getAccessToken();
      const initiator = Deno.env.get("MPESA_INITIATOR_NAME");
      const securityCred = Deno.env.get("MPESA_SECURITY_CREDENTIAL");
      if (!initiator || !securityCred) throw new Error("B2C initiator credentials not configured");

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

      const darajaRes = await fetch(`${MPESA_BASE}/mpesa/b2c/v1/paymentrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const darajaData = await darajaRes.json();
      console.log("Daraja B2C response:", JSON.stringify(darajaData));

      await admin.from("mpesa_b2c_requests")
        .update({
          conversation_id: darajaData.ConversationID || null,
          request_payload: { request: payload, response: darajaData },
          status: darajaData.ResponseCode === "0" ? "processing" : "failed",
          result_code: darajaData.ResponseCode,
          result_desc: darajaData.ResponseDescription,
        })
        .eq("id", requestId);

      if (darajaData.ResponseCode !== "0") {
        // Daraja rejected — refund immediately
        await admin.rpc("refund_b2c_withdrawal", { _request_id: requestId, _reason: darajaData.ResponseDescription || "Daraja rejected" });
        return new Response(JSON.stringify({
          success: false,
          error: darajaData.ResponseDescription || "Withdrawal rejected by M-Pesa",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        success: true,
        request_id: requestId,
        message: "Withdrawal request submitted. You'll receive a confirmation shortly.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (darajaErr) {
      console.error("Daraja call failed, refunding:", darajaErr);
      await admin.rpc("refund_b2c_withdrawal", { _request_id: requestId, _reason: String(darajaErr) });
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to reach M-Pesa. Your wallet has been refunded.",
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    console.error("B2C request error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
