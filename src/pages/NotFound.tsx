import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowLeft, Home } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(213_72%_18%_/_0.03),_transparent_60%)]" />

      <div className="relative z-10 text-center max-w-md">
        <div className="mb-8">
          <Logo size="md" />
        </div>

        <div className="mb-6">
          <span className="font-display text-8xl font-bold bg-gradient-to-b from-primary to-primary/30 bg-clip-text text-transparent">
            404
          </span>
        </div>

        <h1 className="font-display text-2xl font-bold mb-3">Page Not Found</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved. Let's get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/">
            <Button variant="gold" size="lg">
              <Home size={16} />
              Go Home
            </Button>
          </Link>
          <Button variant="outline" size="lg" onClick={() => window.history.back()}>
            <ArrowLeft size={16} />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
