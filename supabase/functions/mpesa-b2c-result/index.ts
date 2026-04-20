// B2C Result callback — completion or failure with SMS notifications.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/mpesa.ts";
import { sendUserSMS, SMS } from "../_shared/sms.ts";

const ACK = { ResultCode: 0, ResultDesc: "Accepted" };
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("B2C Result:", JSON.stringify(body));
    const result = body?.Result;
    if (!result) return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const conversationId = result.ConversationID;
    const origConv = result.OriginatorConversationID;
    const resultCode = String(result.ResultCode);
    const resultDesc = result.ResultDesc;

    const { data: reqRow } = await supabase.from("mpesa_b2c_requests")
      .select("*")
      .or(`originator_conversation_id.eq.${origConv},conversation_id.eq.${conversationId}`)
      .maybeSingle();

    if (!reqRow) {
      console.error("B2C request not found for", origConv, conversationId);
      return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (resultCode === "0") {
      const params: any[] = result.ResultParameters?.ResultParameter || [];
      const get = (k: string) => params.find((p) => p.Key === k)?.Value;
      const receipt = get("TransactionReceipt") || "—";

      await supabase.from("mpesa_b2c_requests").update({
        status: "completed",
        result_code: resultCode,
        result_desc: resultDesc,
        mpesa_receipt: receipt,
        transaction_completed_date_time: get("TransactionCompletedDateTime") || null,
        receiver_party_public_name: get("ReceiverPartyPublicName") || null,
        result_payload: body,
      }).eq("id", reqRow.id);

      await supabase.from("notifications").insert({
        user_id: reqRow.user_id,
        title: "Withdrawal Successful",
        message: `KES ${Number(reqRow.amount).toLocaleString()} sent to ${reqRow.phone}. Receipt: ${receipt}`,
        type: "payment",
      });

      await sendUserSMS(supabase, reqRow.user_id,
        SMS.walletWithdrawalSuccess("{name}", reqRow.amount, reqRow.phone, receipt));
    } else {
      // Daraja failure — refund + notify
      await supabase.from("mpesa_b2c_requests").update({
        status: "failed", result_code: resultCode, result_desc: resultDesc, result_payload: body,
      }).eq("id", reqRow.id);

      if (!reqRow.refunded) {
        await supabase.rpc("refund_b2c_withdrawal", { _request_id: reqRow.id, _reason: resultDesc });
      }

      await sendUserSMS(supabase, reqRow.user_id,
        SMS.walletWithdrawalFailed("{name}", reqRow.amount, resultDesc || "M-Pesa rejected"));
    }

    return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("B2C result error:", err);
    return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
