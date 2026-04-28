import { useEffect, useRef } from 'react';

interface PinPadProps {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  error?: boolean;
}

/**
 * Numeric PIN input with N boxes. Auto-advances and supports paste.
 * Hidden numeric input drives the visible boxes (works on iOS keyboards).
 */
export function PinPad({ value, onChange, length = 4, autoFocus, disabled, error }: PinPadProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <div
      className="relative flex items-center justify-center gap-2.5 sm:gap-3"
      onClick={() => ref.current?.focus()}
    >
      <input
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, length);
          onChange(digits);
        }}
        disabled={disabled}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
      />
      {Array.from({ length }).map((_, i) => {
        const filled = i < value.length;
        const active = i === value.length;
        return (
          <div
            key={i}
            className={`
              w-12 h-14 sm:w-14 sm:h-16 rounded-2xl border-2 flex items-center justify-center
              text-2xl font-bold tabular-nums transition-all
              ${error ? 'border-destructive bg-destructive/5' :
                filled ? 'border-accent bg-accent/10 text-foreground' :
                active ? 'border-accent/60 bg-card' : 'border-border bg-card'}
              ${disabled ? 'opacity-50' : ''}
            `}
          >
            {filled ? '•' : ''}
          </div>
        );
      })}
    </div>
  );
}
