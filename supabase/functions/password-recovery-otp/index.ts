// @ts-nocheck
// Edge function: password-recovery-otp
// Two actions:
//  - "request": generate a 6-digit code, store hash + expiry, email it
//  - "verify": verify the code; if valid issue a recovery link the client uses to log in then change password
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_NAME = 'DASNET VENTURES'
const FROM_DOMAIN = 'notify.dasnett.site'
const SENDER_DOMAIN = 'notify.dasnett.site'

function html6(code: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:'DM Sans',Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff">
    <h1 style="font-size:22px;color:hsl(213,72%,18%);margin:0 0 12px">Password reset code</h1>
    <p style="font-size:14px;color:#5b5f6b;line-height:1.6;margin:0 0 24px">
      Use this 6-digit code to reset your ${SITE_NAME} password. It expires in 10 minutes.
    </p>
    <div style="background:hsl(42,92%,96%);border:1px solid hsl(42,92%,80%);border-radius:14px;padding:20px;text-align:center;margin:0 0 24px">
      <div style="font-size:34px;letter-spacing:10px;font-weight:bold;color:hsl(213,72%,18%);font-family:monospace">${code}</div>
    </div>
    <p style="font-size:12px;color:#9aa0ad;margin:0">If you didn't request this, ignore this email. Your password will not be changed.</p>
    <hr style="border:none;border-top:1px solid #eaeaea;margin:24px 0"/>
    <p style="font-size:11px;color:#aab0bb;margin:0">© ${new Date().getFullYear()} ${SITE_NAME}</p>
  </div></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.json()
    const { action, email, code, newPassword } = body
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    if (action === 'request') {
      // Generate 6 digits
      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      // Hash OTP before storing (defense-in-depth)
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(otp))
      const otpHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')

      const { error: upsertErr } = await admin
        .from('password_recovery_codes')
        .upsert({
          email: email.toLowerCase(),
          code_hash: otpHash,
          expires_at: expires,
          used: false,
          attempts: 0,
        }, { onConflict: 'email' })

      if (upsertErr) {
        return new Response(JSON.stringify({ error: upsertErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Send via send-transactional-email — direct fetch with service role bearer
      const idempotencyKey = `pwd-recovery-${email.toLowerCase()}-${Date.now()}`
      try {
        const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-transactional-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          },
          body: JSON.stringify({
            templateName: 'password-recovery-otp',
            recipientEmail: email,
            idempotencyKey,
            templateData: { code: otp },
          }),
        })
        if (!resp.ok) console.error('Failed to enqueue OTP email', resp.status, await resp.text())
      } catch (e) { console.error('OTP email enqueue exception', e) }

      // Also send via SMS if user has a phone on profile (best-effort, never block)
      try {
        const { data: prof } = await admin
          .from('profiles')
          .select('phone, full_name')
          .eq('email', email.toLowerCase())
          .maybeSingle()
        if (prof?.phone) {
          const { sendSMS } = await import('../_shared/sms.ts')
          const firstName = (prof.full_name || 'Member').split(' ')[0]
          await sendSMS(
            prof.phone,
            `Dear ${firstName}, your DASNET VENTURES password reset code is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
          )
        }
      } catch (smsErr) {
        console.warn('OTP SMS dispatch failed (non-fatal):', smsErr)
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'verify') {
      if (!code || !/^\d{6}$/.test(code) || !newPassword || newPassword.length < 6) {
        return new Response(JSON.stringify({ error: 'Invalid code or password' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: row } = await admin
        .from('password_recovery_codes')
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle()

      if (!row) return new Response(JSON.stringify({ error: 'No code requested' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

      if (row.used) return new Response(JSON.stringify({ error: 'Code already used' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

      if (new Date(row.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'Code expired' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (row.attempts >= 5) {
        return new Response(JSON.stringify({ error: 'Too many attempts' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const verifyHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
      const verifyHash = Array.from(new Uint8Array(verifyHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
      if (row.code_hash !== verifyHash && row.code_hash !== code) {
        await admin.from('password_recovery_codes')
          .update({ attempts: row.attempts + 1 })
          .eq('email', email.toLowerCase())
        return new Response(JSON.stringify({ error: 'Incorrect code' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Find user and update password directly via admin
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const user = list?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
      if (!user) {
        return new Response(JSON.stringify({ error: 'Account not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
        password: newPassword,
      })
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await admin.from('password_recovery_codes')
        .update({ used: true })
        .eq('email', email.toLowerCase())

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
