import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
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

    const { CheckoutRequestID, ResultCode, ResultDesc } = callback;

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

      console.log("Payment successful:", mpesaReceipt, "Purpose:", txn.purpose);

      // Auto-record based on purpose
      const purpose = txn.purpose || "activation";

      if (purpose === "chama_savings" && txn.group_id) {
        await supabase.from("chama_savings").insert({
          group_id: txn.group_id,
          user_id: txn.user_id,
          amount: txn.amount,
          stk_reference: txn.reference,
        });
        console.log("Chama savings recorded for group:", txn.group_id);
      }

      if (purpose === "personal_savings" && txn.savings_id) {
        // Insert deposit record
        await supabase.from("personal_savings_deposits").insert({
          savings_id: txn.savings_id,
          user_id: txn.user_id,
          amount: txn.amount,
          stk_reference: txn.reference,
        });
        // Update saved_amount
        const { data: savings } = await supabase
          .from("personal_savings")
          .select("saved_amount")
          .eq("id", txn.savings_id)
          .single();
        if (savings) {
          await supabase
            .from("personal_savings")
            .update({ saved_amount: (savings.saved_amount || 0) + txn.amount })
            .eq("id", txn.savings_id);
        }
        console.log("Personal savings deposit recorded:", txn.savings_id);
      }

      if (purpose === "harambee" && txn.group_id) {
        // group_id used as harambee_id for harambee contributions
        await supabase.from("chama_harambee_contributions").insert({
          harambee_id: txn.group_id,
          user_id: txn.user_id,
          amount: txn.amount,
          stk_reference: txn.reference,
        });
        // Update raised_amount
        const { data: harambee } = await supabase
          .from("chama_harambees")
          .select("raised_amount")
          .eq("id", txn.group_id)
          .single();
        if (harambee) {
          await supabase
            .from("chama_harambees")
            .update({ raised_amount: (harambee.raised_amount || 0) + txn.amount })
            .eq("id", txn.group_id);
        }
        console.log("Harambee contribution recorded");
      }

      if (purpose === "activation") {
        // Credit wallet with deposit amount
        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", txn.user_id)
          .single();
        if (wallet) {
          await supabase
            .from("wallets")
            .update({ balance: (wallet.balance || 0) + txn.amount })
            .eq("user_id", txn.user_id);
        }
        await supabase.from("wallet_transactions").insert({
          user_id: txn.user_id,
          type: "deposit",
          amount: txn.amount,
          description: `M-Pesa deposit via ${mpesaReceipt}`,
          reference_id: txn.reference,
        });
        console.log("Wallet credited:", txn.amount);
      }

      // Send notification
      await supabase.from("notifications").insert({
        user_id: txn.user_id,
        title: "Payment Confirmed ✅",
        message: `Your M-Pesa payment of KES ${txn.amount} was successful. Receipt: ${mpesaReceipt}`,
        type: "payment",
      });

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

      await supabase.from("notifications").insert({
        user_id: txn.user_id,
        title: "Payment Failed ❌",
        message: `Your M-Pesa payment of KES ${txn.amount} was not completed. ${ResultDesc}`,
        type: "payment",
      });

      console.log("Payment failed:", ResultDesc);
    }

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
