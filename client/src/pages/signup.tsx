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
import { calculateQuote } from '@shared/types';
import type { Slot } from '@shared/types';
import { format, parse } from 'date-fns';

export default function Signup() {
  const [, setLocation] = useLocation();
  const { signUp } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  
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
        // Not in service area - show waitlist option
        toast({
          variant: 'destructive',
          title: 'Service Area Not Available',
          description: 'We don\'t service this area yet, but you can join our waitlist!',
        });
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

  // Waitlist Submission
  const handleWaitlist = async () => {
    if (!formData.name || !formData.email) {
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
        name: formData.name,
        email: formData.email,
        zip: formData.zip,
        created_at: Timestamp.now(),
      });

      toast({
        title: 'Added to Waitlist',
        description: 'We\'ll notify you when we expand to your area!',
      });

      setTimeout(() => setLocation('/'), 2000);
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
    setStep(3); // Move to "Your Information" step
  };

  // Step 3: Your Information (address, phone, dog count)
  const handleInformationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Show quote
    const quote = calculateQuote(formData.dog_count);
    toast({
      title: 'Your Quote',
      description: `$${quote} per service for ${formData.dog_count} dog${formData.dog_count > 1 ? 's' : ''}`,
    });

    setStep(4); // Move to time slot selection
    
    // Load available slots
    setLoading(true);
    try {
      const slotsRef = collection(db, 'slots');
      const q = query(slotsRef, where('status', '==', 'open'));
      const snapshot = await getDocs(q);
      
      const slots: Slot[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.booked_count < data.capacity) {
          slots.push({ ...data, id: doc.id } as Slot);
        }
      });

      // Sort by date
      slots.sort((a, b) => a.date.localeCompare(b.date));
      setAvailableSlots(slots);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load available slots',
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Book Slot and Create Account
  const handleBooking = async () => {
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
      // Create Firebase Auth user and customer document
      const userData: any = {
        name: formData.name,
        phone: formData.phone,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
        },
        dog_count: formData.dog_count,
      };
      
      // Only add optional fields if they have values
      if (formData.gate_code?.trim()) {
        userData.address.gate_code = formData.gate_code;
      }
      if (formData.notes?.trim()) {
        userData.address.notes = formData.notes;
      }
      
      await signUp(formData.email, formData.password, userData);

      // Book the slot using a transaction
      const slotRef = doc(db, 'slots', selectedSlot.id);
      const visitRef = collection(db, 'visits');

      // Get current user (available after signUp completes)
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      await runTransaction(db, async (transaction) => {
        const slotDoc = await transaction.get(slotRef);
        if (!slotDoc.exists()) {
          throw new Error('Slot no longer exists');
        }

        const slotData = slotDoc.data();
        if (slotData.booked_count >= slotData.capacity) {
          throw new Error('Slot is full');
        }

        // Create visit - parse date and time using date-fns for reliability
        const dateTimeString = `${selectedSlot.date} ${selectedSlot.window_start}`;
        const scheduledDate = parse(dateTimeString, 'yyyy-MM-dd HH:mm', new Date());
        
        // Validate the date is valid
        if (isNaN(scheduledDate.getTime())) {
          console.error('Invalid date:', {
            date: selectedSlot.date,
            time: selectedSlot.window_start,
            combined: dateTimeString,
          });
          throw new Error(`Invalid slot date/time format: ${dateTimeString}`);
        }
        
        const visitData = {
          customer_uid: currentUser.uid,
          slot_id: selectedSlot.id,
          scheduled_for: Timestamp.fromDate(scheduledDate),
          status: 'scheduled',
          notes: '',
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        };

        const newVisitRef = doc(visitRef);
        transaction.set(newVisitRef, visitData);

        // Increment booked_count
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

      <Card className="w-full max-w-2xl mt-48 sm:mt-56 md:mt-64 lg:mt-72">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold" data-testid="heading-signup">
            {step === 1 && 'Check Service Area'}
            {step === 2 && 'Create Your Account'}
            {step === 3 && 'Your Information'}
            {step === 4 && 'Choose Your Time'}
          </CardTitle>
          <CardDescription className="text-base">
            {step === 1 && 'See if we service your area'}
            {step === 2 && 'Set up your account to get started'}
            {step === 3 && 'Tell us about your property'}
            {step === 4 && 'Select a convenient service time'}
          </CardDescription>
          
          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className={`h-2 w-16 rounded-full transition-all ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-16 rounded-full transition-all ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-16 rounded-full transition-all ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-16 rounded-full transition-all ${step >= 4 ? 'bg-primary' : 'bg-muted'}`} />
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
                  className="h-12 text-lg text-center"
                  data-testid="input-zip"
                />
                <p className="text-sm text-muted-foreground text-center">
                  No account needed yet - just checking if we service your area!
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-lg"
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
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
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
                            {format(new Date(slot.date), 'EEEE, MMMM d, yyyy')}
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
        </CardContent>
      </Card>
    </div>
  );
}
