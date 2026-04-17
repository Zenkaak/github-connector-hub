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

    console.log("📩 RAW REQUEST:", body);

    // =====================================================
    // COMMON INPUTS
    // =====================================================
    const mode = body.mode || "stk"; // stk | b2c

    const phone = body.phone;
    const amount = Number(body.amount);

    const purpose = body.purpose || "wallet_deposit";
    const userId = body.userId || null;

    const groupId = body.groupId || null;
    const savingsId = body.savingsId || null;
    const harambeeId =
      body.harambee_id || body.harambeeId || null;
    const loanId = body.loanId || null;
    const disbursementId = body.disbursementId || null;

    const contributorName = body.contributor_name || null;
    const reason = body.reason || "transaction";

    // =====================================================
    // VALIDATION
    // =====================================================
    if (!phone || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Phone and valid amount required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const isHarambee =
      purpose === "harambee" || purpose === "harambee_contribution";

    if (!userId && !isHarambee) {
      return new Response(
        JSON.stringify({ error: "userId required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // =====================================================
    // PHONE NORMALIZATION
    // =====================================================
    let formattedPhone = phone.replace(/\s/g, "").replace(/\+/g, "");

    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith("254")) {
      formattedPhone = "254" + formattedPhone;
    }

    console.log("📱 FORMATTED PHONE:", formattedPhone);

    // =====================================================
    // ENV VARIABLES
    // =====================================================
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const shortcode = Deno.env.get("MPESA_SHORTCODE");
    const passkey = Deno.env.get("MPESA_PASSKEY");
    const initiatorName = Deno.env.get("MPESA_INITIATOR_NAME");
    const securityCredential = Deno.env.get("MPESA_SECURITY_CREDENTIAL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (
      !consumerKey ||
      !consumerSecret ||
      !shortcode ||
      !passkey ||
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      throw new Error("Missing required environment variables");
    }

    // =====================================================
    // ACCESS TOKEN
    // =====================================================
    const auth = btoa(`${consumerKey}:${consumerSecret}`);

    const tokenRes = await fetch(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: { Authorization: `Basic ${auth}` },
      }
    );

    const tokenData = await tokenRes.json();

    console.log("🔑 TOKEN:", tokenData);

    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error("Failed to get access token");
    }

    // =====================================================
    // TIMESTAMP + PASSWORD (STK ONLY)
    // =====================================================
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
    // 🔥 STK PUSH (DEPOSIT)
    // =====================================================
    if (mode === "stk") {
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

      if (stkData.ResponseCode !== "0") {
        return new Response(
          JSON.stringify({
            success: false,
            error: stkData.CustomerMessage || "STK failed",
            raw: stkData,
          }),
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
        purpose,
        user_id: userId,
        group_id: groupId,
        savings_id: savingsId,
        harambee_id: harambeeId,
        loan_id: loanId,
        disbursement_id: disbursementId,
        contributor_name: contributorName,
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
    // 🔥 B2C (WITHDRAWALS)
    // =====================================================
    if (mode === "b2c") {
      const payload = {
        InitiatorName: initiatorName,
        SecurityCredential: securityCredential,

        CommandID: "BusinessPayment",

        Amount: Math.round(amount),
        PartyA: shortcode,
        PartyB: formattedPhone,

        Remarks: reason,
        QueueTimeOutURL: `${supabaseUrl}/functions/v1/b2c-timeout`,
        ResultURL: `${supabaseUrl}/functions/v1/b2c-result`,

        Occasion: reason,
      };

      console.log("🚀 B2C REQUEST:", payload);

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

      console.log("🔥 B2C RESPONSE:", b2cData);

      await supabase.from("b2c_transactions").insert({
        phone: formattedPhone,
        amount: Math.round(amount),
        reference,
        status: "pending",
        purpose,
        response: b2cData,
        user_id: userId,
      });

      return new Response(
        JSON.stringify({
          success: true,
          mode: "b2c",
          reference,
          message: "B2C request initiated",
        }),
        { headers: corsHeaders }
      );
    }

    // =====================================================
    // INVALID MODE
    // =====================================================
    return new Response(
      JSON.stringify({ error: "Invalid mode (use stk or b2c)" }),
      { status: 400, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error("🔥 SYSTEM ERROR:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
