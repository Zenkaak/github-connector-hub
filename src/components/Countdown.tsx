import { useState, useEffect } from 'react';

interface CountdownProps {
  duration: number; // in seconds
  onComplete?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function Countdown({ duration, onComplete, size = 'md' }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0) {
      setIsComplete(true);
      onComplete?.();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onComplete]);

  const sizes = {
    sm: { container: 'w-20 h-20', text: 'text-2xl', stroke: 4 },
    md: { container: 'w-32 h-32', text: 'text-4xl', stroke: 6 },
    lg: { container: 'w-40 h-40', text: 'text-5xl', stroke: 8 },
  };

  const circumference = 2 * Math.PI * 45;
  const progress = ((duration - timeLeft) / duration) * circumference;

  if (isComplete) {
    return (
      <div className={`${sizes[size].container} flex items-center justify-center`}>
        <div className="w-full h-full rounded-full bg-success/10 flex items-center justify-center animate-scale-in">
          <span className="text-success text-4xl">✓</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${sizes[size].container} relative`}>
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={sizes[size].stroke}
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth={sizes[size].stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-display font-bold ${sizes[size].text} text-primary`}>
          {timeLeft}
        </span>
      </div>
    </div>
  );
}
