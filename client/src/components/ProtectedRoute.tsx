import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect, Route, RouteProps } from "wouter";
import { ReactNode } from "react";

interface ProtectedRouteProps extends RouteProps {
  component: React.ComponentType<any>;
  requireAdmin?: boolean;
}

/**
 * Protected route wrapper that requires authentication
 * Redirects to /login if user is not authenticated
 * Optionally requires admin role
 */
export default function ProtectedRoute({ 
  component: Component, 
  requireAdmin = false,
  ...rest 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  return (
    <Route {...rest}>
      {(params) => {
        // Show loading state while checking auth
        if (loading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          );
        }

        // Redirect to login if not authenticated
        if (!user) {
          return <Redirect to="/login" />;
        }

        // Check admin requirement
        if (requireAdmin && user.role !== 'admin') {
          return <Redirect to="/courses" />;
        }

        // Render the protected component
        return <Component {...params} />;
      }}
    </Route>
  );
}
