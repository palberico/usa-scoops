import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, MapPin, Home, Dog, Eye, EyeOff, Sparkles } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, doc, getDoc, runTransaction, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { calculateQuote, getDayName, calculateNextServiceDate } from '@shared/types';
import type { Slot } from '@shared/types';
import { format, parse } from 'date-fns';

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
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  
  const [waitlistData, setWaitlistData] = useState({
    name: '',
    email: '',
  });
  
  const [paymentData, setPaymentData] = useState({
    cardholderName: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
    billingZip: '',
  });
  
  const [formData, setFormData] = useState({
    // Step 1: Zip only
    zip: '',
    // Step 2: Account creation
    name: '',
    email: '',
    password: '',
    // Step 3: Your Information
    phone: '',
    street: '',
    city: '',
    state: '',
    gate_code: '',
    notes: '',
    dog_count: 1,
  });

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

  // Step 3: Your Information (address, phone, dog count)
  const handleInformationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get current user
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated. Please refresh and try again.');
      }

      // Update customer document with additional information
      const { updateDoc } = await import('firebase/firestore');
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
        dog_count: formData.dog_count,
        updated_at: serverTimestamp(),
      });

      setStep(4); // Move to time slot selection
      
      // Load available slots filtered by customer's zip
      const slotsRef = collection(db, 'slots');
      const q = query(slotsRef, where('zip', '==', formData.zip));
      const snapshot = await getDocs(q);
      
      const slots: Slot[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.booked_count < data.capacity) {
          slots.push({ ...data, id: doc.id } as Slot);
        }
      });

      // Sort: recurring first, then by date
      slots.sort((a, b) => {
        if (a.is_recurring && !b.is_recurring) return -1;
        if (!a.is_recurring && b.is_recurring) return 1;
        if (!a.is_recurring && !b.is_recurring) {
          return a.date.localeCompare(b.date);
        }
        return 0;
      });
      
      setAvailableSlots(slots);
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

  // Step 4: Show Quote Modal
  const handleBooking = () => {
    if (!selectedSlot) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a time slot',
      });
      return;
    }

    // Show quote modal
    setShowQuoteModal(true);
  };

  // Handle going back to time selection from quote modal
  const handleGoBack = () => {
    setShowQuoteModal(false);
  };

  // Handle confirm and pay - move to payment step
  const handleConfirmAndPay = () => {
    setShowQuoteModal(false);
    setStep(5); // Move to payment step
  };

  // Step 5: Complete Booking After Payment
  const handleCompleteBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSlot) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a time slot',
      });
      return;
    }

    setLoading(true);
    try {
      // Get current user (already authenticated from step 2)
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated. Please go back and create your account.');
      }

      // Book the slot using a transaction
      const slotRef = doc(db, 'slots', selectedSlot.id);
      const visitRef = collection(db, 'visits');

      await runTransaction(db, async (transaction) => {
        const slotDoc = await transaction.get(slotRef);
        if (!slotDoc.exists()) {
          throw new Error('Slot no longer exists');
        }

        const slotData = slotDoc.data();
        if (slotData.booked_count >= slotData.capacity) {
          throw new Error('Slot is full');
        }

        // For recurring slots, create 24 weeks of visits (6 months)
        // For one-time slots, create 1 visit
        const visitsToCreate = selectedSlot.is_recurring ? 24 : 1;
        const recurringGroupId = selectedSlot.is_recurring ? crypto.randomUUID() : undefined;

        for (let i = 0; i < visitsToCreate; i++) {
          let scheduledDate: Date;
          
          if (selectedSlot.is_recurring) {
            // Calculate the next occurrence for each week
            const firstDate = calculateNextServiceDate(selectedSlot.day_of_week || 0, selectedSlot.window_start);
            scheduledDate = new Date(firstDate);
            scheduledDate.setDate(firstDate.getDate() + (i * 7)); // Add weeks
          } else {
            // For one-time slots, parse date and time using date-fns
            const dateTimeString = `${selectedSlot.date} ${selectedSlot.window_start}`;
            scheduledDate = parse(dateTimeString, 'yyyy-MM-dd HH:mm', new Date());
            
            // Validate the date is valid
            if (isNaN(scheduledDate.getTime())) {
              console.error('Invalid date:', {
                date: selectedSlot.date,
                time: selectedSlot.window_start,
                combined: dateTimeString,
              });
              throw new Error(`Invalid slot date/time format: ${dateTimeString}`);
            }
          }
          
          const visitData: any = {
            customer_uid: currentUser.uid,
            slot_id: selectedSlot.id,
            scheduled_for: Timestamp.fromDate(scheduledDate),
            status: 'scheduled',
            notes: '',
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
          };
          
          // Add recurring information if applicable
          if (selectedSlot.is_recurring) {
            visitData.is_recurring = true;
            visitData.recurring_group_id = recurringGroupId;
            visitData.recurring_day_of_week = selectedSlot.day_of_week;
            visitData.recurring_window_start = selectedSlot.window_start;
            visitData.recurring_window_end = selectedSlot.window_end;
          }

          const newVisitRef = doc(visitRef);
          transaction.set(newVisitRef, visitData);
        }

        // Increment booked_count (only once, not per visit)
        transaction.update(slotRef, {
          booked_count: slotData.booked_count + 1,
          updated_at: serverTimestamp(),
        });
      });

      toast({
        title: 'Success!',
        description: 'Your service has been booked',
      });

      // Show confirmation and redirect
      setTimeout(() => setLocation('/portal'), 2000);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to complete booking',
      });
    } finally {
      setLoading(false);
    }
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

      {/* Quote Confirmation Modal */}
      <Dialog open={showQuoteModal} onOpenChange={setShowQuoteModal}>
        <DialogContent className="sm:max-w-md" data-testid="modal-quote">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">Review Your Booking</DialogTitle>
            <DialogDescription className="text-center text-base">
              Confirm your details before proceeding to payment
            </DialogDescription>
          </DialogHeader>
          
          {selectedSlot && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Service Date & Time</h3>
                <p className="text-base" data-testid="text-quote-datetime">
                  {selectedSlot.is_recurring ? (
                    <>
                      Every {getDayName(selectedSlot.day_of_week || 0)}
                      <br />
                      Next service: {format(calculateNextServiceDate(selectedSlot.day_of_week || 0, selectedSlot.window_start), 'EEEE, MMMM d, yyyy')}
                    </>
                  ) : (
                    format(new Date(selectedSlot.date), 'EEEE, MMMM d, yyyy')
                  )}
                  <br />
                  {selectedSlot.window_start} - {selectedSlot.window_end}
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Number of Dogs</h3>
                <p className="text-base" data-testid="text-quote-dogs">
                  {formData.dog_count} dog{formData.dog_count > 1 ? 's' : ''}
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Service Price</h3>
                <p className="text-2xl font-bold text-primary" data-testid="text-quote-price">
                  ${calculateQuote(formData.dog_count)}
                </p>
                <p className="text-xs text-muted-foreground">Per service</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleConfirmAndPay}
              className="w-full"
              data-testid="button-confirm-pay"
            >
              Confirm & Pay
            </Button>
            <Button 
              onClick={handleGoBack}
              variant="outline"
              className="w-full"
              data-testid="button-go-back"
            >
              Go Back
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Waitlist Modal */}
      <Dialog open={showWaitlistModal} onOpenChange={setShowWaitlistModal}>
        <DialogContent className="sm:max-w-md" data-testid="modal-waitlist">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">Service area is not yet available</DialogTitle>
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
            {step === 3 && 'Your Information'}
            {step === 4 && 'Choose Your Time'}
            {step === 5 && 'Payment Details'}
          </CardTitle>
          <CardDescription className="text-base">
            {step === 1 && 'See if we service your area'}
            {step === 2 && 'Set up your account to get started'}
            {step === 3 && 'Tell us about your property'}
            {step === 4 && 'Select a convenient service time'}
            {step === 5 && 'Complete your booking'}
          </CardDescription>
          
          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className={`h-2 w-12 rounded-full transition-all ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-12 rounded-full transition-all ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-12 rounded-full transition-all ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-12 rounded-full transition-all ${step >= 4 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-12 rounded-full transition-all ${step >= 5 ? 'bg-primary' : 'bg-muted'}`} />
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

          {/* Step 3: Your Information (Address, Phone, Dog Count) */}
          {step === 3 && (
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
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    maxLength={2}
                    required
                    data-testid="input-state"
                  />
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

              <div className="space-y-2">
                <Label htmlFor="dog_count">Number of Dogs</Label>
                <Input
                  id="dog_count"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.dog_count}
                  onChange={(e) => setFormData({ ...formData, dog_count: parseInt(e.target.value) })}
                  required
                  data-testid="input-dog-count"
                />
              </div>

              <div className="flex gap-4">
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
                  data-testid="button-continue-address"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Continue to Time Selection
                </Button>
              </div>
            </form>
          )}

          {/* Step 4: Select Time Slot */}
          {step === 4 && (
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : availableSlots.length === 0 ? (
                <Card className="bg-muted">
                  <CardContent className="pt-6 text-center">
                    <p className="text-muted-foreground">No available time slots at the moment. Please check back later.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Available Time Slots</Label>
                    <div className="grid gap-2 max-h-96 overflow-y-auto">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-4 border rounded-lg text-left hover-elevate ${
                            selectedSlot?.id === slot.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border'
                          }`}
                          data-testid={`slot-option-${slot.id}`}
                        >
                          <div className="font-semibold">
                            {slot.is_recurring ? (
                              <div>
                                <div>Every {getDayName(slot.day_of_week || 0)}</div>
                                <div className="text-sm font-normal text-muted-foreground">
                                  Next: {format(calculateNextServiceDate(slot.day_of_week || 0, slot.window_start), 'MMM d, yyyy')}
                                </div>
                              </div>
                            ) : (
                              format(new Date(slot.date), 'EEEE, MMMM d, yyyy')
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {slot.window_start} - {slot.window_end}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {slot.capacity - slot.booked_count} of {slot.capacity} spots left
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(3)}
                      data-testid="button-back-step4"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleBooking}
                      disabled={!selectedSlot || loading}
                      className="flex-1"
                      data-testid="button-book-service"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Booking...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Book Service
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 5: Payment Form (Placeholder) */}
          {step === 5 && (
            <form onSubmit={handleCompleteBooking} className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2 mb-4">
                <h3 className="font-semibold">Booking Summary</h3>
                {selectedSlot && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {selectedSlot.is_recurring ? (
                        <>Every {getDayName(selectedSlot.day_of_week || 0)} • Next: {format(calculateNextServiceDate(selectedSlot.day_of_week || 0, selectedSlot.window_start), 'MMM d, yyyy')}</>
                      ) : (
                        format(new Date(selectedSlot.date), 'EEEE, MMMM d, yyyy')
                      )} • {selectedSlot.window_start} - {selectedSlot.window_end}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formData.dog_count} dog{formData.dog_count > 1 ? 's' : ''} • ${calculateQuote(formData.dog_count)} per service
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardholderName">Cardholder Name</Label>
                <Input
                  id="cardholderName"
                  value={paymentData.cardholderName}
                  onChange={(e) => setPaymentData({ ...paymentData, cardholderName: e.target.value })}
                  placeholder="John Doe"
                  required
                  data-testid="input-cardholder-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  value={paymentData.cardNumber}
                  onChange={(e) => setPaymentData({ ...paymentData, cardNumber: e.target.value })}
                  placeholder="1234 5678 9012 3456"
                  required
                  data-testid="input-card-number"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="expiry">Expiry Date</Label>
                  <Input
                    id="expiry"
                    value={paymentData.expiry}
                    onChange={(e) => setPaymentData({ ...paymentData, expiry: e.target.value })}
                    placeholder="MM/YY"
                    required
                    data-testid="input-expiry"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input
                    id="cvc"
                    value={paymentData.cvc}
                    onChange={(e) => setPaymentData({ ...paymentData, cvc: e.target.value })}
                    placeholder="123"
                    maxLength={4}
                    required
                    data-testid="input-cvc"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingZip">Billing ZIP Code</Label>
                <Input
                  id="billingZip"
                  value={paymentData.billingZip}
                  onChange={(e) => setPaymentData({ ...paymentData, billingZip: e.target.value })}
                  placeholder="12345"
                  maxLength={5}
                  required
                  data-testid="input-billing-zip"
                />
              </div>

              <div className="bg-primary/10 p-3 rounded-lg">
                <p className="text-xs text-center text-muted-foreground">
                  This is a placeholder payment form. Stripe integration will be added soon.
                </p>
              </div>

              <div className="flex gap-4 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(4)}
                  data-testid="button-back-payment"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading}
                  data-testid="button-complete-booking"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete Booking
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
