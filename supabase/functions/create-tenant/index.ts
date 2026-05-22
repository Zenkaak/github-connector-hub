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

const responseHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: responseHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: responseHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) { console.error("create-tenant: missing auth"); return json({ error: "Unauthorized — no token" }, 401); }
    const { data: userRes, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !userRes?.user) { console.error("create-tenant: getUser", uErr); return json({ error: "Unauthorized — invalid token" }, 401); }
    const callerId = userRes.user.id;

    // Check admin status: first via profiles.is_admin, then fall back to has_role RPC.
    // This handles users who are admin via profiles but don't have a user_roles row.
    const { data: callerProfile, error: pErr } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("user_id", callerId)
      .maybeSingle();
    if (pErr) console.error("create-tenant: profiles lookup error", pErr);

    let isAdmin = callerProfile?.is_admin === true;

    if (!isAdmin) {
      const { data: hasRole, error: rErr } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
      if (rErr) console.error("create-tenant: has_role error", rErr);
      isAdmin = !!hasRole;
    }

    if (!isAdmin) {
      console.error("create-tenant: not admin", callerId);
      return json({ error: "Forbidden — admin only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const {
      name, slug: rawSlug, logo_url, primary_color, custom_domain,
      paybill_shortcode, features_enabled,
      admin_full_name, admin_phone, admin_email,
    } = body as any;

    if (!name || !admin_full_name || !admin_phone || !admin_email) {
      return json({ error: "name, admin_full_name, admin_phone, admin_email required" }, 400);
    }

    const slug = slugify(rawSlug || name);
    if (!slug) return json({ error: "Invalid slug" }, 400);

    // Check slug uniqueness early for a clean error
    const { data: existing } = await admin.from("tenants").select("id").eq("slug", slug).maybeSingle();
    if (existing) return json({ error: `Slug "${slug}" already in use — choose another` }, 400);

    // Normalize phone to 2547XXXXXXXX
    let phone = admin_phone.trim().replace(/[^0-9+]/g, "");
    if (phone.startsWith("+")) phone = phone.slice(1);
    if (phone.startsWith("0")) phone = "254" + phone.slice(1);
    if (phone.startsWith("7") || phone.startsWith("1")) phone = "254" + phone;

    // Pre-check: ensure no profile already has this email or phone.
    // Supabase wraps trigger failures as "Database error creating new user" which
    // is confusing — we surface a clear message before that can happen.
    const emailNorm = admin_email.toLowerCase().trim();
    const { data: dupProfile } = await admin
      .from("profiles")
      .select("email, phone")
      .or(`email.eq.${emailNorm},phone.eq.${phone}`)
      .maybeSingle();
    if (dupProfile) {
      if (dupProfile.email === emailNorm) return json({ error: "A user with that email already exists" }, 409);
      return json({ error: "A user with that phone number already exists" }, 409);
    }

    // 1. Create auth user (auto-confirm so they can log in immediately).
    // All NOT NULL profile columns are supplied as empty strings so both
    // handle_new_user and handle_new_user_signup triggers succeed without
    // hitting NOT NULL constraint violations on fields not relevant here.
    const password = generatePassword();
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: emailNorm,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: admin_full_name,
        phone,
        is_tenant_admin: true,
        // Provide empty-string defaults for every NOT NULL profile column so
        // the DB trigger doesn't receive NULL and violate a NOT NULL constraint.
        county: "",
        sub_county: "",
        ward: "",
        address: "",
        id_number: "",
        date_of_birth: "",
      },
    });
    if (cErr || !created?.user) {
      const msg = cErr?.message ?? "Failed to create admin user";
      // Give a friendlier message for the opaque Supabase trigger-failure error.
      const friendly = msg.toLowerCase().includes("database error")
        ? "Could not create user account — the email may already exist or a database rule blocked it. Please verify the details and try again."
        : msg;
      return json({ error: friendly }, 400);
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
      console.error("tenants insert failed:", tErr);
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: tErr.message }, 400);
    }

    // 3. Link as tenant admin
    const { error: linkErr } = await admin.from("tenant_admins").insert({ tenant_id: tenant.id, user_id: newUserId, role: "admin" });
    if (linkErr) {
      console.error("tenant_admins insert failed:", linkErr);
      await admin.from("tenants").delete().eq("id", tenant.id);
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: linkErr.message }, 400);
    }

    // 4. Build login URL
    const loginUrl = custom_domain
      ? `https://${custom_domain}/sacco/${slug}/login`
      : `https://dasnetventures.lovable.app/sacco/${slug}/login`;

    // 5. Send SMS
    const smsMsg = `Welcome to ${name}! Your DASNET SACCO admin account is ready.\nLogin: ${loginUrl}\nEmail: ${admin_email}\nPassword: ${password}\nPlease change your password after first login.`;
    let smsResult: { ok: boolean; error?: string } = { ok: false, error: "not attempted" };
    try { smsResult = await sendSMS(phone, smsMsg); } catch (e) { console.error("SMS failed:", e); smsResult = { ok: false, error: String(e) }; }
    console.log("create-tenant SMS:", smsResult);

    // 6. Queue branded invite email directly into the transactional_emails pgmq queue.
    // The process-email-queue cron dispatches it via Lovable Emails.
    const SITE_NAME = "DASNET VENTURES";
    const SENDER_DOMAIN = "notify.dasnett.site";
    const FROM_DOMAIN = "notify.dasnett.site";
    const messageId = crypto.randomUUID();
    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
      <div style="max-width:560px;margin:0 auto;padding:32px 24px">
        <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a">Welcome, ${admin_full_name}</h1>
        <p style="margin:0 0 20px;color:#475569">Your <strong>${name}</strong> SACCO admin portal is ready.</p>
        <table role="presentation" style="width:100%;border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;border-spacing:0">
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0"><strong>Login URL</strong></td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0"><a href="${loginUrl}" style="color:#10b981;text-decoration:none">${loginUrl}</a></td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0"><strong>Email</strong></td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">${admin_email}</td></tr>
          <tr><td style="padding:12px 16px"><strong>Password</strong></td><td style="padding:12px 16px"><code style="background:#f1f5f9;padding:4px 8px;border-radius:4px">${password}</code></td></tr>
        </table>
        <p style="margin:24px 0 0;color:#64748b;font-size:13px">For security, please change your password after your first login.</p>
        <p style="margin:16px 0 0;color:#94a3b8;font-size:12px">— ${SITE_NAME}</p>
      </div></body></html>`;
    const text = `Welcome, ${admin_full_name}\n\nYour ${name} SACCO admin portal is ready.\nLogin: ${loginUrl}\nEmail: ${admin_email}\nPassword: ${password}\n\nPlease change your password after first login.\n— ${SITE_NAME}`;

    let emailQueued = false;
    try {
      await admin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "tenant-admin-invite",
        recipient_email: admin_email,
        status: "pending",
      });
      const { error: enqErr } = await admin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to: admin_email,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject: `Your ${name} admin account is ready`,
          html,
          text,
          purpose: "transactional",
          label: "tenant-admin-invite",
          idempotency_key: messageId,
          queued_at: new Date().toISOString(),
        },
      });
      if (enqErr) { console.error("enqueue_email failed:", enqErr); }
      else emailQueued = true;
    } catch (e) { console.error("Email enqueue failed:", e); }

    return json({ ok: true, tenant, login_url: loginUrl, sms: smsResult, email_queued: emailQueued });
  } catch (err) {
    console.error("create-tenant error:", err);
    return json({ error: String(err) }, 500);
  }
});
