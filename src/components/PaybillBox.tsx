// Reusable Paybill instructions box for deposit/payment dialogs.
// Shows Paybill 4018275 + the purpose-specific Account Reference so users
// (or someone paying on their behalf) can pay directly from M-Pesa menu
// when STK push fails or isn't available.
import { Copy, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PaybillBoxProps {
  accountRef: string | null | undefined;
  /** Optional context line shown above the instructions */
  helperText?: string;
  /** Compact (smaller padding) for inline use inside dialogs */
  compact?: boolean;
}

export const PAYBILL_NUMBER = "4018275";

export const PaybillBox = ({ accountRef, helperText, compact = false }: PaybillBoxProps) => {
  const { toast } = useToast();
  const copy = (val: string) => {
    navigator.clipboard.writeText(val);
    toast({ title: "Copied", description: val });
  };

  const ref = accountRef || "—";
  const padding = compact ? "p-3" : "p-4";

  return (
    <div className={`rounded-xl border border-accent/30 bg-accent/5 ${padding} space-y-3`}>
      {helperText && <p className="text-[11px] text-muted-foreground">{helperText}</p>}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            Paybill
          </p>
          <p className="text-xl font-bold text-accent tracking-wider">{PAYBILL_NUMBER}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-[11px]"
          onClick={() => copy(PAYBILL_NUMBER)}
        >
          <Copy size={12} /> Copy
        </Button>
      </div>

      <div className="border-t border-accent/20 pt-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            Account No.
          </p>
          <p className="text-xl font-bold text-foreground tracking-wider break-all">{ref}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-[11px]"
          onClick={() => accountRef && copy(accountRef)}
          disabled={!accountRef}
        >
          <Copy size={12} /> Copy
        </Button>
      </div>

      <ol className="space-y-1 text-[11px] text-muted-foreground list-decimal pl-4">
        <li>M-Pesa → <span className="text-foreground font-semibold">Lipa na M-Pesa → Pay Bill</span></li>
        <li>Business No: <span className="font-bold text-accent">{PAYBILL_NUMBER}</span></li>
        <li>Account No: <span className="font-bold text-accent">{ref}</span></li>
        <li>Enter amount + M-Pesa PIN → credited within seconds ✨</li>
      </ol>

      <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
        <Info size={12} className="text-accent mt-0.5 shrink-0" />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Use this if STK push fails, or share with someone paying on your behalf.
        </p>
      </div>
    </div>
  );
};
