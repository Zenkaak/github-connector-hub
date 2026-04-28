// @ts-nocheck
// Edge function: pin-login
// Verifies a 4-digit PIN against user_pins (via DB function), then issues a magic-link
// auth tokens object the client can use to sign in. We use admin generateLink + verifyOtp pattern.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { identifier, pin } = await req.json()
    if (!identifier || !pin || !/^\d{4}$/.test(pin)) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    // Verify PIN via secured DB function
    const { data: matched, error: vErr } = await admin.rpc('verify_pin_login', {
      _identifier: identifier,
      _pin: pin,
    })

    if (vErr || !matched || matched.length === 0) {
      return new Response(JSON.stringify({ error: vErr?.message || 'Invalid PIN' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const email = matched[0].email
    if (!email) {
      return new Response(JSON.stringify({ error: 'Account has no email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate a magic link, then strip the OTP token to send back to client.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (linkErr || !linkData?.properties) {
      return new Response(JSON.stringify({ error: 'Could not issue session' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      email,
      token_hash: linkData.properties.hashed_token,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
