// C2B Validation — clean URL alias (no "mpesa" in path so Safaricom accepts).
// Always accepts; real validation happens in confirmation.
import { corsHeaders } from "../_shared/mpesa.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    console.log("Payment Validation:", JSON.stringify(body));
  } catch (err) {
    console.error("Validation parse error:", err);
  }

  return new Response(
    JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
