import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function toBase64(value: string) {
  // 🔥 SAFE cross-runtime base64 (matches production systems)
  return btoa(unescape(encodeURIComponent(value)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("📩 REQUEST:", body);

    const phone = body.phone;
    const amount = Number(body.amount);
    const purpose = body.purpose || "wallet_deposit";
    const userId = body.userId || null;

    if (!phone || !amount) {
      return new Response(
        JSON.stringify({ error: "phone and amount required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // =========================
    // FORMAT PHONE
    // =========================
    let formattedPhone = phone.replace(/\s/g, "").replace(/\+/g, "");

    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.slice(1);
    }

    console.log("📱 PHONE:", formattedPhone);

    // =========================
    // ENV
    // =========================
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
    const shortcode = Deno.env.get("MPESA_SHORTCODE")!;
    const passkey = Deno.env.get("MPESA_PASSKEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // =========================
    // ACCESS TOKEN
    // =========================
    const auth = btoa(`${consumerKey}:${consumerSecret}`);

    const tokenRes = await fetch(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    console.log("🔑 TOKEN:", tokenData);

    if (!accessToken) {
      throw new Error("Token generation failed");
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
    // 🔥 MATCHED PASSWORD FORMAT
    // =========================
    const password = toBase64(shortcode + passkey + timestamp);

    const reference = `DEP_${Date.now()}`;

    // =========================
    // STK PAYLOAD (MATCHED EXACT)
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

    console.log("🚀 STK BODY:", stkBody);

    // =========================
    // REQUEST
    // =========================
    const stkRes = await fetch(
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
    console.log("📡 STATUS:", stkRes.status);

    // =========================
    // FAIL CHECK
    // =========================
    if (!stkData || stkData.ResponseCode !== "0") {
      return new Response(
        JSON.stringify({
          success: false,
          error: stkData?.errorMessage || stkData?.CustomerMessage,
          raw: stkData,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // =========================
    // SUPABASE SAVE
    // =========================
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    await supabase.from("stk_transactions").insert({
      phone: formattedPhone,
      amount: Math.round(amount),
      reference,
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      status: "pending",
      purpose,
      user_id: userId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        reference,
        checkoutRequestID: stkData.CheckoutRequestID,
      }),
      { headers: corsHeaders }
    );

  } catch (err: any) {
    console.error("🔥 ERROR:", err);

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}); 
