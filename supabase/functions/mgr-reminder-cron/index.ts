// MGR contribution reminder cron.
// Runs hourly. For every OPEN cycle whose deadline is exactly 3 days away,
// 1 day away, or today (within the current hour bucket), SMS each member
// who hasn't paid yet. Message contains: penalty, deadline, paybill, account.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendSMS, fmt } from "../_shared/sms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYBILL = "4018275";
const APP_URL = (Deno.env.get("APP_PUBLIC_URL") || "https://dasnett.site").replace(/\/$/, "");

function bucketLabel(hoursToDeadline: number): string | null {
  // We want exactly 3 reminders per cycle:
  //   - ~72h before deadline (3 days)
  //   - ~24h before deadline (1 day)
  //   - ~0-12h before deadline (deadline day)
  if (hoursToDeadline > 71 && hoursToDeadline <= 73) return "T-3 days";
  if (hoursToDeadline > 23 && hoursToDeadline <= 25) return "T-1 day";
  if (hoursToDeadline > -1 && hoursToDeadline <= 12) return "Deadline day";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Optional: { test: true, phone: "0719..." } -> send a one-off sample
  let body: any = {};
  try { body = await req.clone().json(); } catch { /* ignore */ }

  if (body?.test && body?.phone) {
    const sample =
      `Dear MEMBER, Merry-Go-Round contribution for SAMPLE CHAMA is due Sun, 17 May 2026. ` +
      `Pay KES 500 via M-Pesa Paybill ${PAYBILL}, Acc D101A3 (your unique code). ` +
      `Late penalty: KES 50. Pay in-app: ${APP_URL}`;
    const r = await sendSMS(body.phone, sample);
    return new Response(JSON.stringify(r), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const { data: cycles } = await supabase
    .from("chama_mgr_cycles")
    .select("id, cycle_number, group_id, contribution_amount, deadline, recipient_name, penalty_amount")
    .eq("status", "open")
    .gte("deadline", new Date(now.getTime() - 13 * 60 * 60 * 1000).toISOString())
    .lte("deadline", new Date(now.getTime() + 80 * 60 * 60 * 1000).toISOString());

  let sent = 0, skipped = 0, failed = 0;
  const log: any[] = [];

  for (const cy of cycles || []) {
    const hoursToDeadline = (new Date(cy.deadline).getTime() - now.getTime()) / 3.6e6;
    const label = bucketLabel(hoursToDeadline);
    if (!label) { skipped++; continue; }

    const { data: group } = await supabase
      .from("chama_groups").select("name").eq("id", cy.group_id).maybeSingle();

    const { data: members } = await supabase
      .from("chama_members").select("user_id")
      .eq("group_id", cy.group_id).eq("is_active", true);
    const memberIds = (members || []).map((m: any) => m.user_id);
    if (!memberIds.length) continue;

    const { data: paid } = await supabase
      .from("chama_mgr_contributions").select("user_id").eq("cycle_id", cy.id);
    const paidIds = new Set((paid || []).map((p: any) => p.user_id));
    const unpaidIds = memberIds.filter(id => !paidIds.has(id));
    if (!unpaidIds.length) { skipped++; continue; }

    const { data: profiles } = await supabase
      .from("profiles").select("user_id, full_name, phone, mpesa_account_code")
      .in("user_id", unpaidIds);

    const deadlineFmt = new Date(cy.deadline).toLocaleString("en-GB", {
      weekday: "short", day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    const amount = fmt(Number(cy.contribution_amount || 0));
    const penalty = Number(cy.penalty_amount || 0);
    const penaltyTxt = penalty > 0 ? ` Late penalty: KES ${penalty.toLocaleString()}.` : "";
    const groupName = (group?.name || "your chama").toUpperCase();

    for (const p of profiles || []) {
      if (!p.phone) { failed++; continue; }
      // Compute per-user account number (same scheme as notify-mgr-cycle)
      const { data: mine } = await supabase
        .from("chama_members").select("group_id, created_at")
        .eq("user_id", p.user_id).eq("is_active", true)
        .order("created_at", { ascending: true });
      const idx = (mine || []).findIndex((m: any) => m.group_id === cy.group_id);
      const letter = idx >= 0 && idx < 26 ? String.fromCharCode(65 + idx) : "";
      const acc = p.mpesa_account_code && letter
        ? `${p.mpesa_account_code}${letter}${cy.cycle_number}`
        : "—";
      const first = ((p.full_name || "Member").split(" ")[0] || "Member").toUpperCase();

      const msg =
        `Dear ${first}, REMINDER: Merry-Go-Round #${cy.cycle_number} for ${groupName} ` +
        `closes ${deadlineFmt}. Pay KES ${amount} via M-Pesa Paybill ${PAYBILL}, Acc ${acc}.` +
        `${penaltyTxt} Or pay in-app: ${APP_URL}`;
      const r = await sendSMS(p.phone, msg);
      if (r.ok) sent++; else failed++;
      log.push({ user: p.user_id, label, ok: r.ok });
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, skipped, failed, log }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
