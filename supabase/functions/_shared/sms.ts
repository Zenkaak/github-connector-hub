// Africa's Talking SMS helper — sends professional transaction notifications.
// Requires AT_USERNAME and AT_API_KEY secrets.

const AT_API_URL = "https://api.africastalking.com/version1/messaging";

function normalizePhone(phone: string): string | null {
  let p = String(phone || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7") || p.startsWith("1")) p = "254" + p;
  if (!/^254[17]\d{8}$/.test(p)) return null;
  return "+" + p;
}

export async function sendSMS(phone: string, message: string, senderId?: string): Promise<{ ok: boolean; error?: string }> {
  const username = Deno.env.get("AT_USERNAME");
  const apiKey = Deno.env.get("AT_API_KEY");
  if (!username || !apiKey) {
    console.warn("[SMS] AT_USERNAME / AT_API_KEY not configured — skipping SMS");
    return { ok: false, error: "AT credentials missing" };
  }

  const to = normalizePhone(phone);
  if (!to) return { ok: false, error: `Invalid phone: ${phone}` };

  const body = new URLSearchParams({
    username,
    to,
    message: message.slice(0, 480), // safety cap
    ...(senderId ? { from: senderId } : {}),
  });

  try {
    const res = await fetch(AT_API_URL, {
      method: "POST",
      headers: {
        apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
    const data = await res.json().catch(() => ({}));
    const recipient = data?.SMSMessageData?.Recipients?.[0];
    if (recipient?.status === "Success") {
      console.log(`[SMS] sent to ${to}: ${recipient.messageId}`);
      return { ok: true };
    }
    console.error("[SMS] failed:", JSON.stringify(data));
    return { ok: false, error: recipient?.status || "AT rejected" };
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
    `Dear ${name}, your wallet has been credited with ${fmt(amount)}. New balance: ${fmt(balance)}. Ref: ${ref}. Thank you for banking with Dasnet.`,

  walletWithdrawalInitiated: (name: string, amount: number, phone: string) =>
    `Dear ${name}, your withdrawal of ${fmt(amount)} to ${phone} is being processed. You will receive your funds shortly.`,

  walletWithdrawalSuccess: (name: string, amount: number, phone: string, receipt: string) =>
    `Dear ${name}, your withdrawal of ${fmt(amount)} to ${phone} was successful. M-Pesa receipt: ${receipt}. Thank you for banking with Dasnet.`,

  walletWithdrawalFailed: (name: string, amount: number, reason: string) =>
    `Dear ${name}, your withdrawal of ${fmt(amount)} could not be completed (${reason}). The amount has been refunded to your wallet.`,

  loanRepayment: (name: string, amount: number, totalPaid: number, balance: number) =>
    `Dear ${name}, your loan repayment of ${fmt(amount)} has been received. Total paid: ${fmt(totalPaid)}. Balance: ${fmt(balance)}. Thank you for banking with Dasnet.`,

  loanDisbursed: (name: string, amount: number) =>
    `Dear ${name}, your loan of ${fmt(amount)} has been disbursed to your wallet. Thank you for banking with Dasnet.`,

  personalSavings: (name: string, amount: number, total: number, goal: string) =>
    `Dear ${name}, your savings of ${fmt(amount)} for "${goal}" has been recorded. Total saved: ${fmt(total)}. Thank you for banking with Dasnet.`,

  chamaContribution: (name: string, amount: number, group: string, total: number) =>
    `Dear ${name}, your contribution of ${fmt(amount)} to ${group} has been received. Your total savings: ${fmt(total)}. Thank you for banking with Dasnet.`,

  harambeeContribution: (name: string, amount: number, beneficiary: string) =>
    `Dear ${name}, thank you for contributing ${fmt(amount)} to the harambee for ${beneficiary}. May God bless your generosity. — Dasnet.`,

  walletTransferOut: (name: string, amount: number, recipient: string, balance: number) =>
    `Dear ${name}, you have sent ${fmt(amount)} to ${recipient}. New wallet balance: ${fmt(balance)}.`,

  walletTransferIn: (name: string, amount: number, sender: string, balance: number) =>
    `Dear ${name}, you have received ${fmt(amount)} from ${sender}. New wallet balance: ${fmt(balance)}.`,
};
