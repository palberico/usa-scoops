import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, MapPin, Home, Dog } from 'lucide-react';
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
  const [zipValid, setZipValid] = useState<boolean | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  
  const [formData, setFormData] = useState({
    // Step 1
    name: '',
    email: '',
    phone: '',
    zip: '',
    password: '',
    // Step 2
    street: '',
    city: '',
    state: '',
    gate_code: '',
    notes: '',
    dog_count: 1,
  });

  // Step 1: Validate Zip Code
  const handleZipCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const zipsRef = collection(db, 'service_zips');
      const q = query(zipsRef, where('zip', '==', formData.zip), where('active', '==', true));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setZipValid(false);
        toast({
          variant: 'destructive',
          title: 'Service Area Not Available',
          description: 'We don\'t service this area yet, but you can join our waitlist!',
        });
      } else {
        setZipValid(true);
        setStep(2);
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

  // Waitlist Submission
  const handleWaitlist = async () => {
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

  // Step 2: Address and Dog Count
  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Show quote
    const quote = calculateQuote(formData.dog_count);
    toast({
      title: 'Your Quote',
      description: `$${quote} per service for ${formData.dog_count} dog${formData.dog_count > 1 ? 's' : ''}`,
    });

    setStep(3);
    
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

  // Step 3: Book Slot and Create Account
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
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl" data-testid="heading-signup">
            {step === 1 && 'Check Service Area'}
            {step === 2 && 'Your Information'}
            {step === 3 && 'Choose Your Time'}
          </CardTitle>
          <CardDescription>
            {step === 1 && 'Enter your information to see if we service your area'}
            {step === 2 && 'Tell us about your property'}
            {step === 3 && 'Select a convenient service time'}
          </CardDescription>
          
          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className={`h-2 w-12 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-12 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-12 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </CardHeader>
        <CardContent>
          {/* Step 1: Basic Info and Zip */}
          {step === 1 && (
            <form onSubmit={handleZipCheck} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  required
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  data-testid="input-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip">Zip Code</Label>
                <Input
                  id="zip"
                  value={formData.zip}
                  onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  maxLength={5}
                  required
                  data-testid="input-zip"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  data-testid="input-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="button-check-zip"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-4 w-4" />
                    Check Service Area
                  </>
                )}
              </Button>

              {zipValid === false && (
                <Card className="bg-muted">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">Join Our Waitlist</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      We'll notify you when we start servicing your area.
                    </p>
                    <Button
                      onClick={handleWaitlist}
                      disabled={loading}
                      variant="secondary"
                      className="w-full"
                      data-testid="button-join-waitlist"
                    >
                      Join Waitlist
                    </Button>
                  </CardContent>
                </Card>
              )}
            </form>
          )}

          {/* Step 2: Address and Dog Count */}
          {step === 2 && (
            <form onSubmit={handleAddressSubmit} className="space-y-4">
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
                  onClick={() => setStep(1)}
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

          {/* Step 3: Select Time Slot */}
          {step === 3 && (
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
                      onClick={() => setStep(2)}
                      data-testid="button-back-step3"
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
