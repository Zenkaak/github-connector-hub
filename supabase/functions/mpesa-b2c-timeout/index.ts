// B2C Timeout — refund the user
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/mpesa.ts";

const ACK = { ResultCode: 0, ResultDesc: "Accepted" };
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("B2C Timeout:", JSON.stringify(body));

    const conversationId = body?.Result?.ConversationID || body?.ConversationID;
    const origConv = body?.Result?.OriginatorConversationID || body?.OriginatorConversationID;

    const { data: reqRow } = await supabase.from("mpesa_b2c_requests")
      .select("*")
      .or(`originator_conversation_id.eq.${origConv},conversation_id.eq.${conversationId}`)
      .maybeSingle();

    if (reqRow && !reqRow.refunded) {
      await supabase.from("mpesa_b2c_requests")
        .update({ status: "timeout", result_payload: body })
        .eq("id", reqRow.id);

      const isMgrPayout = String(reqRow.occasion || "").toLowerCase().startsWith("mgr cycle");
      const mgrCycleNumber = isMgrPayout ? Number(String(reqRow.occasion).match(/#(\d+)/)?.[1] || 0) : 0;

      if (isMgrPayout && mgrCycleNumber > 0) {
        // MGR payout timed out — flip cycle to payout_failed so chair can retry.
        await supabase.from("chama_mgr_cycles")
          .update({ status: "payout_failed" })
          .eq("recipient_id", reqRow.user_id)
          .eq("cycle_number", mgrCycleNumber)
          .eq("status", "payout_pending");
      } else {
        await supabase.rpc("refund_b2c_withdrawal", { _request_id: reqRow.id, _reason: "M-Pesa timeout" });
      }
    }

    return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Timeout handler error:", err);
    return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
