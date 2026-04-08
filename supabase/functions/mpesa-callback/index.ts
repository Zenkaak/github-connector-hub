import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    console.log("M-Pesa callback:", JSON.stringify(body, null, 2));

    const callback = body?.Body?.stkCallback;
    if (!callback) {
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc } = callback;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 🔍 Find transaction
    const { data: txn, error: findError } = await supabase
      .from("stk_transactions")
      .select("*")
      .eq("checkout_request_id", CheckoutRequestID)
      .maybeSingle();

    if (findError || !txn) {
      console.error("Transaction not found:", CheckoutRequestID);
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // 🔒 HARD LOCK: Only process pending
    if (txn.status !== "pending") {
      console.log("Already processed:", txn.status);
      return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // ================= SUCCESS =================
    if (ResultCode === 0) {
      const items = callback?.CallbackMetadata?.Item || [];

      const getValue = (name: string) =>
        items.find((i: any) => i.Name === name)?.Value;

      const amount = getValue("Amount") || txn.amount;
      const receipt = getValue("MpesaReceiptNumber") || txn.reference;
      const phone = getValue("PhoneNumber");

      // 🔥 ATOMIC UPDATE (prevents race condition)
      const { data: updatedTx, error: updateError } = await supabase
        .from("stk_transactions")
        .update({
          status: "success",
          result_code: String(ResultCode),
          result_desc: "Success",
          mpesa_receipt: String(receipt),
          updated_at: new Date().toISOString(),
        })
        .eq("checkout_request_id", CheckoutRequestID)
        .eq("status", "pending") // 🔥 CRITICAL LOCK
        .select()
        .maybeSingle();

      if (updateError || !updatedTx) {
        console.error("Update skipped (already processed)");
        return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      console.log("Transaction marked SUCCESS");

      // ================= WALLET CREDIT =================
      if (["wallet_deposit", "activation"].includes(txn.purpose)) {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("id, balance")
          .eq("user_id", txn.user_id)
          .maybeSingle();

        if (wallet) {
          const newBalance = (wallet.balance || 0) + amount;

          await supabase
            .from("wallets")
            .update({ balance: newBalance })
            .eq("id", wallet.id);

          await supabase.from("wallet_transactions").insert({
            wallet_id: wallet.id,
            user_id: txn.user_id,
            type: "deposit",
            amount,
            description: `M-Pesa Deposit: ${receipt}`,
            reference_id: receipt,
            status: "completed",
          });
        }
      }

      // ================= NOTIFICATION =================
      await supabase.from("notifications").insert({
        user_id: txn.user_id,
        title: "Payment Confirmed ✅",
        message: `Payment of KES ${amount} received. Receipt: ${receipt}`,
        type: "payment",
      });

    } else {
      // ================= FAILURE =================

      const { data: failedTx } = await supabase
        .from("stk_transactions")
        .update({
          status: "failed",
          result_code: String(ResultCode),
          result_desc: ResultDesc,
          updated_at: new Date().toISOString(),
        })
        .eq("checkout_request_id", CheckoutRequestID)
        .eq("status", "pending") // 🔥 LOCK
        .select()
        .maybeSingle();

      if (!failedTx) {
        console.log("Failure skipped (already processed)");
        return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
      }

      console.log("Transaction marked FAILED");

      await supabase.from("notifications").insert({
        user_id: txn.user_id,
        title: "Payment Failed ❌",
        message: `KES ${txn.amount} failed: ${ResultDesc}`,
        type: "payment",
      });
    }

    return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });

  } catch (err) {
    console.error("CALLBACK ERROR:", err);
    return jsonResponse({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});
