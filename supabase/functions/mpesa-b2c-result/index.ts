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

    // Detect MGR payouts via the occasion field set in mgr-payout-cron ("MGR cycle #N")
    const isMgrPayout = String(reqRow.occasion || "").toLowerCase().startsWith("mgr cycle");
    const mgrCycleNumber = isMgrPayout ? Number(String(reqRow.occasion).match(/#(\d+)/)?.[1] || 0) : 0;

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

      // MGR payout — promote cycle to paid_out. We intentionally do NOT filter on
      // current cycle status: M-Pesa's callback can race ahead of the cron's
      // `open → payout_pending` flip, so we must accept any non-final status.
      if (isMgrPayout && mgrCycleNumber > 0) {
        await supabase.from("chama_mgr_cycles")
          .update({
            status: "paid_out",
            payout_amount: Math.floor(Number(reqRow.amount || 0)),
            payout_processed_at: new Date().toISOString(),
          })
          .eq("recipient_id", reqRow.user_id)
          .eq("cycle_number", mgrCycleNumber)
          .neq("status", "paid_out");
      }

      await supabase.from("notifications").insert({
        user_id: reqRow.user_id,
        title: "Withdrawal Successful",
        message: `KES ${Number(reqRow.amount).toLocaleString()} sent to ${reqRow.phone}. Receipt: ${receipt}`,
        type: "payment",
      });

      // Sender SMS — confirm payout completed
      const { data: sProf } = await supabase.from("profiles").select("phone, full_name").eq("user_id", reqRow.user_id).maybeSingle();
      const amtStr = `KES ${Math.round(Number(reqRow.amount)).toLocaleString()}`;
      const ref = receipt;
      // "self" withdrawals are detected via the remarks set by the client
      const isSelf = String(reqRow.remarks || "").toLowerCase().includes("withdraw to my");
      const senderName = sProf?.full_name || "A Dasnet user";
      const senderFirst = (sProf?.full_name || "Member").split(" ")[0];

      const fetchSms = async (to: string, message: string) => {
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ phone: to, message }),
          });
        } catch (_) {}
      };

      if (sProf?.phone) {
        await fetchSms(sProf.phone,
          isSelf
            ? `Dear ${senderFirst}, your withdrawal of ${amtStr} to ${reqRow.phone} was successful. M-Pesa receipt: ${ref}. Thank you for banking with DASNET VENTURES.`
            : `Dear ${senderFirst}, you have sent ${amtStr} to ${reqRow.phone}. M-Pesa receipt: ${ref}. Thank you for banking with DASNET VENTURES.`);
      }

      // Recipient SMS — only when sender's registered phone differs from destination (third-party send)
      const norm = (p: string) => {
        const d = String(p || "").replace(/\D/g, "");
        if (d.startsWith("0")) return "254" + d.slice(1);
        if (d.startsWith("7") || d.startsWith("1")) return "254" + d;
        return d;
      };
      if (!isSelf && reqRow.phone && norm(reqRow.phone) !== norm(sProf?.phone || "")) {
        await fetchSms(reqRow.phone,
          `Hello, ${senderName} has sent you ${amtStr} via DASNET VENTURES. M-Pesa receipt: ${ref}.`);
      }
    } else {
      // Daraja failure — refund + notify (NEVER expose internal reasons like "insufficient float")
      await supabase.from("mpesa_b2c_requests").update({
        status: "failed", result_code: resultCode, result_desc: resultDesc, result_payload: body,
      }).eq("id", reqRow.id);

      // MGR payout failed — flip cycle back to payout_failed so chair can retry.
      // Do NOT call refund_b2c_withdrawal: MGR funds were never debited from the
      // recipient's wallet, they came from contributions held by the cycle.
      if (isMgrPayout && mgrCycleNumber > 0) {
        await supabase.from("chama_mgr_cycles")
          .update({ status: "payout_failed" })
          .eq("recipient_id", reqRow.user_id)
          .eq("cycle_number", mgrCycleNumber)
          .eq("status", "payout_pending");

        // Notify chair to retry
        const { data: cyRow } = await supabase.from("chama_mgr_cycles")
          .select("group_id, cycle_number")
          .eq("recipient_id", reqRow.user_id)
          .eq("cycle_number", mgrCycleNumber)
          .maybeSingle();
        if (cyRow?.group_id) {
          const { data: chair } = await supabase.from("chama_members")
            .select("user_id").eq("group_id", cyRow.group_id)
            .eq("role", "chairperson").eq("is_active", true).maybeSingle();
          if (chair?.user_id) {
            await supabase.from("notifications").insert({
              user_id: chair.user_id,
              title: `Merry-Go-Round payout FAILED — cycle #${cyRow.cycle_number}`,
              message: `M-Pesa could not complete the payout. Please retry from the merry-go-round screen.`,
              type: "alert",
            });
          }
        }
      } else {
        // refund_b2c_withdrawal already inserts the in-app notification — don't duplicate.
        if (!reqRow.refunded) {
          await supabase.rpc("refund_b2c_withdrawal", { _request_id: reqRow.id, _reason: resultDesc });
        }
        await sendUserSMS(supabase, reqRow.user_id,
          SMS.walletWithdrawalRefunded("{name}", reqRow.amount));
      }
    }

    return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("B2C result error:", err);
    return new Response(JSON.stringify(ACK), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
