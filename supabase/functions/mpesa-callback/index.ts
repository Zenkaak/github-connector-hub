import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  // M-Pesa callbacks are POST only, no CORS needed (server-to-server)
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    console.log("M-Pesa callback received:", JSON.stringify(body));

    const callback = body?.Body?.stkCallback;
    if (!callback) {
      console.error("Invalid callback body");
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
    } = callback;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the transaction
    const { data: txn, error: findError } = await supabase
      .from("stk_transactions")
      .select("*")
      .eq("checkout_request_id", CheckoutRequestID)
      .single();

    if (findError || !txn) {
      console.error("Transaction not found for CheckoutRequestID:", CheckoutRequestID);
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (ResultCode === 0) {
      // Payment successful - extract receipt
      let mpesaReceipt = "";
      const metadata = callback.CallbackMetadata?.Item || [];
      for (const item of metadata) {
        if (item.Name === "MpesaReceiptNumber") {
          mpesaReceipt = item.Value;
        }
      }

      await supabase
        .from("stk_transactions")
        .update({
          status: "success",
          result_code: String(ResultCode),
          result_desc: ResultDesc,
          mpesa_receipt: mpesaReceipt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", txn.id);

      console.log("Payment successful:", mpesaReceipt);
    } else {
      // Payment failed
      await supabase
        .from("stk_transactions")
        .update({
          status: "failed",
          result_code: String(ResultCode),
          result_desc: ResultDesc,
          updated_at: new Date().toISOString(),
        })
        .eq("id", txn.id);

      console.log("Payment failed:", ResultDesc);
    }

    // Always respond with success to M-Pesa
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Callback processing error:", error);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
});
