import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { 
      phone, 
      amount, 
      userId, 
      purpose, 
      groupId, 
      savingsId, 
      harambeeId, 
      loanId, 
      disbursementId 
    } = await req.json();

    if (!phone || !amount || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing phone, amount, or userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone to 254... format
    let formattedPhone = phone.replace(/\s/g, "").replace(/\+/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith("254")) {
      formattedPhone = "254" + formattedPhone;
    }

    // Environment Variables
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
    const shortcode = Deno.env.get("MPESA_SHORTCODE")!;
    const passkey = Deno.env.get("MPESA_PASSKEY")!;
    const partyB = Deno.env.get("PARTY_B") || shortcode;

    // 1. Get M-Pesa Access Token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenRes = await fetch(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Token error:", tokenData);
      return new Response(
        JSON.stringify({ error: "Failed to get M-Pesa access token", details: tokenData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenData.access_token;

    // 2. Generate M-Pesa Timestamp & Password
    const now = new Date();
    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // 3. Set Reference Prefix based on transaction purpose
    const prefixMap: Record<string, string> = {
      chama_savings: "CHAMA_",
      personal_savings: "PSAV_",
      loan_repayment: "REPAY_",
      harambee: "HRB_",
      activation: "ACT_",
      wallet_deposit: "DEP_",
      chama_joining_fee: "CJFEE_",
    };
    const prefix = prefixMap[purpose] || "PAY";
    const reference = `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/mpesa-callback`;

    // 4. Prepare M-Pesa STK Push Body
    const stkBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerBuyGoodsOnline",
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: partyB,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: reference,
      TransactionDesc: purpose || "Payment",
    };

    console.log("STK Push request:", JSON.stringify({ ...stkBody, Password: "[REDACTED]" }));

    // 5. Send Request to Safaricom
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
    console.log("STK Push response:", JSON.stringify(stkData));

    if (stkData.ResponseCode !== "0") {
      return new Response(
        JSON.stringify({
          success: false,
          error: stkData.errorMessage || stkData.ResponseDescription || "STK Push failed",
          details: stkData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Initialize Supabase Client
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 7. Save transaction with ALL metadata IDs
    const { error: insertError } = await supabase.from("stk_transactions").insert({
      user_id: userId,
      phone: formattedPhone,
      amount: Math.round(amount),
      reference,
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      status: "pending",
      purpose: purpose || "activation",
      group_id: groupId || null,
      savings_id: savingsId || null,
      harambee_id: harambeeId || null, 
      loan_id: loanId || null,
      disbursement_id: disbursementId || null
    });

    if (insertError) {
      console.error("Supabase insert error:", insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        reference,
        checkoutRequestId: stkData.CheckoutRequestID,
        message: "STK Push sent successfully.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("STK Push error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
 
