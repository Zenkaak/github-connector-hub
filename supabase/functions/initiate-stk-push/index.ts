import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize phone to 254XXXXXXXXX format
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, amount, userId, purpose, withdrawalRequestId } = await req.json();
    // purpose: "deposit" (default) | "withdrawal_fee"

    if (!phone || !amount || !userId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const shortcode = Deno.env.get("MPESA_SHORTCODE");
    const passkey = Deno.env.get("MPESA_PASSKEY");

    if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
      throw new Error("M-Pesa environment variables not configured");
    }

    const normalizedPhone = normalizePhone(phone);

    // Get OAuth token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenRes = await fetch(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error("Failed to get M-Pesa access token");
    }

    // Generate timestamp and password
    const now = new Date();
    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    const isFee = purpose === "withdrawal_fee";
    const accountRef = isFee ? `WD${(withdrawalRequestId || "").slice(0, 8)}` : "Dasnet";
    const desc = isFee
      ? `Dasnet withdrawal fee KES ${amount}`
      : `Dasnet deposit KES ${amount}`;

    // STK Push - CustomerPayBillOnline (Paybill)
    const stkRes = await fetch(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: Math.ceil(amount),
          PartyA: normalizedPhone,
          PartyB: shortcode,
          PhoneNumber: normalizedPhone,
          CallBackURL: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback`,
          AccountReference: accountRef,
          TransactionDesc: desc,
        }),
      }
    );

    const stkData = await stkRes.json();

    if (stkData.ResponseCode !== "0") {
      throw new Error(stkData.errorMessage || stkData.ResponseDescription || "STK push failed");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (isFee && withdrawalRequestId) {
      // Track fee payment
      await supabase.from("transactions").insert({
        user_id: userId,
        type: "withdrawal_fee",
        amount: Math.ceil(amount),
        status: "pending",
        phone: normalizedPhone,
        description: `Withdrawal completion fee KES ${amount}`,
        checkout_request_id: stkData.CheckoutRequestID,
        metadata: { withdrawal_request_id: withdrawalRequestId },
      });

      await supabase
        .from("withdrawal_requests")
        .update({ fee_checkout_request_id: stkData.CheckoutRequestID })
        .eq("id", withdrawalRequestId);
    } else {
      // Standard deposit
      await supabase.from("transactions").insert({
        user_id: userId,
        type: "deposit",
        amount: Math.ceil(amount),
        status: "pending",
        phone: normalizedPhone,
        description: `M-Pesa deposit of KES ${amount}`,
        checkout_request_id: stkData.CheckoutRequestID,
      });
    }

    return new Response(JSON.stringify({ success: true, data: stkData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("M-Pesa STK error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
