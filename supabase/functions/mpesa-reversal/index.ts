// Admin-only: reverse a C2B payment
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, getAccessToken, MPESA_BASE, PAYBILL, CALLBACKS } from "../_shared/mpesa.ts";

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
    const { data: adminProf } = await admin.from("profiles").select("is_admin").eq("user_id", userData.user.id).maybeSingle();
    if (!adminProf?.is_admin) {
      const { data: roleCheck } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
      if (!roleCheck) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { transactionId, amount, remarks = "Reversal", occasion = "Error correction" } = await req.json();
    if (!transactionId || !amount) {
      return new Response(JSON.stringify({ error: "transactionId and amount required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken();
    const res = await fetch(`${MPESA_BASE}/mpesa/reversal/v1/request`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        Initiator: Deno.env.get("MPESA_INITIATOR_NAME"),
        SecurityCredential: Deno.env.get("MPESA_SECURITY_CREDENTIAL"),
        CommandID: "TransactionReversal",
        TransactionID: transactionId,
        Amount: String(amount),
        ReceiverParty: PAYBILL,
        RecieverIdentifierType: "11",
        ResultURL: `${CALLBACKS.b2cResult.replace("/mpesa-b2c-result", "/mpesa-validation")}`, // route reversal results to validation log for now
        QueueTimeOutURL: CALLBACKS.b2cTimeout,
        Remarks: remarks,
        Occasion: occasion,
      }),
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
