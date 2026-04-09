import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { reference } = await req.json();

    if (!reference) {
      return new Response(
        JSON.stringify({ error: "Missing reference" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Use maybeSingle() to prevent 406 errors when the record isn't found yet
    const { data, error } = await supabase
      .from("stk_transactions")
      .select("status, result_desc, mpesa_receipt, checkout_request_id")
      .eq("reference", reference)
      .maybeSingle();

    // If there's a database error or no data is found, return a pending status
    // This allows the frontend to keep polling until the callback hits the DB
    if (error || !data) {
      console.log(`Transaction not found for reference: ${reference}`);
      return new Response(
        JSON.stringify({ 
          status: "pending", 
          message: "Waiting for payment confirmation..." 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Return the actual transaction result
    return new Response(
      JSON.stringify({
        status: data.status,
        message: data.result_desc,
        receipt: data.mpesa_receipt,
          checkoutRequestId: data.checkout_request_id,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Check status error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
 
