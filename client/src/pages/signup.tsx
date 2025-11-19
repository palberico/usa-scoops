import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Home, Eye, EyeOff, Sparkles } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { calculateQuote, DEFAULT_PRICING } from '@shared/types';
import BookingWizard from '@/components/BookingWizard';

// Helper function to format phone number as XXX-XXX-XXXX
const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Limit to 10 digits
  const limited = digits.slice(0, 10);
  
  // Format as XXX-XXX-XXXX
  if (limited.length <= 3) {
    return limited;
  } else if (limited.length <= 6) {
    return `${limited.slice(0, 3)}-${limited.slice(3)}`;
  } else {
    return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
  }
};

// Wrapper component for BookingWizard during signup
function BookingStep({ 
  zip, 
  dogCount, 
  onComplete, 
  onCancel 
}: { 
  zip: string; 
  dogCount: number; 
  onComplete: () => void; 
  onCancel: () => void;
}) {
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      if (currentUser) {
        setCustomerId(currentUser.uid);
      }
    };
    getCurrentUser();
  }, []);

  if (!customerId) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <BookingWizard
      customerId={customerId}
      customerData={{
        zip,
        dog_count: dogCount,
      }}
      onComplete={onComplete}
      onCancel={onCancel}
      showPaymentStep={true}
    />
  );
}

