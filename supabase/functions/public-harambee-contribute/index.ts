import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, amount, orderNumber, contributorName } = await req.json()

    // 1. Initialize Supabase Admin using environment variables
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Get Harambee details to verify the order exists
    const { data: harambee, error: hError } = await supabaseAdmin
      .from('chama_harambees')
      .select('id, beneficiary_name')
      .eq('order_number', orderNumber)
      .single()

    if (hError || !harambee) throw new Error('Harambee not found')

    // 3. Generate a unique reference
    // Fixed: changed .upperCase() to .toUpperCase()
    const reference = `HRB-${Math.random().toString(36).toUpperCase().substring(2, 10)}`

    // NOTE: This is where you would normally call your M-Pesa API (e.g., Lipia or Daraja)
    // to trigger the actual STK Push.

    return new Response(
      JSON.stringify({ reference, message: "STK Push initiated successfully" }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      }
    )
  }
}) // Fixed: added missing closing parenthesis for serve
