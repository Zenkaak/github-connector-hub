// Notify all active members of a chama when a new merry-go-round cycle is created.
// Sends an SMS containing Paybill, member-specific Account No (<userCode>M<cycle#>),
// amount, deadline, recipient and a link back to the app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSMS, fmt } from "../_shared/sms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYBILL = "4018275";
const APP_URL = Deno.env.get("APP_PUBLIC_URL") || "https://dasnetventures.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { cycle_id } = await req.json();
    if (!cycle_id) {
      return new Response(JSON.stringify({ error: "cycle_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cycle, error: cErr } = await supabase
      .from("chama_mgr_cycles")
      .select("id, cycle_number, group_id, contribution_amount, deadline, payout_date, recipient_name")
      .eq("id", cycle_id)
      .maybeSingle();
    if (cErr || !cycle) throw new Error(cErr?.message || "cycle not found");

    const { data: group } = await supabase
      .from("chama_groups")
      .select("name")
      .eq("id", cycle.group_id)
      .maybeSingle();

    const { data: members } = await supabase
      .from("chama_members")
      .select("user_id")
      .eq("group_id", cycle.group_id)
      .eq("is_active", true);

    const userIds = (members || []).map((m: any) => m.user_id);
    if (!userIds.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone, mpesa_account_code")
      .in("user_id", userIds);

    const deadline = cycle.deadline
      ? new Date(cycle.deadline).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "";
    const amount = fmt(Number(cycle.contribution_amount || 0));
    const groupName = group?.name || "your chama";
    const link = `${APP_URL.replace(/\/$/, "")}/chama`;

    let sent = 0;
    let failed = 0;
    for (const p of profiles || []) {
      if (!p.phone) { failed++; continue; }
      const first = (p.full_name || "Member").split(" ")[0];
      const accountNo = p.mpesa_account_code ? `${p.mpesa_account_code}M${cycle.cycle_number}` : "—";
      const msg =
        `Dear ${first}, a new Merry-Go-Round cycle #${cycle.cycle_number} for ${groupName} has been opened. ` +
        `Recipient: ${cycle.recipient_name}. Amount: ${amount}. Deadline: ${deadline}. ` +
        `Pay via M-Pesa Paybill ${PAYBILL}, Account ${accountNo}. ` +
        `Open ${link} to pay from wallet. — DASNET VENTURES.`;
      const r = await sendSMS(p.phone, msg);
      if (r.ok) sent++; else failed++;
    }

    return new Response(JSON.stringify({ ok: true, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[notify-mgr-cycle]", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
