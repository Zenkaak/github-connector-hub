// Shared M-Pesa helpers for Paybill 4018275 (Production)
export const MPESA_BASE = "https://api.safaricom.co.ke";
export const PAYBILL = "4018275";

// Public callback URLs (both Supabase direct + dasnett.site proxy will be registered)
const PROJECT_REF = "qtrubtfubdzodahsfacv";
export const SUPABASE_FN_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;

// Default callbacks use clean URLs (no "mpesa" in path — Safaricom rejects URLs containing "mpesa")
export const CALLBACKS = {
  validation: `${SUPABASE_FN_BASE}/payment-validation`,
  confirmation: `${SUPABASE_FN_BASE}/payment-confirmation`,
  b2cResult: `${SUPABASE_FN_BASE}/mpesa-b2c-result`,
  b2cTimeout: `${SUPABASE_FN_BASE}/mpesa-b2c-timeout`,
};

// Alternate dasnett.site URLs (proxy maps these to Supabase)
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daraja auth failed [${res.status}]: ${text}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error("No access_token in Daraja response");
  return data.access_token;
}

// Account routing — map BillRefNumber to a target resource
export type RouteResult =
  | { type: "wallet"; user_id: string }
  | { type: "savings"; user_id: string; savings_id: string }
  | { type: "chama"; group_id: string }
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

  // Savings: ^\d{4}S\d+$
  const sMatch = ref.match(/^(\d{4})S(\d+)$/);
  if (sMatch) {
    const [, code, savingsIdx] = sMatch;
    const { data: prof } = await supabase.from("profiles").select("user_id").eq("mpesa_account_code", code).maybeSingle();
    if (!prof) return { type: "unmapped", reason: `Savings: no user with code ${code}` };
    // savingsIdx is the 1-based index of the savings goal for this user (created_at order)
    const { data: savings } = await supabase
      .from("personal_savings")
      .select("id")
      .eq("user_id", prof.user_id)
      .order("created_at", { ascending: true });
    const idx = parseInt(savingsIdx, 10) - 1;
    if (!savings || !savings[idx]) return { type: "unmapped", reason: `Savings index ${savingsIdx} out of range for user ${code}` };
    return { type: "savings", user_id: prof.user_id, savings_id: savings[idx].id };
  }

  // Chama: ^\d{7}$ — first 4 = creator's code, last 3 = group order_number suffix
  if (/^\d{7}$/.test(ref)) {
    const { data } = await supabase.from("chama_groups").select("id").eq("order_number", ref).maybeSingle();
    if (!data) return { type: "unmapped", reason: `No chama group with order ${ref}` };
    return { type: "chama", group_id: data.id };
  }

  // Loan: ^\d{4}L$
  const lMatch = ref.match(/^(\d{4})L$/);
  if (lMatch) {
    const [, code] = lMatch;
    const { data: prof } = await supabase.from("profiles").select("user_id").eq("mpesa_account_code", code).maybeSingle();
    if (!prof) return { type: "unmapped", reason: `Loan: no user with code ${code}` };
    // Find active disbursed loan with outstanding balance
    const { data: loan } = await supabase
      .from("loan_disbursements")
      .select("loan_id")
      .eq("user_id", prof.user_id)
      .gt("outstanding_balance", 0)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { type: "loan", user_id: prof.user_id, loan_id: loan?.loan_id ?? null };
  }

  // Harambee user-linked: ^\d{4}H\d{3}$
  const hMatch = ref.match(/^(\d{4})H(\d{3})$/);
  if (hMatch) {
    const [, code, slug] = hMatch;
    const { data: prof } = await supabase.from("profiles").select("user_id").eq("mpesa_account_code", code).maybeSingle();
    if (!prof) return { type: "unmapped", reason: `Harambee: no user with code ${code}` };
    const { data: h } = await supabase.from("chama_harambees").select("id").eq("order_number", `H${slug}`).maybeSingle();
    return { type: "harambee_user", user_id: prof.user_id, harambee_id: h?.id ?? null };
  }

  // Harambee public: ^H\d{3}$
  if (/^H\d{3}$/.test(ref)) {
    const { data: h } = await supabase.from("chama_harambees").select("id").eq("order_number", ref).maybeSingle();
    return { type: "harambee_public", harambee_id: h?.id ?? null, slug: ref };
  }

  return { type: "unmapped", reason: `Account format not recognised: ${ref}` };
}
