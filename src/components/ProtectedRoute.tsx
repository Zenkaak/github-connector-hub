import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireVerified?: boolean;
  requireActive?: boolean;
  requireAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requireVerified = true,
  requireActive = false,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { user, profile, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(213_72%_18%_/_0.03),_transparent_60%)]" />
        <div className="relative z-10 flex flex-col items-center gap-5">
          <Logo size="lg" />
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-sm text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requireActive && profile && !profile.is_active) {
    // Allow access but show activation prompt in dashboard
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
