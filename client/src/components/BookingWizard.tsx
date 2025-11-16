import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { collection, query, where, getDocs, doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { calculateQuote, getDayName, calculateNextServiceDate } from '@shared/types';
import type { Slot } from '@shared/types';
import { format, parse } from 'date-fns';

interface BookingWizardProps {
  customerId: string;
  customerData: {
    zip: string;
    dog_count: number;
  };
  onComplete: () => void;
  onCancel?: () => void;
  showPaymentStep?: boolean;
}

export default function BookingWizard({ 
  customerId, 
  customerData, 
  onComplete, 
  onCancel,
  showPaymentStep = true 
}: BookingWizardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [currentStep, setCurrentStep] = useState<'slots' | 'payment'>('slots');
  
  const [paymentData, setPaymentData] = useState({
    cardholderName: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
    billingZip: '',
  });

  useEffect(() => {
    loadAvailableSlots();
  }, [customerData.zip]);

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
      
      // Sort slots
      slots.sort((a, b) => {
        if (a.is_recurring && !b.is_recurring) return -1;
        if (!a.is_recurring && b.is_recurring) return 1;
        
        if (a.is_recurring && b.is_recurring) {
          return (a.day_of_week || 0) - (b.day_of_week || 0);
        }
        
        return new Date(a.date).getTime() - new Date(b.date).getTime();
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

  const handleConfirmAndPay = () => {
    setShowQuoteModal(false);
    if (showPaymentStep) {
      setCurrentStep('payment');
    } else {
      handleCompleteBooking();
    }
  };

  const handleCompleteBooking = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
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
            const dateTimeString = `${selectedSlot.date} ${selectedSlot.window_start}`;
            scheduledDate = parse(dateTimeString, 'yyyy-MM-dd HH:mm', new Date());
            
            if (isNaN(scheduledDate.getTime())) {
              throw new Error(`Invalid slot date/time format: ${dateTimeString}`);
            }
          }
          
          const visitData: any = {
            customer_uid: customerId,
            slot_id: selectedSlot.id,
            scheduled_for: Timestamp.fromDate(scheduledDate),
            status: 'scheduled' as const,
            notes: '',
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
          };
          
          if (selectedSlot.is_recurring) {
            visitData.is_recurring = true;
            visitData.recurring_group_id = recurringGroupId;
            visitData.recurring_day_of_week = selectedSlot.day_of_week;
            visitData.recurring_window_start = selectedSlot.window_start;
            visitData.recurring_window_end = selectedSlot.window_end;
          } else {
            visitData.is_recurring = false;
          }

          const newVisitRef = doc(visitRef);
          transaction.set(newVisitRef, visitData);
        }

        transaction.update(slotRef, {
          booked_count: slotData.booked_count + 1,
        });
      });

      toast({
        title: 'Success!',
        description: 'Your service has been booked',
      });

      onComplete();
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
                    ${calculateQuote(customerData.dog_count)}
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

  // Payment step
  return (
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
              {customerData.dog_count} dog{customerData.dog_count > 1 ? 's' : ''} • ${calculateQuote(customerData.dog_count)} per service
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
        <div className="space-y-2 col-span-2">
          <Label htmlFor="expiry">Expiration</Label>
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
          required
          data-testid="input-billing-zip"
        />
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          This is a demo payment form. No real payment will be processed.
        </p>
      </div>

      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setCurrentStep('slots')}
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
  );
}
