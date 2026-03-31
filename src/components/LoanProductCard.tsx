import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoanProduct } from '@/lib/loan-products';
import { ArrowRight, Check } from 'lucide-react';

interface LoanProductCardProps {
  product: LoanProduct;
  onApply: (product: LoanProduct) => void;
  disabled?: boolean;
}

export function LoanProductCard({ product, onApply, disabled }: LoanProductCardProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="premium-card h-full flex flex-col overflow-hidden">
      <div className="p-6 flex-1">
        <div className="flex items-start justify-between mb-5">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-2xl">
            {product.icon}
          </div>
          <span className="text-xs font-bold text-accent bg-accent/10 px-3 py-1.5 rounded-full">
            {product.interestRate}% p.a.
          </span>
        </div>
        <h3 className="font-display font-bold text-lg mb-2">{product.name}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          {product.description}
        </p>

        <div className="space-y-2.5 flex-1">
          <div className="flex justify-between text-sm py-2 border-b border-border/50">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-semibold text-xs">
              {formatCurrency(product.minAmount)} – {formatCurrency(product.maxAmount)}
            </span>
          </div>
          <div className="flex justify-between text-sm py-2 border-b border-border/50">
            <span className="text-muted-foreground">Term</span>
            <span className="font-semibold text-xs">{product.term}</span>
          </div>

          <div className="pt-3">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-2.5">Key Features</p>
            <ul className="space-y-2">
              {product.features.slice(0, 3).map((feature, index) => (
                <li key={index} className="flex items-start gap-2.5 text-sm">
                  <Check size={14} className="text-success mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 bg-muted/30 border-t border-border/50">
        <Button
          variant="gold"
          className="w-full shadow-gold"
          onClick={() => onApply(product)}
          disabled={disabled}
        >
          Apply Now
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
