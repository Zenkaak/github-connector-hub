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
    const body = await req.json().catch(() => {
      throw new Error("Invalid JSON body");
    });

    console.log("RAW BODY:", body);

    // Extracting fields while allowing for metadata nesting from the public page
    const phone = body.phone;
    const amount = body.amount;
    const purpose = body.purpose || body.metadata?.type || "harambee";
    
    // userId is now optional for harambee
    const userId = body.userId || body.metadata?.userId || null;
    
    const groupId = body.groupId || body.metadata?.group_id || null;
    const savingsId = body.savingsId || null;
    
    // Normalize Harambee ID from multiple possible naming conventions
    const harambee_id = body.harambee_id || body.harambeeId || body.metadata?.harambee_id || null;
    
    const loanId = body.loanId || body.loan_id || body.metadata?.loan_id || null;
    const disbursementId = body.disbursementId || body.disbursement_id || null;

    // -------------------------
    // ✅ VALIDATION (FIXED FOR PUBLIC USERS)
    // -------------------------
    // Removed !userId from this mandatory check
    if (!phone || amount === undefined || amount === null) {
      return new Response(
        JSON.stringify({ error: "Missing phone or amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Require userId ONLY for non-harambee purposes
    if (!userId && purpose !== "harambee" && purpose !== "harambee_contribution") {
      return new Response(
        JSON.stringify({ error: "User ID is required for this transaction type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!purpose) {
      return new Response(
        JSON.stringify({ error: "Missing purpose" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------
    // ✅ PHONE NORMALIZATION
    // -------------------------
    let formattedPhone = phone.replace(/\s/g, "").replace(/\+/g, "");

    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith("254")) {
      formattedPhone = "254" + formattedPhone;
    }

    // -------------------------
    // ✅ ENV VARIABLES
    // -------------------------
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const shortcode = Deno.env.get("MPESA_SHORTCODE");
    const passkey = Deno.env.get("MPESA_PASSKEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!consumerKey || !consumerSecret || !shortcode || !passkey || !supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing required environment variables");
    }

    const partyB = Deno.env.get("PARTY_B") || shortcode;

    // -------------------------
    // ✅ ACCESS TOKEN
    // -------------------------
    const auth = btoa(`${consumerKey}:${consumerSecret}`);

    const tokenRes = await fetch(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${auth}` } }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Token error:", tokenData);
      throw new Error("Failed to get M-Pesa access token");
    }

    const accessToken = tokenData.access_token;

    // -------------------------
    // ✅ TIMESTAMP + PASSWORD
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

    // -------------------------
    // ✅ REFERENCE PREFIX
    // -------------------------
    const prefixMap: Record<string, string> = {
      chama_savings: "CHAMA_",
      personal_savings: "PSAV_",
      loan_repayment: "REPAY_",
      harambee: "HRB_",
      harambee_contribution: "HRB_",
      activation: "ACT_",
      wallet_deposit: "DEP_",
      chama_joining_fee: "CJFEE_",
    };

    const prefix = prefixMap[purpose] || "PAY";
    const reference = `${prefix}${Date.now()}${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    const callbackUrl = `${supabaseUrl}/functions/v1/mpesa-callback`;

    // -------------------------
    // ✅ STK BODY
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

    console.log("STK Push request:", {
      ...stkBody,
      Password: "[REDACTED]",
    });

    // -------------------------
    // ✅ STK REQUEST
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
    console.log("STK Push response:", stkData);

    if (stkData.ResponseCode !== "0") {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            stkData.errorMessage ||
            stkData.ResponseDescription ||
            "STK Push failed",
          details: stkData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------
    // ✅ SUPABASE
    // -------------------------
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Normalize IDs for the database
    const finalHarambeeId = harambee_id;
    const finalLoanId = loanId;
    const finalDisbursementId = disbursementId;

    if ((purpose === "harambee" || purpose === "harambee_contribution") && !finalHarambeeId) {
      throw new Error("harambee_id is required for harambee payments");
    }

    const { error: insertError } = await supabase.from("stk_transactions").insert({
      user_id: userId, // Will be null for public users
      phone: formattedPhone,
      amount: Math.round(numericAmount),
      reference,
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      status: "pending",
      purpose: purpose === "harambee_contribution" ? "harambee" : purpose,

      group_id: groupId,
      savings_id: savingsId,

      harambee_id: finalHarambeeId,
      loan_id: finalLoanId,
      disbursement_id: finalDisbursementId,
    });

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      throw new Error("Failed to save transaction: " + insertError.message);
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

  } catch (error: any) {
    console.error("STK Push error:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
