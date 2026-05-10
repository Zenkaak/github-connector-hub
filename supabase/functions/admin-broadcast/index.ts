// Admin broadcast — sends SMS + in-app notification to all users or
// to chairpersons only.
//   target = "all_users" | "chairpersons"
// Personalised salutation:
//   chairpersons => "Dear <FirstName>, <CHAMA NAME>: <message>"
//   all_users    => "Dear <FirstName>, <message>"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";
import { sendSMS } from "../_shared/sms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: any, s = 200) => new Response(JSON.stringify(b), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: u } = await admin.auth.getUser(auth);
    const callerId = u?.user?.id;
    if (!callerId) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const { target, message, channels } = await req.json();
    const msg = String(message || "").trim();
    if (!msg || msg.length < 2) return json({ error: "Message required" }, 400);
    if (target !== "all_users" && target !== "chairpersons") return json({ error: "Invalid target" }, 400);

    const sendSms = channels?.sms !== false;
    const sendNotif = channels?.notification !== false;

    let recipients: { user_id: string; full_name: string | null; phone: string | null; chama_name?: string | null }[] = [];

    if (target === "chairpersons") {
      // active chairpersons across all groups
      const { data: rows } = await admin
        .from("chama_members")
        .select("user_id, group_id, chama_groups!inner(name), profiles!inner(full_name, phone)")
        .eq("role", "chairperson")
        .eq("is_active", true);
      recipients = (rows || []).map((r: any) => ({
        user_id: r.user_id,
        full_name: r.profiles?.full_name || null,
        phone: r.profiles?.phone || null,
        chama_name: r.chama_groups?.name || null,
      }));
    } else {
      const { data: rows } = await admin
        .from("profiles")
        .select("user_id, full_name, phone")
        .eq("is_active", true);
      recipients = rows || [];
    }

    let sentSms = 0, failedSms = 0, sentNotif = 0;
    const notifRows: any[] = [];

    for (const r of recipients) {
      const first = (r.full_name || "Member").split(" ")[0];
      const text = target === "chairpersons"
        ? `Dear ${first}, ${(r.chama_name || "your chama").toUpperCase()}: ${msg}`
        : `Dear ${first}, ${msg}`;

      if (sendSms && r.phone) {
        try {
          const res = await sendSMS(r.phone, text);
          if (res.ok) sentSms++; else failedSms++;
        } catch { failedSms++; }
      }

      if (sendNotif) {
        notifRows.push({
          user_id: r.user_id,
          title: "Message from Admin",
          message: text,
          type: "broadcast",
        });
      }
    }

    if (notifRows.length) {
      // Chunked insert
      for (let i = 0; i < notifRows.length; i += 500) {
        const chunk = notifRows.slice(i, i + 500);
        const { error } = await admin.from("notifications").insert(chunk);
        if (!error) sentNotif += chunk.length;
      }
    }

    await admin.from("audit_logs").insert({
      admin_id: callerId,
      action: "admin_broadcast",
      details: { target, recipients: recipients.length, sentSms, failedSms, sentNotif, message: msg.slice(0, 200) },
    });

    return json({ ok: true, recipients: recipients.length, sentSms, failedSms, sentNotif });
  } catch (e) {
    console.error("[admin-broadcast]", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
