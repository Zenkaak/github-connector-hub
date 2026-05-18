// Creates a new SACCO tenant + auth user + tenant_admin link, then sends SMS + email invite.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/mpesa.ts";
import { sendSMS } from "../_shared/sms.ts";

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Authenticate caller — must be super admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: userRes, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !userRes?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const callerId = userRes.user.id;
    const { data: hasRole } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!hasRole) return new Response(JSON.stringify({ error: "Forbidden — admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const {
      name, slug: rawSlug, logo_url, primary_color, custom_domain,
      paybill_shortcode, features_enabled,
      admin_full_name, admin_phone, admin_email,
    } = body;

    if (!name || !admin_full_name || !admin_phone || !admin_email) {
      return new Response(JSON.stringify({ error: "name, admin_full_name, admin_phone, admin_email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const slug = slugify(rawSlug || name);
    if (!slug) return new Response(JSON.stringify({ error: "Invalid slug" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Normalize phone to 2547XXXXXXXX
    let phone = admin_phone.trim().replace(/[^0-9+]/g, "");
    if (phone.startsWith("+")) phone = phone.slice(1);
    if (phone.startsWith("0")) phone = "254" + phone.slice(1);
    if (phone.startsWith("7") || phone.startsWith("1")) phone = "254" + phone;

    // 1. Create auth user (auto-confirm so they can log in immediately)
    const password = generatePassword();
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: admin_email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: admin_full_name,
        phone,
        is_tenant_admin: true,
      },
    });
    if (cErr || !created?.user) {
      return new Response(JSON.stringify({ error: cErr?.message || "Failed to create admin user" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const newUserId = created.user.id;

    // 2. Insert tenant
    const { data: tenant, error: tErr } = await admin.from("tenants").insert({
      slug, name, logo_url, primary_color, custom_domain,
      paybill_shortcode,
      features_enabled: features_enabled ?? { chama: true, mgr: true, loans: true, wallet: false, harambee: false },
      created_by: callerId,
    }).select("*").single();
    if (tErr) {
      // rollback user
      await admin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: tErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Link as tenant admin
    await admin.from("tenant_admins").insert({ tenant_id: tenant.id, user_id: newUserId, role: "admin" });

    // 4. Build login URL
    const loginUrl = custom_domain
      ? `https://${custom_domain}/sacco/${slug}/login`
      : `https://dasnetventures.lovable.app/sacco/${slug}/login`;

    // 5. Send SMS
    const smsMsg = `Welcome to ${name}! Your Dasnet SACCO admin account is ready.\nLogin: ${loginUrl}\nEmail: ${admin_email}\nPassword: ${password}\nPlease change your password after first login.`;
    try { await sendSMS(phone, smsMsg); } catch (e) { console.error("SMS failed:", e); }

    // 6. Send email (best-effort via existing transactional pipeline)
    try {
      await admin.functions.invoke("send-transactional-email", {
        body: {
          to: admin_email,
          subject: `Your ${name} admin account is ready`,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f6f8fb">
            <h2 style="color:#0f172a">Welcome, ${admin_full_name}</h2>
            <p>Your <strong>${name}</strong> admin portal is ready.</p>
            <table style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;width:100%">
              <tr><td><strong>Login URL:</strong></td><td><a href="${loginUrl}">${loginUrl}</a></td></tr>
              <tr><td><strong>Email:</strong></td><td>${admin_email}</td></tr>
              <tr><td><strong>Password:</strong></td><td><code>${password}</code></td></tr>
            </table>
            <p style="color:#64748b;font-size:13px;margin-top:16px">For security, please change your password after your first login.</p>
          </div>`,
        },
      });
    } catch (e) { console.error("Email failed:", e); }

    return new Response(JSON.stringify({ ok: true, tenant, login_url: loginUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-tenant error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
