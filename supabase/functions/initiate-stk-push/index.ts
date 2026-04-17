import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// =========================
// SAFE BASE64 (EDGE SAFE)
// =========================
function base64Encode(value: string) {
  return btoa(unescape(encodeURIComponent(value)));
}

// =========================
// FETCH WITH TIMEOUT (CRITICAL)
// =========================
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 20000
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    console.log("📩 RAW REQUEST:", body);

    // =========================
    // INPUTS
    // =========================
    const phone = body.phone;
    const amount = Number(body.amount);
    const purpose = body.purpose || "wallet_deposit";
    const userId = body.userId || null;

    if (!phone || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "phone and valid amount required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // =========================
    // PHONE NORMALIZATION
    // =========================
    let formattedPhone = phone.replace(/\s/g, "").replace(/\+/g, "");

    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith("254")) {
      formattedPhone = "254" + formattedPhone;
    }

    console.log("📱 FORMATTED PHONE:", formattedPhone);

    // =========================
    // ENV VARIABLES
    // =========================
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
    const shortcode = Deno.env.get("MPESA_SHORTCODE")!;
    const passkey = Deno.env.get("MPESA_PASSKEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
      throw new Error("Missing M-Pesa environment variables");
    }

    // =========================
    // ACCESS TOKEN
    // =========================
    const auth = btoa(`${consumerKey}:${consumerSecret}`);

    const tokenRes = await fetchWithTimeout(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const tokenData = await tokenRes.json();

    console.log("🔑 TOKEN RESPONSE:", tokenData);

    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error("Failed to get access token");
    }

    // =========================
    // TIMESTAMP
    // =========================
    const now = new Date();

    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    // =========================
    // PASSWORD (CORRECT FORMAT)
    // =========================
    const password = base64Encode(shortcode + passkey + timestamp);

    const reference = `DEP_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    // =========================
    // STK PAYLOAD (PAYBILL)
    // =========================
    const stkBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,

      TransactionType: "CustomerPayBillOnline",

      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,

      CallBackURL: `${supabaseUrl}/functions/v1/mpesa-callback`,
      AccountReference: reference,
      TransactionDesc: purpose,
    };

    console.log("🚀 STK REQUEST:", stkBody);

    // =========================
    // STK REQUEST (STABLE + TIMEOUT)
    // =========================
    const stkRes = await fetchWithTimeout(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stkBody),
      }
    );

    const stkData = await stkRes.json();

    console.log("🔥 STK RESPONSE:", stkData);

    // =========================
    // HARD FAILURE HANDLING
    // =========================
    if (!stkData || stkData.ResponseCode !== "0") {
      console.error("❌ STK FAILED:", stkData);

      return new Response(
        JSON.stringify({
          success: false,
          error:
            stkData?.errorMessage ||
            stkData?.CustomerMessage ||
            "STK request failed",
          raw: stkData,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // =========================
    // SUPABASE SAVE
    // =========================
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase.from("stk_transactions").insert({
      phone: formattedPhone,
      amount: Math.round(amount),
      reference,
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      status: "pending",
      purpose,
      user_id: userId,
    });

    if (error) {
      console.error("DB ERROR:", error);
      throw new Error(error.message);
    }

    // =========================
    // SUCCESS RESPONSE
    // =========================
    return new Response(
      JSON.stringify({
        success: true,
        message: "STK Push initiated successfully",
        reference,
        checkoutRequestID: stkData.CheckoutRequestID,
      }),
      { headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("🔥 STK SYSTEM ERROR:", err);

    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}); 
