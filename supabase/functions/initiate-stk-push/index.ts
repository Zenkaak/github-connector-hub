import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const mode = body.mode || "stk"; // 🔥 "stk" or "b2c"

    // =========================
    // COMMON INPUTS
    // =========================
    const phone = body.phone;
    const amount = Number(body.amount);

    if (!phone || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid phone or amount" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Normalize phone
    let formattedPhone = phone.replace(/\s/g, "").replace(/\+/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith("254")) {
      formattedPhone = "254" + formattedPhone;
    }

    // =========================
    // ENV
    // =========================
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
    const shortcode = Deno.env.get("MPESA_SHORTCODE")!;
    const passkey = Deno.env.get("MPESA_PASSKEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const initiatorName = Deno.env.get("MPESA_INITIATOR_NAME")!;
    const securityCredential = Deno.env.get("MPESA_SECURITY_CREDENTIAL")!;

    // =========================
    // ACCESS TOKEN
    // =========================
    const auth = btoa(`${consumerKey}:${consumerSecret}`);

    const tokenRes = await fetch(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${auth}` } }
    );

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) throw new Error("Failed to get access token");

    // =========================
    // TIMESTAMP + PASSWORD
    // =========================
    const now = new Date();

    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    const reference =
      `${mode.toUpperCase()}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // =====================================================
    // 🔥 STK PUSH (DEPOSIT / WALLET / HARAMBEE)
    // =====================================================
    if (mode === "stk") {
      const stkBody = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,

        TransactionType: "CustomerPayBillOnline", // 🔥 IMPORTANT

        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: shortcode,
        PhoneNumber: formattedPhone,

        CallBackURL: `${supabaseUrl}/functions/v1/mpesa-callback`,
        AccountReference: reference,
        TransactionDesc: body.purpose || "wallet_deposit",
      };

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

      if (stkData.ResponseCode !== "0") {
        return new Response(
          JSON.stringify({ success: false, error: stkData.CustomerMessage }),
          { status: 400, headers: corsHeaders }
        );
      }

      await supabase.from("stk_transactions").insert({
        phone: formattedPhone,
        amount: Math.round(amount),
        reference,
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        status: "pending",
        type: "stk",
      });

      return new Response(
        JSON.stringify({
          success: true,
          mode: "stk",
          reference,
          message: "STK Push initiated",
        }),
        { headers: corsHeaders }
      );
    }

    // =====================================================
    // 🔥 B2C (WITHDRAWAL / PAY USERS)
    // =====================================================
    if (mode === "b2c") {
      const payload = {
        InitiatorName: initiatorName,
        SecurityCredential: securityCredential,

        CommandID: "BusinessPayment", // 🔥 IMPORTANT

        Amount: Math.round(amount),
        PartyA: shortcode,
        PartyB: formattedPhone,

        Remarks: body.reason || "wallet_withdrawal",
        QueueTimeOutURL: `${supabaseUrl}/functions/v1/b2c-timeout`,
        ResultURL: `${supabaseUrl}/functions/v1/b2c-result`,

        Occasion: body.reason || "withdrawal",
      };

      const b2cRes = await fetch(
        "https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const b2cData = await b2cRes.json();

      await supabase.from("b2c_transactions").insert({
        phone: formattedPhone,
        amount: Math.round(amount),
        reference,
        status: "pending",
        type: "b2c",
        response: b2cData,
      });

      return new Response(
        JSON.stringify({
          success: true,
          mode: "b2c",
          reference,
          message: "B2C request sent",
        }),
        { headers: corsHeaders }
      );
    }

    // =========================
    // INVALID MODE
    // =========================
    return new Response(
      JSON.stringify({ error: "Invalid mode. Use stk or b2c" }),
      { status: 400, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error("🔥 ERROR:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}); 
