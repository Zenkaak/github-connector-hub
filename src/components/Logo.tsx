import { Star } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'white';
}

export function Logo({ size = 'md', variant = 'default' }: LogoProps) {
  const sizes = {
    sm: { icon: 18, text: 'text-base', gap: 'gap-1.5' },
    md: { icon: 24, text: 'text-lg', gap: 'gap-2' },
    lg: { icon: 30, text: 'text-xl', gap: 'gap-2.5' },
  };

  const colors = {
    default: {
      iconBg: 'bg-accent/10',
      icon: 'text-accent',
      text: 'text-foreground',
      subtext: 'text-muted-foreground',
    },
    white: {
      iconBg: 'bg-white/10',
      icon: 'text-accent',
      text: 'text-white',
      subtext: 'text-white/60',
    },
  };

  return (
    <div className={`flex items-center ${sizes[size].gap}`}>
      <div className={`relative w-9 h-9 rounded-xl ${colors[variant].iconBg} flex items-center justify-center`}>
        <Star
          size={sizes[size].icon}
          className={`${colors[variant].icon} fill-current`}
          strokeWidth={1.5}
        />
      </div>
      <div className="flex flex-col">
        <span className={`font-display font-bold ${sizes[size].text} ${colors[variant].text} leading-tight tracking-tight`}>
          Dasnet
        </span>
        <span className={`text-[10px] font-medium ${colors[variant].subtext} -mt-0.5 uppercase tracking-widest`}>
          Ventures
        </span>
      </div>
    </div>
  );
}
