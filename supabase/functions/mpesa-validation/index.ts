// C2B Validation — Safaricom calls this BEFORE accepting payment.
// We always accept (ResultCode 0). Real validation happens in confirmation.
import { corsHeaders } from "../_shared/mpesa.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    console.log("C2B Validation:", JSON.stringify(body));
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Validation error:", err);
    // Even on error, accept — we'd rather process and reconcile than reject
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
