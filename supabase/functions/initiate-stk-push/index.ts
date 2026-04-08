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

    const {
      phone,
      amount,
      userId,
      purpose,
      groupId,
      savingsId,
      harambee_id,
      loanId,
      disbursementId,
      contributorName,
    } = body;

    if (!phone || !amount || !purpose) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const numericAmount = Number(amount);

    // -------------------------
    // FORMAT PHONE
    // -------------------------
    let formattedPhone = phone.replace(/\s/g, "").replace(/\+/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith("254")) {
      formattedPhone = "254" + formattedPhone;
    }

    // -------------------------
    // ENV
    // -------------------------
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
    const shortcode = Deno.env.get("MPESA_SHORTCODE")!;
    const passkey = Deno.env.get("MPESA_PASSKEY")!;
    const partyB = Deno.env.get("PARTY_B") || shortcode;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // -------------------------
    // REFERENCE
    // -------------------------
    const reference = `${purpose.toUpperCase()}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;

    console.log("REFERENCE:", reference);

    // -------------------------
    // 1. INSERT FIRST (CRITICAL)
    // -------------------------
    const { error: insertError } = await supabase.from("stk_transactions").insert({
      user_id: userId || null,
      phone: formattedPhone,
      amount: numericAmount,
      reference,
      status: "pending",
      purpose,
      group_id: groupId || null,
      savings_id: savingsId || null,
      harambee_id: harambee_id || null,
      loan_id: loanId || null,
      disbursement_id: disbursementId || null,
      contributor_name: contributorName || null,
    });

    if (insertError) {
      console.error("INSERT ERROR:", insertError);
      throw new Error("Failed to create transaction record");
    }

    console.log("DB row created successfully");

    // -------------------------
    // 2. GET ACCESS TOKEN
    // -------------------------
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

    if (!tokenData.access_token) {
      throw new Error("Failed to get access token");
    }

    const accessToken = tokenData.access_token;

    // -------------------------
    // TIMESTAMP + PASSWORD
    // -------------------------
    const now = new Date();
    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    const callbackUrl = `${supabaseUrl}/functions/v1/mpesa-callback`;

    // -------------------------
    // STK REQUEST
    // -------------------------
    const stkBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerBuyGoodsOnline",
      Amount: Math.round(numericAmount),
      PartyA: formattedPhone,
      PartyB: partyB,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: reference,
      TransactionDesc: purpose,
    };

    console.log("Sending STK:", stkBody);

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

    console.log("STK RESPONSE:", stkData);

    if (stkData.ResponseCode !== "0") {
      return new Response(
        JSON.stringify({
          success: false,
          error: stkData.ResponseDescription || stkData.errorMessage,
          reference,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------
    // SUCCESS RESPONSE
    // -------------------------
    return new Response(
      JSON.stringify({
        success: true,
        reference,
        checkoutRequestId: stkData.CheckoutRequestID,
        message: "STK push sent successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("ERROR:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}); 
