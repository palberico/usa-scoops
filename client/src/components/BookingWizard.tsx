import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { collection, query, where, getDocs, doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { calculateQuote, getDayName, calculateNextServiceDate } from '@shared/types';
import type { Slot } from '@shared/types';
import { format, parse } from 'date-fns';
import { VISIT_BUFFER_SIZE } from '@/lib/visitReplenishment';
import { StripePaymentWrapper } from './StripePaymentWrapper';
import { apiRequest } from '@/lib/queryClient';

interface BookingWizardProps {
  customerId: string;
  customerData: {
    zip: string;
    dog_count: number;
  };
  serviceType?: 'recurring' | 'onetime';
  onComplete: () => void;
  onCancel?: () => void;
  showPaymentStep?: boolean;
  pricing?: {
    recurring_base: number;
    recurring_additional: number;
    onetime_base: number;
    onetime_additional: number;
  };
}

export default function BookingWizard({ 
  customerId, 
  customerData, 
  serviceType = 'recurring',
  onComplete, 
  onCancel,
  showPaymentStep = true,
  pricing 
}: BookingWizardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [currentStep, setCurrentStep] = useState<'slots' | 'payment' | 'confirming'>('slots');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [pollingBookingStatus, setPollingBookingStatus] = useState(false);
  const [tosAgreed, setTosAgreed] = useState(false);

  useEffect(() => {
    loadAvailableSlots();
  }, [customerData.zip, serviceType]);

  const loadAvailableSlots = async () => {
    setLoading(true);
    try {
      const slotsRef = collection(db, 'slots');
      const q = query(
        slotsRef,
        where('status', '==', 'open'),
        where('zip', '==', customerData.zip)
      );
      const slotsSnapshot = await getDocs(q);
      
      const now = new Date();
      const slots: Slot[] = [];
      
      slotsSnapshot.forEach((slotDoc) => {
        const slot = { ...slotDoc.data(), id: slotDoc.id } as Slot;
        
        // Filter slots based on service type
        const isRecurringServiceSelected = serviceType === 'recurring';
        if (slot.is_recurring !== isRecurringServiceSelected) {
          return; // Skip slots that don't match the selected service type
        }
        
        let shouldInclude = false;
        if (slot.is_recurring) {
          shouldInclude = slot.booked_count < slot.capacity;
        } else {
          const slotDate = new Date(slot.date);
          shouldInclude = slotDate > now && slot.booked_count < slot.capacity;
        }
        
        if (shouldInclude) {
          slots.push(slot);
        }
      });
      
      // Sort slots by next available date (closest date first)
      slots.sort((a, b) => {
        let aDate: Date;
        let bDate: Date;
        
        if (a.is_recurring) {
          // Calculate next service date for recurring slot
          aDate = calculateNextServiceDate(a.day_of_week || 0, a.window_start);
        } else {
          aDate = new Date(a.date);
        }
        
        if (b.is_recurring) {
          // Calculate next service date for recurring slot
          bDate = calculateNextServiceDate(b.day_of_week || 0, b.window_start);
        } else {
          bDate = new Date(b.date);
        }
        
        return aDate.getTime() - bDate.getTime();
      });
      
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

  const handleSlotSelection = () => {
    if (!selectedSlot) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a time slot',
      });
      return;
    }

    setShowQuoteModal(true);
  };

  const handleConfirmAndPay = async () => {
    // Security: All bookings must go through payment/webhook flow
    // Direct client-side booking creation is disabled to prevent fraud
    if (!showPaymentStep) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Payment is required to complete booking',
      });
      return;
    }

    setShowQuoteModal(false);
    setCreatingPayment(true);
    
    try {
      // Create payment intent via backend - server validates amount and fetches dog count
      const response = await apiRequest('POST', '/api/create-payment-intent', {
        customerId,
        slotId: selectedSlot?.id,
      });
      
      const data = await response.json();
      
      if (data.error) {
        if (data.error === "Slot is no longer available") {
          // Slot was taken between selection and payment - refresh available slots
          toast({
            variant: 'destructive',
            title: 'Slot Unavailable',
            description: 'This time slot was just booked. Please select another slot.',
          });
          setCurrentStep('slots');
          setSelectedSlot(null);
          return;
        }
        throw new Error(data.error);
      }
      
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setCurrentStep('payment');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to initialize payment',
        });
    } finally {
      setCreatingPayment(false);
    }
  };

  // Poll for booking confirmation after payment succeeds
  const pollBookingStatus = async (intentId: string) => {
    setCurrentStep('confirming');
    setPollingBookingStatus(true);
    
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max
    const pollInterval = 1000; // Poll every 1 second

    try {
      while (attempts < maxAttempts) {
        const response = await fetch(`/api/booking-status/${intentId}`);
        const data = await response.json();

        if (data.status === 'completed' && data.hasVisits) {
          // Booking confirmed!
          toast({
            title: 'Success!',
            description: 'Your service has been booked',
          });
          setTimeout(() => onComplete(), 500);
          return;
        } else if (data.status === 'failed') {
          throw new Error('Payment verification failed');
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
      }

      // Timeout - booking might still be processing
      toast({
        title: 'Booking in Progress',
        description: 'Your payment was successful. Your booking confirmation will appear shortly.',
      });
      setTimeout(() => onComplete(), 1000);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to confirm booking',
      });
    } finally {
      setPollingBookingStatus(false);
    }
  };


  if (currentStep === 'slots') {
    return (
      <>
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
                {onCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    data-testid="button-back"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={handleSlotSelection}
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

        {/* Quote Modal */}
        <Dialog open={showQuoteModal} onOpenChange={setShowQuoteModal}>
          <DialogContent data-testid="dialog-quote">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Your Quote
              </DialogTitle>
              <DialogDescription>Review your service details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Service Date</p>
                <p className="font-semibold">
                  {selectedSlot?.is_recurring ? (
                    <>Every {getDayName(selectedSlot.day_of_week || 0)} • Next: {format(calculateNextServiceDate(selectedSlot.day_of_week || 0, selectedSlot.window_start), 'MMM d, yyyy')}</>
                  ) : (
                    selectedSlot && format(new Date(selectedSlot.date), 'EEEE, MMMM d, yyyy')
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Time Window</p>
                <p className="font-semibold">
                  {selectedSlot?.window_start} - {selectedSlot?.window_end}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Number of Dogs</p>
                <p className="font-semibold">{customerData.dog_count}</p>
              </div>
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">Total per service:</span>
                  <span className="text-2xl font-bold text-primary">
                    ${calculateQuote(customerData.dog_count, serviceType === 'recurring', pricing)}
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setShowQuoteModal(false)} data-testid="button-quote-back">
                Go Back
              </Button>
              <Button onClick={handleConfirmAndPay} data-testid="button-quote-confirm">
                {showPaymentStep ? 'Confirm & Pay' : 'Confirm Booking'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Confirming booking step - Poll for webhook confirmation
  if (currentStep === 'confirming' || pollingBookingStatus) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-500 animate-pulse" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Payment Successful!</h3>
          <p className="text-muted-foreground">Confirming your booking...</p>
          <p className="text-sm text-muted-foreground">This will only take a moment</p>
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Payment step
  if (!clientSecret || creatingPayment) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Preparing payment...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 p-4 rounded-lg space-y-2">
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
              {customerData.dog_count} dog{customerData.dog_count > 1 ? 's' : ''} • ${calculateQuote(customerData.dog_count, serviceType === 'recurring', pricing)} per service
            </p>
          </>
        )}
      </div>

      <StripePaymentWrapper
        clientSecret={clientSecret}
        amount={calculateQuote(customerData.dog_count, serviceType === 'recurring', pricing)}
        buttonText="Complete Booking"
        tosAgreed={tosAgreed}
        onSuccess={async () => {
          // Payment successful - poll for booking confirmation
          if (paymentIntentId) {
            await pollBookingStatus(paymentIntentId);
          }
        }}
        onError={(error) => {
          toast({
            variant: 'destructive',
            title: 'Payment Failed',
            description: error,
          });
        }}
      />

      <div className="flex items-start space-x-2">
        <Checkbox
          id="tos-agree"
          checked={tosAgreed}
          onCheckedChange={(checked) => setTosAgreed(checked as boolean)}
          data-testid="checkbox-tos-agree"
        />
        <Label htmlFor="tos-agree" className="text-sm font-normal cursor-pointer leading-relaxed">
          I agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
            Terms of Service
          </a>
        </Label>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setCurrentStep('slots');
          setClientSecret(null);
        }}
        className="w-full"
        data-testid="button-back-payment"
      >
        Back to Slot Selection
      </Button>
    </div>
  );
}
