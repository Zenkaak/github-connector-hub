// SMS helper — sends professional notifications via sms.ots.co.ke (OTS).
// Requires API_TOKEN and SENDER_ID secrets.

const OTS_API_URL = "https://sms.ots.co.ke/api/v3/sms/send";

function normalizePhone(phone: string): string | null {
  let p = String(phone || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7") || p.startsWith("1")) p = "254" + p;
  if (!/^254[17]\d{8}$/.test(p)) return null;
  return p; // OTS accepts MSISDN without leading +
}

export async function sendSMS(phone: string, message: string, senderId?: string): Promise<{ ok: boolean; error?: string }> {
  const apiToken = Deno.env.get("API_TOKEN");
  const defaultSender = Deno.env.get("SENDER_ID") || "PROCALL";
  const sender = senderId || defaultSender;

  if (!apiToken) {
    console.warn("[SMS] API_TOKEN not configured — skipping SMS");
    return { ok: false, error: "API_TOKEN missing" };
  }

  const recipient = normalizePhone(phone);
  if (!recipient) return { ok: false, error: `Invalid phone: ${phone}` };

  try {
    const res = await fetch(OTS_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        recipient,
        sender_id: sender,
        type: "plain",
        message: message.slice(0, 480),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data?.status === "success" || data?.success === true || data?.code === 200 || res.status === 200)) {
      console.log(`[SMS] sent to ${recipient}`, data?.message_id || data?.id || "");
      return { ok: true };
    }
    console.error("[SMS] OTS rejected:", res.status, JSON.stringify(data));
    return { ok: false, error: data?.message || `OTS HTTP ${res.status}` };
  } catch (err) {
    console.error("[SMS] exception:", err);
    return { ok: false, error: String(err) };
  }
}

// Convenience: lookup phone+name from profile and send.
// deno-lint-ignore no-explicit-any
export async function sendUserSMS(supabase: any, userId: string, message: string): Promise<void> {
  if (!userId) return;
  const { data: prof } = await supabase
    .from("profiles")
    .select("phone, full_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!prof?.phone) return;
  const personalised = message.replace(/\{name\}/g, prof.full_name?.split(" ")[0] || "Member");
  await sendSMS(prof.phone, personalised);
}

// Format helper
export const fmt = (n: number) => `KES ${Math.round(Number(n || 0)).toLocaleString()}`;

// Standard message templates
export const SMS = {
  walletDeposit: (name: string, amount: number, balance: number, ref: string) =>
    `Dear ${name}, your wallet has been credited with ${fmt(amount)}. New balance: ${fmt(balance)}. Ref: ${ref}. Thank you for banking with DASNET VENTURES.`,

  // Initiated SMS intentionally removed — we only send ONE confirmation
  // (success or refund) to avoid double-notifying users.

  walletWithdrawalSuccess: (name: string, amount: number, phone: string, receipt: string) =>
    `Dear ${name}, your withdrawal of ${fmt(amount)} to ${phone} was successful. M-Pesa receipt: ${receipt}. Thank you for banking with DASNET VENTURES.`,

  walletWithdrawalFailed: (name: string, amount: number, _reason: string) =>
    `Dear ${name}, we are experiencing delays processing your withdrawal of ${fmt(amount)}. If it is not completed within 30 minutes, the full amount will be refunded to your wallet automatically. — DASNET VENTURES.`,

  // Sent to the SENDER when they push money out to M-Pesa or bank
  walletSendOutSender: (name: string, amount: number, recipient: string, ref: string) =>
    `Dear ${name}, you have sent ${fmt(amount)} to ${recipient}. Reference: ${ref}. Thank you for banking with DASNET VENTURES.`,

  // Sent to the RECEIVING M-Pesa number when a Dasnet user sends them money
  walletSendOutRecipient: (senderName: string, amount: number, ref: string) =>
    `Hello, ${senderName} has sent you ${fmt(amount)} via DASNET VENTURES. Reference: ${ref}. Funds will reflect on M-Pesa shortly.`,

  // Sent to the destination bank-account holder (best-effort if phone provided)
  bankSendOutRecipient: (senderName: string, amount: number, bank: string, account: string, ref: string) =>
    `Hello, ${senderName} has sent you ${fmt(amount)} to your ${bank} account ${account} via DASNET VENTURES. Reference: ${ref}.`,

  // Money request notifications
  moneyRequestReceived: (name: string, requesterName: string, amount: number) =>
    `Dear ${name}, ${requesterName} has requested ${fmt(amount)} from you on DASNET VENTURES. Open the app to approve or decline.`,

  moneyRequestSent: (name: string, recipientName: string, amount: number) =>
    `Dear ${name}, your request for ${fmt(amount)} from ${recipientName} has been sent. You'll be notified when they respond. — DASNET VENTURES.`,

  walletWithdrawalRefunded: (name: string, amount: number) =>
    `Dear ${name}, your withdrawal of ${fmt(amount)} could not be completed and has been refunded to your wallet. — DASNET VENTURES.`,

  loanRepayment: (name: string, amount: number, totalPaid: number, balance: number) =>
    `Dear ${name}, your loan repayment of ${fmt(amount)} has been received. Total paid: ${fmt(totalPaid)}. Balance: ${fmt(balance)}. Thank you for banking with DASNET VENTURES.`,

  loanDisbursed: (name: string, amount: number) =>
    `Dear ${name}, your loan of ${fmt(amount)} has been disbursed to your wallet. Thank you for banking with DASNET VENTURES.`,

  personalSavings: (name: string, amount: number, total: number, goal: string) =>
    `Dear ${name}, your savings of ${fmt(amount)} for "${goal}" has been recorded. Total saved: ${fmt(total)}. Thank you for banking with DASNET VENTURES.`,

  chamaContribution: (name: string, amount: number, group: string, total: number) =>
    `Dear ${name}, your contribution of ${fmt(amount)} to ${group} has been received. Your total savings: ${fmt(total)}. Thank you for banking with DASNET VENTURES.`,

  harambeeContribution: (name: string, amount: number, beneficiary: string) =>
    `Dear ${name}, thank you for contributing ${fmt(amount)} to the harambee for ${beneficiary}. May God bless your generosity. — DASNET VENTURES.`,

  walletTransferOut: (name: string, amount: number, recipient: string, balance: number) =>
    `Dear ${name}, you have sent ${fmt(amount)} to ${recipient}. New wallet balance: ${fmt(balance)}.`,

  walletTransferIn: (name: string, amount: number, sender: string, balance: number) =>
    `Dear ${name}, you have received ${fmt(amount)} from ${sender}. New wallet balance: ${fmt(balance)}.`,

  passwordResetOtp: (name: string, code: string) =>
    `Dear ${name}, your DASNET VENTURES password reset code is ${code}. It expires in 10 minutes. Do not share this code with anyone.`,

  loginNewDevice: (name: string) =>
    `Dear ${name}, a new login to your DASNET VENTURES account was just detected. If this wasn't you, reset your password immediately.`,

  pinSetup: (name: string) =>
    `Dear ${name}, your DASNET VENTURES login PIN has been set successfully. If you did not authorize this, contact support immediately.`,
};
