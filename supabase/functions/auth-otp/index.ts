// @ts-nocheck
// Edge function: auth-otp
// Two actions:
//  - "request": user enters email or phone. We resolve to an account, generate
//    a 6-digit OTP, store its hash, and dispatch via SMS (if phone on profile)
//    AND email.
//  - "verify": user enters the 6-digit code; we issue a magic-link token_hash
//    that the client uses with supabase.auth.verifyOtp to establish a session.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_NAME = 'DASNET VENTURES'

function normalizePhone(input: string) {
  let p = (input || '').trim().replace(/\s+/g, '')
  if (p.startsWith('0') && p.length === 10) return '+254' + p.slice(1)
  if (p.startsWith('254') && p.length === 12) return '+' + p
  if (p.startsWith('+254')) return p
  if (/^\d{9}$/.test(p)) return '+254' + p
  return p
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function html6(code: string) {
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:'DM Sans',Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;color:hsl(213,72%,18%);margin:0 0 12px">Your sign-in code</h1>
    <p style="font-size:14px;color:#5b5f6b;line-height:1.6;margin:0 0 24px">
      Use this 6-digit code to sign in to your ${SITE_NAME} account. Expires in 10 minutes.
    </p>
    <div style="background:hsl(42,92%,96%);border:1px solid hsl(42,92%,80%);border-radius:14px;padding:20px;text-align:center;margin:0 0 24px">
      <div style="font-size:34px;letter-spacing:10px;font-weight:bold;color:hsl(213,72%,18%);font-family:monospace">${code}</div>
    </div>
    <p style="font-size:12px;color:#9aa0ad;margin:0">Didn't try to sign in? Ignore this email. Never share this code.</p>
  </div></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const json = (status: number, body: any) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const body = await req.json()
    const { action } = body

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    if (action === 'request') {
      const identifier = String(body.identifier || '').trim()
      if (!identifier) return json(400, { error: 'Email or phone required' })

      // Resolve to a profile (and email).
      let profile: any = null
      if (identifier.includes('@')) {
        const { data } = await admin.from('profiles')
          .select('email, phone, full_name, is_active, disable_reason')
          .eq('email', identifier.toLowerCase()).maybeSingle()
        profile = data
      } else {
        const phone = normalizePhone(identifier)
        const altLocal = phone.startsWith('+254') ? '0' + phone.slice(4) : phone
        const { data } = await admin.from('profiles')
          .select('email, phone, full_name, is_active, disable_reason')
          .or(`phone.eq.${phone},phone.eq.${altLocal}`).limit(1).maybeSingle()
        profile = data
      }
      if (!profile?.email) return json(404, { error: 'No account found for that email or phone' })
      if (profile.is_active === false) return json(403, { error: `Account disabled: ${profile.disable_reason || 'Contact support.'}` })

      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      const codeHash = await sha256(otp)
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      await admin.from('login_otp_codes').upsert({
        email: profile.email.toLowerCase(),
        code_hash: codeHash,
        expires_at: expires,
        used: false,
        attempts: 0,
      }, { onConflict: 'email' })

      // Email (via transactional queue) — use direct fetch with service role bearer
      try {
        const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-transactional-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          },
          body: JSON.stringify({
            templateName: 'login-otp',
            recipientEmail: profile.email,
            idempotencyKey: `login-otp-${profile.email.toLowerCase()}-${Date.now()}`,
            templateData: { code: otp },
          }),
        })
        if (!resp.ok) console.error('OTP email enqueue failed', resp.status, await resp.text())
      } catch (e) { console.error('OTP email enqueue exception', e) }

      // SMS (best-effort)
      let smsSent = false
      if (profile.phone) {
        try {
          const { sendSMS } = await import('../_shared/sms.ts')
          const firstName = (profile.full_name || 'Member').split(' ')[0]
          await sendSMS(
            profile.phone,
            `Dear ${firstName}, your DASNET VENTURES sign-in code is ${otp}. It expires in 10 minutes. Do not share this code.`,
          )
          smsSent = true
        } catch (e) { console.warn('OTP SMS failed (non-fatal):', e) }
      }

      // Mask the destination addresses in response
      const maskEmail = (e: string) => {
        const [u, d] = e.split('@'); if (!d) return e
        return u.slice(0, 2) + '***@' + d
      }
      const maskPhone = (p: string) => p.replace(/.(?=.{3})/g, '*')

      return json(200, {
        ok: true,
        email: profile.email,
        sentEmail: true,
        sentSms: smsSent,
        emailMask: maskEmail(profile.email),
        phoneMask: profile.phone ? maskPhone(profile.phone) : null,
      })
    }

    if (action === 'verify') {
      const { email, code } = body
      if (!email || !/^\d{6}$/.test(code || '')) return json(400, { error: 'Invalid request' })

      const { data: row } = await admin.from('login_otp_codes')
        .select('*').eq('email', email.toLowerCase()).maybeSingle()
      if (!row) return json(400, { error: 'No code requested' })
      if (row.used) return json(400, { error: 'Code already used' })
      if (new Date(row.expires_at) < new Date()) return json(400, { error: 'Code expired' })
      if (row.attempts >= 5) return json(429, { error: 'Too many attempts' })

      const expectedHash = await sha256(code)
      if (row.code_hash !== expectedHash) {
        await admin.from('login_otp_codes').update({ attempts: row.attempts + 1 }).eq('email', email.toLowerCase())
        return json(400, { error: 'Incorrect code' })
      }

      await admin.from('login_otp_codes').update({ used: true }).eq('email', email.toLowerCase())

      // Issue a magic link the client can verify to establish a session
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      })
      if (linkErr) return json(500, { error: linkErr.message })

      const props = (linkData as any)?.properties || {}
      const token_hash = props.hashed_token || props.email_otp_hash
      if (!token_hash) return json(500, { error: 'Could not issue session token' })

      return json(200, { ok: true, email, token_hash })
    }

    return json(400, { error: 'Unknown action' })
  } catch (e: any) {
    return json(500, { error: e?.message || 'Server error' })
  }
})
