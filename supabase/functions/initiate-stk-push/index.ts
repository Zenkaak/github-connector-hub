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

    const phone = body.phone;
    const amount = body.amount;
    const purpose = body.purpose || body.metadata?.type || "harambee";
    const userId = body.userId || body.metadata?.userId || null;
    const groupId = body.groupId || body.metadata?.group_id || null;
    const savingsId = body.savingsId || null;
    const harambee_id = body.harambee_id || body.harambeeId || body.metadata?.harambee_id || null;
    const loanId = body.loanId || body.loan_id || body.metadata?.loan_id || null;
    const disbursementId = body.disbursementId || body.disbursement_id || null;
    const contributorName = body.contributor_name || body.metadata?.contributor_name || null;

    // Validate phone and amount are present
    if (!phone || amount === undefined || amount === null) {
      console.error("Validation failed - phone:", phone, "amount:", amount);
      return new Response(
        JSON.stringify({ error: "Missing phone or amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For harambee contributions, userId is optional (public contributors allowed)
    const isHarambee = purpose === "harambee" || purpose === "harambee_contribution";
    if (!userId && !isHarambee) {
      console.error("Validation failed - userId required for purpose:", purpose);
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

    let formattedPhone = phone.replace(/\s/g, "").replace(/\+/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith("254")) {
      formattedPhone = "254" + formattedPhone;
    }

    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const shortcode = Deno.env.get("MPESA_SHORTCODE");
    const passkey = Deno.env.get("MPESA_PASSKEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!consumerKey || !consumerSecret || !shortcode || !passkey || !supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing required environment variables");
    }

    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenRes = await fetch(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("Failed to get M-Pesa access token");
    const accessToken = tokenData.access_token;

    const now = new Date();
    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    const prefixMap: Record<string, string> = {
      chama_savings: "CHAMA_",
      personal_savings: "PSAV_",
      loan_repayment: "REPAY_",
      harambee: "HRB_",
      harambee_contribution: "HRB_",
      activation: "ACT_",
      wallet_deposit: "DEP_",
      chama_penalty: "PEN_",
    };
    const prefix = prefixMap[purpose] || "PAY";
    const reference = `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Build purpose-specific AccountReference matching the C2B classifier patterns
    // in supabase/functions/_shared/mpesa.ts → classifyBillRef().
    // This ensures the confirmation callback credits the RIGHT destination (not always wallet).
    //   wallet_deposit / activation → 4-digit code         e.g. "3044"
    //   personal_savings            → {code}S{index}        e.g. "3044S1"
    //   chama_savings / chama_*     → group order_number    e.g. "0000123"
    //   loan_repayment              → {code}L               e.g. "3044L"
    //   harambee (logged-in user)   → {code}H{slug}         e.g. "3044H123"
    //   harambee (public)           → H{slug}               e.g. "H123"
    const tempSb = createClient(supabaseUrl, serviceRoleKey);

    let userCode: string | null = null;
    if (userId) {
      const { data: prof } = await tempSb.from("profiles").select("mpesa_account_code").eq("user_id", userId).maybeSingle();
      userCode = prof?.mpesa_account_code ?? null;
    }

    let accountRef = reference; // fallback
    try {
      if (purpose === "wallet_deposit" || purpose === "activation") {
        if (userCode) accountRef = userCode;
      } else if (purpose === "personal_savings" && savingsId && userId) {
        // Find 1-based index of this savings goal for the user
        const { data: list } = await tempSb
          .from("personal_savings")
          .select("id")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });
        const idx = (list || []).findIndex((r: any) => r.id === savingsId);
        if (userCode && idx >= 0) accountRef = `${userCode}S${idx + 1}`;
      } else if ((purpose === "chama_savings" || purpose === "chama_penalty" || purpose === "chama_joining_fee") && groupId) {
        // Per-user chama letter: 3044A = first chama joined by user 3044
        if (userCode && userId) {
          const { data: mem } = await tempSb.from("chama_members")
            .select("join_order").eq("user_id", userId).eq("group_id", groupId).maybeSingle();
          if (mem?.join_order && mem.join_order >= 1 && mem.join_order <= 26) {
            const letter = String.fromCharCode(64 + mem.join_order);
            accountRef = `${userCode}${letter}`;
          }
        }
        // Fallback to legacy group order_number if letter unavailable
        if (accountRef === reference) {
          const { data: g } = await tempSb.from("chama_groups").select("order_number").eq("id", groupId).maybeSingle();
          if (g?.order_number) accountRef = g.order_number;
        }
      } else if (purpose === "loan_repayment" && userCode) {
        accountRef = `${userCode}L`;
      } else if (isHarambee && harambee_id) {
        // NEW: 4-digit short_code preferred, fallback to legacy order_number slug.
        const { data: h } = await tempSb.from("chama_harambees")
          .select("short_code, order_number").eq("id", harambee_id).maybeSingle();
        if (h?.short_code) {
          accountRef = userCode ? `${userCode}H${h.short_code}` : `H${h.short_code}`;
        } else if (h?.order_number) {
          const slug = h.order_number.replace(/^H/i, "");
          accountRef = userCode ? `${userCode}H${slug}` : `H${slug}`;
        }
      }
    } catch (refErr) {
      console.warn("AccountReference lookup failed, falling back to generated ref:", refErr);
    }

    console.log(`AccountReference for ${purpose}: ${accountRef}`);

    const stkBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(numericAmount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${supabaseUrl}/functions/v1/mpesa-callback`,
      AccountReference: accountRef,
      TransactionDesc: purpose,
    };

    console.log("Sending STK Push for purpose:", purpose, "isHarambee:", isHarambee, "userId:", userId);

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
    console.log("STK Daraja response:", JSON.stringify(stkData));

    if (stkData.ResponseCode !== "0") {
      const errMsg =
        stkData.errorMessage ||
        stkData.CustomerMessage ||
        stkData.ResponseDescription ||
        stkData.ResultDesc ||
        "STK Push failed";
      console.error("STK Push rejected by Daraja:", errMsg, "Full:", JSON.stringify(stkData));
      return new Response(
        JSON.stringify({ success: false, error: errMsg, daraja: stkData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (isHarambee && !harambee_id) {
      throw new Error("harambee_id is required for contributions");
    }

    const insertData: Record<string, any> = {
      phone: formattedPhone,
      amount: Math.round(numericAmount),
      reference,
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      status: "pending",
      purpose: isHarambee ? "harambee" : purpose,
      group_id: groupId,
      harambee_id: harambee_id,
      loan_id: loanId,
      disbursement_id: disbursementId,
      metadata: body.metadata || {},
    };

    // userId is optional for harambee (public contributors)
    if (userId) {
      insertData.user_id = userId;
    }

    // Store contributor name for public harambee contributions
    if (contributorName) {
      insertData.contributor_name = contributorName;
    }

    if (savingsId) {
      insertData.savings_id = savingsId;
    }

    console.log("Inserting stk_transaction:", JSON.stringify(insertData));

    const { error: insertError } = await supabase.from("stk_transactions").insert(insertData);

    if (insertError) {
      console.error("Supabase insert error:", JSON.stringify(insertError));
      throw new Error("Failed to save transaction: " + insertError.message);
    }

    return new Response(
      JSON.stringify({ success: true, reference, message: "STK Push sent successfully." }),
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
 
