import { useState } from 'react';
import { Calculator, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

export function LoanCalculator() {
  const [amount, setAmount] = useState(10000);
  const [months, setMonths] = useState(6);
  const interestRate = 12; // 12% annual

  const monthlyRate = interestRate / 100 / 12;
  const monthlyPayment =
    monthlyRate > 0
      ? (amount * monthlyRate * Math.pow(1 + monthlyRate, months)) /
        (Math.pow(1 + monthlyRate, months) - 1)
      : amount / months;
  const totalPayment = monthlyPayment * months;
  const totalInterest = totalPayment - amount;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(val);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator size={18} className="text-accent" />
          Loan Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Loan Amount</Label>
            <span className="text-sm font-bold text-accent">{formatCurrency(amount)}</span>
          </div>
          <Slider
            value={[amount]}
            onValueChange={([v]) => setAmount(v)}
            min={1000}
            max={100000}
            step={1000}
            className="mt-1"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">KES 1,000</span>
            <span className="text-[10px] text-muted-foreground">KES 100,000</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Repayment Period</Label>
            <span className="text-sm font-bold text-accent">{months} months</span>
          </div>
          <Slider
            value={[months]}
            onValueChange={([v]) => setMonths(v)}
            min={1}
            max={24}
            step={1}
            className="mt-1"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">1 month</span>
            <span className="text-[10px] text-muted-foreground">24 months</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          {[
            { label: 'Monthly', value: formatCurrency(monthlyPayment) },
            { label: 'Total Interest', value: formatCurrency(totalInterest) },
            { label: 'Total Payable', value: formatCurrency(totalPayment) },
          ].map((item, i) => (
            <div key={i} className="p-3 rounded-xl bg-muted/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{item.label}</p>
              <p className="font-bold text-sm">{item.value}</p>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground/60 text-center">
          *Estimates at {interestRate}% p.a. Actual rates may vary.
        </p>
      </CardContent>
    </Card>
  );
}
