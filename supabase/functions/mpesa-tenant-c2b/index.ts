// M-Pesa C2B Paybill Confirmation per tenant.
// Called by Safaricom for each successful paybill payment.
// URL format: /functions/v1/mpesa-tenant-c2b?token=<tenant.callback_token>
// Stores each transaction in tenant_paybill_transactions for the SACCO admin to reconcile.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = () => new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      console.error("mpesa-tenant-c2b: missing token");
      return ok(); // Always 0 to Safaricom
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: tenant } = await supabase
      .from("tenants").select("id, name, status")
      .eq("callback_token", token).maybeSingle();
    if (!tenant || tenant.status !== "active") {
      console.error("mpesa-tenant-c2b: unknown or inactive tenant token");
      return ok();
    }

    const body = await req.json().catch(() => ({}));
    console.log("tenant", tenant.id, "C2B:", JSON.stringify(body));

    // Safaricom C2B payload uses TitleCase fields
    const receipt = body.TransID || body.TransactionID || null;
    const amount = Number(body.TransAmount || body.Amount || 0);
    const payerPhone = body.MSISDN || body.PhoneNumber || null;
    const payerName = [body.FirstName, body.MiddleName, body.LastName].filter(Boolean).join(" ") || null;
    const accountRef = body.BillRefNumber || body.AccountReference || null;
    const transTime = body.TransTime ? parseTransTime(body.TransTime) : new Date().toISOString();

    let matchedStatus: "matched" | "unmatched" = "unmatched";
    let matchedUserId: string | null = null;
    let matchedLoanId: string | null = null;
    let notes: string | null = null;

    if (receipt) {
      // 1. Try to auto-match by ID number → active loan disbursement
      if (accountRef) {
        const cleanRef = String(accountRef).trim();
        const { data: profile } = await supabase
          .from("profiles").select("user_id, full_name, id_number")
          .eq("id_number", cleanRef).maybeSingle();

        if (profile?.user_id) {
          matchedUserId = profile.user_id;
          const { data: loan } = await supabase
            .from("loan_disbursements")
            .select("id, loan_id, outstanding_balance")
            .eq("user_id", profile.user_id)
            .eq("status", "active")
            .gt("outstanding_balance", 0)
            .order("created_at", { ascending: true })
            .limit(1).maybeSingle();

          if (loan) {
            const newBalance = Math.max(Number(loan.outstanding_balance || 0) - amount, 0);
            await supabase.from("loan_disbursements")
              .update({ outstanding_balance: newBalance, status: newBalance === 0 ? "paid" : "active" })
              .eq("id", loan.id);
            await supabase.from("wallet_transactions").insert({
              user_id: profile.user_id,
              type: "loan_repayment",
              amount,
              description: `SACCO ${tenant.name}: Paybill repayment (Ref ${cleanRef})`,
              reference_id: receipt,
              status: "completed",
            });
            matchedStatus = "matched";
            matchedLoanId = loan.loan_id;
            notes = `Applied to loan; new balance KES ${newBalance.toLocaleString()}.`;
          } else {
            notes = `ID ${cleanRef} matched user but no active loan found.`;
          }
        } else {
          notes = `ID ${cleanRef} not registered. Awaiting manual reconciliation.`;
        }
      }

      await supabase.from("tenant_paybill_transactions").upsert({
        tenant_id: tenant.id,
        mpesa_receipt: receipt,
        amount,
        payer_phone: payerPhone,
        payer_name: payerName,
        account_reference: accountRef,
        trans_time: transTime,
        raw_payload: body,
        status: matchedStatus,
        matched_user_id: matchedUserId,
        matched_loan_id: matchedLoanId,
        notes,
      }, { onConflict: "tenant_id,mpesa_receipt" });
    }

    return ok();
  } catch (err) {
    console.error("mpesa-tenant-c2b error:", err);
    return ok();
  }
});

function parseTransTime(t: string): string {
  // Safaricom format: YYYYMMDDHHmmss
  if (!/^\d{14}$/.test(t)) return new Date().toISOString();
  const y = t.slice(0, 4), mo = t.slice(4, 6), d = t.slice(6, 8);
  const h = t.slice(8, 10), mi = t.slice(10, 12), s = t.slice(12, 14);
  return `${y}-${mo}-${d}T${h}:${mi}:${s}+03:00`;
}
