import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: Array<'customer' | 'technician' | 'admin'>;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-auth" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (role && !allowedRoles.includes(role)) {
    // Redirect to appropriate portal based on their actual role
    if (role === 'customer') return <Redirect to="/portal" />;
    if (role === 'technician') return <Redirect to="/tech" />;
    if (role === 'admin') return <Redirect to="/admin" />;
  }

  return <>{children}</>;
}
