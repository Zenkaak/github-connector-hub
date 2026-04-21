// Admin-only: register C2B Validation + Confirmation URLs with Safaricom
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, getAccessToken, MPESA_BASE, PAYBILL, CALLBACKS, CALLBACKS_PROXY } from "../_shared/mpesa.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { useProxy } = await req.json().catch(() => ({ useProxy: false }));
    const cb = useProxy ? CALLBACKS_PROXY : CALLBACKS;

    const accessToken = await getAccessToken();
    const res = await fetch(`${MPESA_BASE}/mpesa/c2b/v2/registerurl`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ShortCode: PAYBILL,
        ResponseType: "Completed",
        ConfirmationURL: cb.confirmation,
        ValidationURL: cb.validation,
      }),
    });
    const data = await res.json();
    console.log("Register URLs response:", data);

    return new Response(JSON.stringify({
      success: res.ok && (data.ResponseCode === "0" || data.ResponseCode === 0),
      registered: cb,
      response: data,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Register URLs error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
