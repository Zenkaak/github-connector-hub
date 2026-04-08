import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // -------------------------
  // HANDLE CORS PRE-FLIGHT
  // -------------------------
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // -------------------------
    // PARSE REQUEST BODY
    // -------------------------
    const body = await req.json().catch(() => {
      throw new Error("Invalid JSON body");
    });

    console.log("Incoming request:", body);

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

    // -------------------------
    // VALIDATION
    // -------------------------
    if (!phone || !amount || !purpose) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // -------------------------
    // NORMALIZE PHONE
    // -------------------------
    let formattedPhone = phone.replace(/\s/g, "").replace(/\+/g, "");

    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith("254")) {
      formattedPhone = "254" + formattedPhone;
    }

    // -------------------------
    // LOAD ENV VARIABLES
    // -------------------------
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const shortcode = Deno.env.get("MPESA_SHORTCODE");
    const passkey = Deno.env.get("MPESA_PASSKEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const partyB = Deno.env.get("PARTY_B") || shortcode;

    if (
      !consumerKey ||
      !consumerSecret ||
      !shortcode ||
      !passkey ||
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      throw new Error("Missing environment variables");
    }

    // -------------------------
    // INIT SUPABASE CLIENT
    // -------------------------
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // -------------------------
    // GENERATE UNIQUE REFERENCE
    // -------------------------
    const reference = `${purpose.toUpperCase()}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;

    console.log("Generated reference:", reference);

    // -------------------------
    // INSERT TRANSACTION FIRST
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
      console.error("Insert error:", insertError);
      throw new Error("Failed to insert transaction");
    }

    console.log("Transaction inserted successfully");

    // -------------------------
    // GET ACCESS TOKEN
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
      console.error("Token error:", tokenData);
      throw new Error("Failed to obtain access token");
    }

    const accessToken = tokenData.access_token;

    // -------------------------
    // GENERATE TIMESTAMP
    // -------------------------
    const now = new Date();
    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    // -------------------------
    // GENERATE PASSWORD
    // -------------------------
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // -------------------------
    // CALLBACK URL
    // -------------------------
    const callbackUrl = `${supabaseUrl}/functions/v1/mpesa-callback`;

    // -------------------------
    // STK REQUEST PAYLOAD
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

    console.log("STK request payload:", stkBody);

    // -------------------------
    // SEND STK PUSH
    // -------------------------
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

    console.log("STK response:", stkData);

    if (stkData.ResponseCode !== "0") {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            stkData.errorMessage ||
            stkData.ResponseDescription ||
            "STK push failed",
          details: stkData,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
        merchantRequestId: stkData.MerchantRequestID,
        message: "STK push initiated successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("STK initiate error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}); 