export default function Signup() {
  const [, setLocation] = useLocation();
  const { signUp } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [showPriceQuoteModal, setShowPriceQuoteModal] = useState(false);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  
  const [waitlistData, setWaitlistData] = useState({
    name: '',
    email: '',
  });
  
  const [formData, setFormData] = useState({
    // Step 1: Zip only
    zip: '',
    // Step 2: Account creation
    name: '',
    email: '',
    password: '',
    // Step 3: Dog information
    dog_count: 1,
    dog_names: [''] as string[],
    // Step 4: Property Information
    phone: '',
    street: '',
    city: '',
    state: 'UT',
    gate_code: '',
    notes: '',
  });

  // Fetch pricing on component mount
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const pricingSnapshot = await getDocs(collection(db, 'pricing'));
        if (!pricingSnapshot.empty) {
          const data = pricingSnapshot.docs[0].data();
          setPricing({
            recurring_base: data.recurring_base || DEFAULT_PRICING.recurring_base,
            recurring_additional: data.recurring_additional || DEFAULT_PRICING.recurring_additional,
            onetime_base: data.onetime_base || DEFAULT_PRICING.onetime_base,
            onetime_additional: data.onetime_additional || DEFAULT_PRICING.onetime_additional,
          });
        }
      } catch (error) {
        console.error('Error fetching pricing:', error);
        // Use default pricing if fetch fails
      }
    };
    fetchPricing();
  }, []);

  // Step 1: Validate Zip Code (no account creation yet)
  const handleZipCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const zipsRef = collection(db, 'service_zips');
      const q = query(zipsRef, where('zip', '==', formData.zip), where('active', '==', true));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Not in service area - show waitlist modal
        setShowWaitlistModal(true);
      } else {
        // In service area - show success modal
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to validate zip code',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle modal continue - move to account creation
  const handleModalContinue = () => {
    setShowSuccessModal(false);
    setStep(2);
  };

  // Handle "Maybe Later" button - close modal and go home
  const handleMaybeLater = () => {
    setShowWaitlistModal(false);
    setShowWaitlistForm(false);
    setLocation('/');
  };

  // Handle "Join Waitlist" button - show form
  const handleJoinWaitlistClick = () => {
    setShowWaitlistForm(true);
  };

  // Waitlist Submission
  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!waitlistData.name || !waitlistData.email) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please enter your name and email to join the waitlist.',
      });
      return;
    }
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'waitlist'), {
        name: waitlistData.name,
        email: waitlistData.email,
        zip: formData.zip,
        created_at: serverTimestamp(),
      });

      toast({
        title: 'Added to Waitlist!',
        description: 'We\'ll notify you when we expand to your area!',
      });

      // Close modal and redirect to home
      setShowWaitlistModal(false);
      setShowWaitlistForm(false);
      setTimeout(() => setLocation('/'), 1500);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add to waitlist',
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Create Account (name, email, password)
  const handleAccountCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create Firebase auth account and customer document
      await signUp(formData.email, formData.password, {
        name: formData.name,
        address: {
          street: '',
          city: '',
          state: '',
          zip: formData.zip,
          gate_code: '',
          notes: ''
        },
        phone: '',
        dog_count: 0,
      });

      toast({
        title: 'Account Created!',
        description: 'Welcome to USA Scoops',
      });

      setStep(3); // Move to "Your Information" step
    } catch (error: any) {
      console.error('Account creation error:', error);
      
      // Handle specific Firebase auth errors
      let errorMessage = error.message || 'Failed to create account';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please login instead.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }
      
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Dog Information
  const handleDogInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get current user
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated. Please refresh and try again.');
      }

      // Update customer document with dog information
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'customers', currentUser.uid), {
        dog_count: formData.dog_count,
        dog_names: formData.dog_names.filter(name => name.trim() !== ''),
        updated_at: serverTimestamp(),
      });

      // Show price quote modal after saving dog info
      setShowPriceQuoteModal(true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save dog information',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler to continue from price quote modal to property information
  const handlePriceQuoteConfirm = () => {
    setShowPriceQuoteModal(false);
    setStep(4); // Move to property information step
  };

  // Step 4: Property Information (address, phone)
  const handleInformationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate state is selected
    if (!formData.state) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a state.',
      });
      return;
    }
    
    setLoading(true);

    try {
      // Get current user
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated. Please refresh and try again.');
      }

      // Update customer document with property information
      await updateDoc(doc(db, 'customers', currentUser.uid), {
        phone: formData.phone,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          gate_code: formData.gate_code || '',
          notes: formData.notes || ''
        },
        updated_at: serverTimestamp(),
      });

      setStep(5); // Move to booking (now handled by BookingWizard)
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save information',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle booking completion - redirect to portal
  const handleBookingComplete = () => {
    setLocation('/portal');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-8 bg-background">
      {/* Logo */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2">
        <img src="/logo-full.png" alt="USA Scoops" className="h-40 sm:h-48 md:h-56 lg:h-64 w-auto" data-testid="img-logo" />
      </div>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md" data-testid="modal-zip-success">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">Yay! You're in our service area!</DialogTitle>
            <DialogDescription className="text-center text-base">
              Create an account to get a quote and book your first service.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={handleModalContinue} className="w-full" data-testid="button-modal-continue">
            Continue to Create Account
          </Button>
        </DialogContent>
      </Dialog>

      {/* Price Quote Modal (After Dog Info) */}
      <Dialog open={showPriceQuoteModal} onOpenChange={setShowPriceQuoteModal}>
        <DialogContent className="sm:max-w-md" data-testid="modal-price-quote">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">Your Service Quote</DialogTitle>
            <DialogDescription className="text-center text-base">
              Based on the number of dogs you have
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">Number of Dogs</h3>
              <p className="text-base" data-testid="text-price-quote-dogs">
                {formData.dog_count} dog{formData.dog_count > 1 ? 's' : ''}
              </p>
              {formData.dog_names.filter(name => name.trim() !== '').length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {formData.dog_names.filter(name => name.trim() !== '').join(', ')}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">Service Price</h3>
              <p className="text-2xl font-bold text-primary" data-testid="text-price-quote-amount">
                ${calculateQuote(formData.dog_count, true, pricing)}
              </p>
              <p className="text-xs text-muted-foreground">Per service</p>
            </div>
          </div>

          <Button 
            onClick={handlePriceQuoteConfirm}
            className="w-full"
            data-testid="button-continue-from-quote"
          >
            Continue
          </Button>
        </DialogContent>
      </Dialog>


      {/* Waitlist Modal */}
      <Dialog open={showWaitlistModal} onOpenChange={setShowWaitlistModal}>
        <DialogContent className="sm:max-w-md" data-testid="modal-waitlist">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">That's ruff!</DialogTitle>
            <DialogDescription className="text-center text-base font-semibold text-foreground mb-2">
              Service area is not yet available
            </DialogDescription>
            <DialogDescription className="text-center text-base">
              We're not in your area yet, but we're expanding! Join our waitlist to be notified when we arrive.
            </DialogDescription>
          </DialogHeader>
          
          {!showWaitlistForm ? (
            <div className="flex flex-col gap-3 mt-4">
              <Button 
                onClick={handleJoinWaitlistClick} 
                className="w-full"
                data-testid="button-join-waitlist"
              >
                Join Waitlist
              </Button>
              <Button 
                onClick={handleMaybeLater} 
                variant="outline"
                className="w-full"
                data-testid="button-maybe-later"
              >
                Maybe Later
              </Button>
            </div>
          ) : (
            <form onSubmit={handleWaitlistSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="waitlist-name">Name</Label>
                <Input
                  id="waitlist-name"
                  value={waitlistData.name}
                  onChange={(e) => setWaitlistData({ ...waitlistData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                  data-testid="input-waitlist-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="waitlist-email">Email</Label>
                <Input
                  id="waitlist-email"
                  type="email"
                  value={waitlistData.email}
                  onChange={(e) => setWaitlistData({ ...waitlistData, email: e.target.value })}
                  placeholder="john@example.com"
                  required
                  data-testid="input-waitlist-email"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loading}
                  data-testid="button-submit-waitlist"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Submit'
                  )}
                </Button>
                <Button 
                  type="button"
                  onClick={() => setShowWaitlistForm(false)} 
                  variant="ghost"
                  className="w-full"
                  data-testid="button-cancel-waitlist"
                >
                  Back
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card className="w-full max-w-2xl mt-48 sm:mt-56 md:mt-64 lg:mt-72">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold" data-testid="heading-signup">
            {step === 1 && 'Check Service Area'}
            {step === 2 && 'Create Your Account'}
            {step === 3 && `Welcome ${formData.name}!`}
            {step === 4 && 'Tell Us About Your Property'}
            {step === 5 && 'Complete Your Booking'}
          </CardTitle>
          <CardDescription className="text-base">
            {step === 1 && 'See if we service your area'}
            {step === 2 && 'Set up your account to get started'}
            {step === 3 && 'Tell us about your dog'}
            {step === 4 && 'Tell us about your property'}
            {step === 5 && 'Select a time and complete payment'}
          </CardDescription>
          
          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className={`h-2 w-10 rounded-full transition-all ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-10 rounded-full transition-all ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-10 rounded-full transition-all ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-10 rounded-full transition-all ${step >= 4 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-10 rounded-full transition-all ${step >= 5 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {/* Step 1: Zip Code Only */}
          {step === 1 && (
            <form onSubmit={handleZipCheck} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="zip" className="text-base">Enter Your Zip Code</Label>
                <Input
                  id="zip"
                  value={formData.zip}
                  onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  maxLength={5}
                  placeholder="12345"
                  required
                  className="h-14 text-2xl text-center font-semibold"
                  data-testid="input-zip"
                />
                <p className="text-sm text-muted-foreground text-center">
                  No account needed yet - just checking if we service your area!
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/')}
                  className="h-12 text-lg"
                  data-testid="button-back-home"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 text-lg"
                  disabled={loading}
                  data-testid="button-check-zip"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <MapPin className="mr-2 h-5 w-5" />
                      Check Service Area
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Step 2: Create Account */}
          {step === 2 && (
            <form onSubmit={handleAccountCreation} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                  data-testid="input-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
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
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
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

              <div className="flex gap-4 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  data-testid="button-back"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading}
                  data-testid="button-create-account"
                >
                  Create Account
                </Button>
              </div>
            </form>
          )}

          {/* Step 3: Dog Information */}
          {step === 3 && (
            <form onSubmit={handleDogInfoSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dog_count">How many dogs do you have?</Label>
                <Input
                  id="dog_count"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.dog_count}
                  onChange={(e) => {
                    const count = parseInt(e.target.value) || 1;
                    setFormData({ 
                      ...formData, 
                      dog_count: count,
                      dog_names: Array(count).fill('').map((_, i) => formData.dog_names[i] || '')
                    });
                  }}
                  required
                  data-testid="input-dog-count"
                  className="h-12 text-lg"
                />
              </div>

              {formData.dog_count > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">Dog Names (Optional)</Label>
                  {Array.from({ length: formData.dog_count }, (_, index) => (
                    <Input
                      key={index}
                      placeholder={`Dog ${index + 1} name`}
                      value={formData.dog_names[index] || ''}
                      onChange={(e) => {
                        const newNames = [...formData.dog_names];
                        newNames[index] = e.target.value;
                        setFormData({ ...formData, dog_names: newNames });
                      }}
                      data-testid={`input-dog-name-${index}`}
                    />
                  ))}
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  data-testid="button-back"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading}
                  data-testid="button-next-dog-info"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Next'
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Step 4: Property Information (Address, Phone) */}
          {step === 4 && (
            <form onSubmit={handleInformationSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })}
                  placeholder="555-123-4567"
                  required
                  data-testid="input-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  required
                  data-testid="input-street"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                    data-testid="input-city"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => setFormData({ ...formData, state: value })}
                    required
                  >
                    <SelectTrigger id="state" data-testid="select-state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AL">Alabama</SelectItem>
                      <SelectItem value="AK">Alaska</SelectItem>
                      <SelectItem value="AZ">Arizona</SelectItem>
                      <SelectItem value="AR">Arkansas</SelectItem>
                      <SelectItem value="CA">California</SelectItem>
                      <SelectItem value="CO">Colorado</SelectItem>
                      <SelectItem value="CT">Connecticut</SelectItem>
                      <SelectItem value="DE">Delaware</SelectItem>
                      <SelectItem value="FL">Florida</SelectItem>
                      <SelectItem value="GA">Georgia</SelectItem>
                      <SelectItem value="HI">Hawaii</SelectItem>
                      <SelectItem value="ID">Idaho</SelectItem>
                      <SelectItem value="IL">Illinois</SelectItem>
                      <SelectItem value="IN">Indiana</SelectItem>
                      <SelectItem value="IA">Iowa</SelectItem>
                      <SelectItem value="KS">Kansas</SelectItem>
                      <SelectItem value="KY">Kentucky</SelectItem>
                      <SelectItem value="LA">Louisiana</SelectItem>
                      <SelectItem value="ME">Maine</SelectItem>
                      <SelectItem value="MD">Maryland</SelectItem>
                      <SelectItem value="MA">Massachusetts</SelectItem>
                      <SelectItem value="MI">Michigan</SelectItem>
                      <SelectItem value="MN">Minnesota</SelectItem>
                      <SelectItem value="MS">Mississippi</SelectItem>
                      <SelectItem value="MO">Missouri</SelectItem>
                      <SelectItem value="MT">Montana</SelectItem>
                      <SelectItem value="NE">Nebraska</SelectItem>
                      <SelectItem value="NV">Nevada</SelectItem>
                      <SelectItem value="NH">New Hampshire</SelectItem>
                      <SelectItem value="NJ">New Jersey</SelectItem>
                      <SelectItem value="NM">New Mexico</SelectItem>
                      <SelectItem value="NY">New York</SelectItem>
                      <SelectItem value="NC">North Carolina</SelectItem>
                      <SelectItem value="ND">North Dakota</SelectItem>
                      <SelectItem value="OH">Ohio</SelectItem>
                      <SelectItem value="OK">Oklahoma</SelectItem>
                      <SelectItem value="OR">Oregon</SelectItem>
                      <SelectItem value="PA">Pennsylvania</SelectItem>
                      <SelectItem value="RI">Rhode Island</SelectItem>
                      <SelectItem value="SC">South Carolina</SelectItem>
                      <SelectItem value="SD">South Dakota</SelectItem>
                      <SelectItem value="TN">Tennessee</SelectItem>
                      <SelectItem value="TX">Texas</SelectItem>
                      <SelectItem value="UT">Utah</SelectItem>
                      <SelectItem value="VT">Vermont</SelectItem>
                      <SelectItem value="VA">Virginia</SelectItem>
                      <SelectItem value="WA">Washington</SelectItem>
                      <SelectItem value="WV">West Virginia</SelectItem>
                      <SelectItem value="WI">Wisconsin</SelectItem>
                      <SelectItem value="WY">Wyoming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gate_code">Gate Code (Optional)</Label>
                <Input
                  id="gate_code"
                  value={formData.gate_code}
                  onChange={(e) => setFormData({ ...formData, gate_code: e.target.value })}
                  data-testid="input-gate-code"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Yard Notes (Optional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g., Dog in backyard, key under mat"
                  data-testid="input-notes"
                />
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(3)}
                  data-testid="button-back"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading}
                  data-testid="button-continue-address"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Continue to Time Selection
                </Button>
              </div>
            </form>
          )}

          {/* Step 5: Booking (Time Selection & Payment) */}
          {step === 5 && (
            <BookingStep
              zip={formData.zip}
              dogCount={formData.dog_count}
              onComplete={handleBookingComplete}
              onCancel={() => setStep(4)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
