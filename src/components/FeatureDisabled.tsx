import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface FeatureDisabledProps {
  title?: string;
  message?: string;
}

export function FeatureDisabled({ 
  title = 'Feature Unavailable', 
  message = 'This feature is currently disabled by the administrator. Please check back later or contact support.'
}: FeatureDisabledProps) {
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardContent className="p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertTriangle size={24} className="text-destructive" />
        </div>
        <h3 className="font-display font-bold text-lg mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{message}</p>
      </CardContent>
    </Card>
  );
}
