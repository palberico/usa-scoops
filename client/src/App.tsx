import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import CustomerPortal from "@/pages/customer-portal";
import BookService from "@/pages/book-service";
import TechnicianPortal from "@/pages/technician-portal";
import TechnicianProfilePage from "@/pages/technician-profile";
import AdminDashboard from "@/pages/admin-dashboard";
import AboutPage from "@/pages/about";
import TechnicianProfileView from "@/pages/technician-profile-view";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/about" component={AboutPage} />
      <Route path="/technicians/:uid" component={TechnicianProfileView} />

      {/* Protected Routes */}
      <Route path="/portal">
        <ProtectedRoute allowedRoles={['customer']}>
          <CustomerPortal />
        </ProtectedRoute>
      </Route>

      <Route path="/portal/book">
        <ProtectedRoute allowedRoles={['customer']}>
          <BookService />
        </ProtectedRoute>
      </Route>

      <Route path="/tech">
        <ProtectedRoute allowedRoles={['technician', 'admin']}>
          <TechnicianPortal />
        </ProtectedRoute>
      </Route>

      <Route path="/tech/profile">
        <ProtectedRoute allowedRoles={['technician', 'admin']}>
          <TechnicianProfilePage />
        </ProtectedRoute>
      </Route>

      <Route path="/admin">
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      </Route>

      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
