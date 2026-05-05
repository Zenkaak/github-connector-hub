import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Restrict to service-role-only invocations (cron)
    const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (auth !== supabaseKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const currentMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-04"

    // Get the configurable fee amount
    const { data: setting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "chama_emergency_fee")
      .single();
    const feeAmount = Number(setting?.value) || 50;

    // Get all active chama groups
    const { data: groups } = await supabase
      .from("chama_groups")
      .select("id, name");

    if (!groups || groups.length === 0) {
      return new Response(
        JSON.stringify({ message: "No groups found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalCharged = 0;
    let totalSkipped = 0;

    for (const group of groups) {
      // Get active members of this group
      const { data: members } = await supabase
        .from("chama_members")
        .select("user_id")
        .eq("group_id", group.id)
        .eq("is_active", true);

      if (!members || members.length === 0) continue;

      // Ensure emergency fund record exists
      await supabase
        .from("chama_emergency_fund")
        .upsert({ group_id: group.id, balance: 0 }, { onConflict: "group_id", ignoreDuplicates: true });

      for (const member of members) {
        // Check if already charged this month
        const { data: existing } = await supabase
          .from("chama_emergency_contributions")
          .select("id")
          .eq("group_id", group.id)
          .eq("user_id", member.user_id)
          .eq("month", currentMonth)
          .maybeSingle();

        if (existing) {
          totalSkipped++;
          continue;
        }

        // Create a pending contribution record
        await supabase.from("chama_emergency_contributions").insert({
          group_id: group.id,
          user_id: member.user_id,
          amount: feeAmount,
          month: currentMonth,
          status: "pending",
        });

        // Notify the member
        await supabase.from("notifications").insert({
          user_id: member.user_id,
          title: "Emergency Fund Due",
          message: `Your monthly emergency fund contribution of KES ${feeAmount} for ${group.name} is due. It will be deducted from your next chama deposit.`,
          type: "chama_emergency",
        });

        totalCharged++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        month: currentMonth,
        fee: feeAmount,
        records_created: totalCharged,
        skipped: totalSkipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
