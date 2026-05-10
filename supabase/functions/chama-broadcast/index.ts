// Chairperson broadcast — sends an SMS to all active members of a chama.
// Format: "Hello <FirstName>, <ChamaName>: <message>"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendSMS } from "../_shared/sms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: u } = await admin.auth.getUser(auth);
    const callerId = u?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { group_id, message } = await req.json();
    if (!group_id || !message || String(message).trim().length < 2) {
      return new Response(JSON.stringify({ error: "group_id and message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is chairperson of this group
    const { data: chairRow } = await admin.from("chama_members")
      .select("role").eq("group_id", group_id).eq("user_id", callerId)
      .eq("is_active", true).maybeSingle();
    if (chairRow?.role !== "chairperson") {
      return new Response(JSON.stringify({ error: "Only the chairperson can broadcast" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: group } = await admin.from("chama_groups")
      .select("name").eq("id", group_id).maybeSingle();
    const groupName = (group?.name || "your chama").toUpperCase();

    const { data: members } = await admin.from("chama_members")
      .select("user_id").eq("group_id", group_id).eq("is_active", true);
    const userIds = (members || []).map((m: any) => m.user_id);
    if (!userIds.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles } = await admin.from("profiles")
      .select("user_id, full_name, phone").in("user_id", userIds);

    const trimmed = String(message).trim();
    let sent = 0, failed = 0;
    for (const p of profiles || []) {
      if (!p.phone) { failed++; continue; }
      const first = (p.full_name || "Member").split(" ")[0];
      const msg = `Hello ${first}, ${groupName}: ${trimmed}`;
      const r = await sendSMS(p.phone, msg);
      if (r.ok) sent++; else failed++;
    }

    return new Response(JSON.stringify({ ok: true, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[chama-broadcast]", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
