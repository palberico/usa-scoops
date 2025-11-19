import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function Login() {
  const [, setLocation] = useLocation();
  const { signIn, role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // ============================================================
  // FORGOT PASSWORD STATE
  // These state variables control the forgot password dialog
  // ============================================================
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(formData.email, formData.password);
      
      toast({
        title: 'Success',
        description: 'Logged in successfully',
      });

      // Redirect based on role (will be set by useAuth after sign in)
      // We'll use a timeout to allow the auth state to update
      setTimeout(() => {
        if (role === 'admin') {
          setLocation('/admin');
        } else if (role === 'technician') {
          setLocation('/tech');
        } else {
          setLocation('/portal');
        }
      }, 500);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to log in. Please check your credentials.',
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FORGOT PASSWORD HANDLER
  // This function is called when the user submits the forgot password form
  // It calls Firebase's sendPasswordResetEmail to send a reset link to the user's email
  // ============================================================
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError('');
    setResetSuccess(false);

    try {
      // Send password reset email using Firebase Auth
      await sendPasswordResetEmail(auth, resetEmail);
      
      setResetSuccess(true);
      
      // Show success toast
      toast({
        title: 'Reset link sent',
        description: 'If an account exists for that email, a reset link has been sent.',
      });

      // Reset form and close dialog after 2 seconds
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetEmail('');
        setResetSuccess(false);
      }, 2000);
    } catch (error: any) {
      // Handle different Firebase error codes
      // To customize these messages, edit the strings below
      let errorMessage = 'Failed to send reset email. Please try again.';
      
      if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/user-not-found') {
        // For security, we show the same message as success
        errorMessage = 'If an account exists for that email, a reset link has been sent.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      }
      
      setResetError(errorMessage);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          {/* Logo - same size as home page */}
          <div className="flex justify-center mb-6">
            <div className="inline-block rounded-full bg-white p-1">
              <img 
                src="/logo-full.png" 
                alt="USA Scoops" 
                className="h-40 sm:h-48 md:h-56 lg:h-64 w-auto"
                data-testid="logo-image"
              />
            </div>
          </div>
          <CardTitle className="text-2xl" data-testid="heading-login">Sign In</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  data-testid="input-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="button-submit-login"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* ============================================================
              FORGOT PASSWORD LINK
              This link appears below the login button and opens the password reset modal
              ============================================================ */}
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
              data-testid="link-forgot-password"
            >
              Forgot password?
            </button>
          </div>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <a href="/signup" className="text-primary hover:underline">
              Sign up
            </a>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================
          FORGOT PASSWORD MODAL
          This dialog appears when the user clicks "Forgot password?"
          It contains a form with an email input and a submit button
          ============================================================ */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent data-testid="dialog-forgot-password">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePasswordReset}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="you@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  disabled={resetLoading || resetSuccess}
                  data-testid="input-reset-email"
                />
              </div>

              {/* Success message - To customize, edit the text below */}
              {resetSuccess && (
                <div className="text-sm text-green-600 dark:text-green-400" data-testid="text-reset-success">
                  If an account exists for that email, a reset link has been sent.
                </div>
              )}

              {/* Error message - To customize, edit the errorMessage strings in handlePasswordReset */}
              {resetError && (
                <div className="text-sm text-destructive" data-testid="text-reset-error">
                  {resetError}
                </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail('');
                  setResetError('');
                  setResetSuccess(false);
                }}
                disabled={resetLoading}
                data-testid="button-cancel-reset"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={resetLoading || resetSuccess}
                data-testid="button-send-reset"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : resetSuccess ? (
                  'Sent!'
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
