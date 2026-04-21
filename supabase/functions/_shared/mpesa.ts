// Shared M-Pesa helpers for Paybill 4018275 (Production)
export const MPESA_BASE = "https://api.safaricom.co.ke";
export const PAYBILL = "4018275";

const PROJECT_REF = "qtrubtfubdzodahsfacv";
export const SUPABASE_FN_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;

export const CALLBACKS = {
  validation: `${SUPABASE_FN_BASE}/payment-validation`,
  confirmation: `${SUPABASE_FN_BASE}/payment-confirmation`,
  b2cResult: `${SUPABASE_FN_BASE}/mpesa-b2c-result`,
  b2cTimeout: `${SUPABASE_FN_BASE}/mpesa-b2c-timeout`,
};

export const CALLBACKS_PROXY = {
  validation: "https://dasnett.site/api/payments/validation",
  confirmation: "https://dasnett.site/api/payments/confirmation",
  b2cResult: "https://dasnett.site/api/payments/b2c-result",
  b2cTimeout: "https://dasnett.site/api/payments/b2c-timeout",
};

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export async function getAccessToken(): Promise<string> {
  const key = Deno.env.get("MPESA_CONSUMER_KEY");
  const secret = Deno.env.get("MPESA_CONSUMER_SECRET");
  if (!key || !secret) throw new Error("M-Pesa consumer credentials not configured");
  const auth = btoa(`${key}:${secret}`);
  const res = await fetch(`${MPESA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Daraja auth failed [${res.status}]: ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("No access_token in Daraja response");
  return data.access_token;
}

export type RouteResult =
  | { type: "wallet"; user_id: string }
  | { type: "savings"; user_id: string; savings_id: string }
  | { type: "chama"; group_id: string; user_id?: string }
  | { type: "mgr"; group_id: string; cycle_id: string; user_id: string }
  | { type: "loan"; user_id: string; loan_id: string | null }
  | { type: "harambee_user"; user_id: string; harambee_id: string | null }
  | { type: "harambee_public"; harambee_id: string | null; slug: string }
  | { type: "unmapped"; reason: string };

// deno-lint-ignore no-explicit-any
export async function classifyBillRef(supabase: any, billRef: string): Promise<RouteResult> {
  const ref = (billRef || "").trim().toUpperCase();
  if (!ref) return { type: "unmapped", reason: "Empty BillRefNumber" };

  // Wallet: ^\d{4}$
  if (/^\d{4}$/.test(ref)) {
    const { data } = await supabase.from("profiles").select("user_id").eq("mpesa_account_code", ref).maybeSingle();
    if (!data) return { type: "unmapped", reason: `No user with wallet code ${ref}` };
    return { type: "wallet", user_id: data.user_id };
  }

  // ⭐ HARAMBEE PUBLIC: ^H\d{3}$ (new 3-digit format — distinct from 4-digit user codes)
  if (/^H\d{3}$/.test(ref)) {
    const code = ref.slice(1);
    const { data: h } = await supabase.from("chama_harambees").select("id").eq("short_code", code).maybeSingle();
    if (h) return { type: "harambee_public", harambee_id: h.id, slug: ref };
    return { type: "unmapped", reason: `Harambee with code ${code} not found` };
  }
  // ⭐ MERRY-GO-ROUND: ^\d{4}M\d+$ — user code + cycle number
  const mgrMatch = ref.match(/^(\d{4})M(\d+)$/);
  if (mgrMatch) {
    const [, code, cycleNumStr] = mgrMatch;
    const cycleNum = parseInt(cycleNumStr, 10);
    const { data: prof } = await supabase.from("profiles").select("user_id").eq("mpesa_account_code", code).maybeSingle();
    if (!prof) return { type: "unmapped", reason: `MGR: no user with code ${code}` };
    // Find an open cycle in any chama where this user is a member, by cycle_number
    const { data: memberships } = await supabase.from("chama_members").select("group_id").eq("user_id", prof.user_id).eq("is_active", true);
    const groupIds = (memberships || []).map((m: any) => m.group_id);
    if (groupIds.length === 0) {
      return { type: "wallet", user_id: prof.user_id }; // fallback
    }
    const { data: cyc } = await supabase
      .from("chama_mgr_cycles")
      .select("id, group_id")
      .in("group_id", groupIds)
      .eq("cycle_number", cycleNum)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cyc) return { type: "mgr", group_id: cyc.group_id, cycle_id: cyc.id, user_id: prof.user_id } as any;
    // No open cycle → wallet fallback so funds are not lost
    return { type: "wallet", user_id: prof.user_id };
  }

  // Savings: ^\d{4}S\d+$ or ^S\d+\d{4}$ (reverse)
  let sMatch = ref.match(/^(\d{4})S(\d+)$/) || ref.match(/^S(\d+)(\d{4})$/)?.slice(0).map((_, i, a) => i === 1 ? a[2] : i === 2 ? a[1] : a[0]);
  if (sMatch) {
    const code = sMatch[1];
    const savingsIdx = sMatch[2];
    const { data: prof } = await supabase.from("profiles").select("user_id").eq("mpesa_account_code", code).maybeSingle();
    if (!prof) return { type: "unmapped", reason: `Savings: no user with code ${code}` };
    const { data: savings } = await supabase
      .from("personal_savings").select("id").eq("user_id", prof.user_id)
      .order("created_at", { ascending: true });
    const idx = parseInt(savingsIdx, 10) - 1;
    if (!savings || !savings[idx]) return { type: "unmapped", reason: `Savings index ${savingsIdx} out of range` };
    return { type: "savings", user_id: prof.user_id, savings_id: savings[idx].id };
  }

  // Chama (per-user letter): ^\d{4}[A-Z]$ or ^[A-Z]\d{4}$
  // The letter = user's join order (A=1st chama joined, B=2nd, ...)
  // FALLBACK: if user code valid but no chama at that letter → credit wallet (don't fail).
  const cMatch = ref.match(/^(\d{4})([A-Z])$/) || (() => {
    const m = ref.match(/^([A-Z])(\d{4})$/);
    return m ? [m[0], m[2], m[1]] : null;
  })();
  if (cMatch) {
    const code = cMatch[1];
    const letter = cMatch[2];
    const orderIdx = letter.charCodeAt(0) - 64; // A=1, B=2 ...
    const { data: prof } = await supabase.from("profiles").select("user_id").eq("mpesa_account_code", code).maybeSingle();
    if (!prof) return { type: "unmapped", reason: `Chama: no user with code ${code}` };
    const { data: member } = await supabase
      .from("chama_members").select("group_id, join_order")
      .eq("user_id", prof.user_id).eq("join_order", orderIdx).eq("is_active", true)
      .maybeSingle();
    if (!member) {
      // Graceful fallback: route to user's wallet so funds are never lost.
      console.log(`[classifier] ${code}${letter}: no chama at position ${letter} → wallet fallback`);
      return { type: "wallet", user_id: prof.user_id };
    }
    return { type: "chama", group_id: member.group_id, user_id: prof.user_id };
  }

  // Legacy chama: ^\d{7}$
  if (/^\d{7}$/.test(ref)) {
    const { data } = await supabase.from("chama_groups").select("id").eq("order_number", ref).maybeSingle();
    if (!data) return { type: "unmapped", reason: `No chama group with order ${ref}` };
    return { type: "chama", group_id: data.id };
  }

  // Loan: ^\d{4}L$ or ^L\d{4}$
  const lMatch = ref.match(/^(\d{4})L$/) || (() => {
    const m = ref.match(/^L(\d{4})$/);
    return m ? [m[0], m[1]] : null;
  })();
  if (lMatch) {
    const code = lMatch[1];
    const { data: prof } = await supabase.from("profiles").select("user_id").eq("mpesa_account_code", code).maybeSingle();
    if (!prof) return { type: "unmapped", reason: `Loan: no user with code ${code}` };
    const { data: loan } = await supabase
      .from("loan_disbursements").select("loan_id").eq("user_id", prof.user_id)
      .gt("outstanding_balance", 0).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return { type: "loan", user_id: prof.user_id, loan_id: loan?.loan_id ?? null };
  }

  // ^\d{4}H\d{3}$ — user code + 3-digit harambee short code
  const hUserNew = ref.match(/^(\d{4})H(\d{3})$/);
  if (hUserNew) {
    const [, code, hCode] = hUserNew;
    const { data: prof } = await supabase.from("profiles").select("user_id").eq("mpesa_account_code", code).maybeSingle();
    const { data: h } = await supabase.from("chama_harambees").select("id").eq("short_code", hCode).maybeSingle();
    if (prof && h) return { type: "harambee_user", user_id: prof.user_id, harambee_id: h.id };
  }

  // FINAL FALLBACK: if the ref STARTS with a valid 4-digit user code,
  // route to that user's wallet so funds are never lost.
  // (Covers cases like "3044C", "3044X9", "3044-savings", etc.)
  const userCodePrefix = ref.match(/^(\d{4})/);
  if (userCodePrefix) {
    const { data: prof } = await supabase.from("profiles").select("user_id").eq("mpesa_account_code", userCodePrefix[1]).maybeSingle();
    if (prof) {
      console.log(`[classifier] ${ref}: unrecognised suffix → wallet fallback for user ${userCodePrefix[1]}`);
      return { type: "wallet", user_id: prof.user_id };
    }
  }

  return { type: "unmapped", reason: `Account format not recognised: ${ref}` };
}
