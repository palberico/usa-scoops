import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, MapPin, MessageSquare, LogOut, Clock, ShieldAlert, XCircle, CalendarClock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { collection, query, where, getDocs, addDoc, doc, getDoc, orderBy, Timestamp, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Visit, Slot, Customer } from '@shared/types';
import { format } from 'date-fns';
import { useLocation } from 'wouter';

export default function CustomerPortal() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [nextVisit, setNextVisit] = useState<{ visit: Visit; slot: Slot } | null>(null);
  const [pastVisits, setPastVisits] = useState<Array<{ visit: Visit; slot: Slot }>>([]);
  const [messageForm, setMessageForm] = useState({ subject: '', body: '' });
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [selectedNewSlot, setSelectedNewSlot] = useState<Slot | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      // Load customer data
      const customerDoc = await getDoc(doc(db, 'customers', user.uid));
      if (customerDoc.exists()) {
        setCustomer({ ...customerDoc.data(), uid: customerDoc.id } as Customer);
      }

      // Load visits
      const visitsRef = collection(db, 'visits');
      const q = query(
        visitsRef,
        where('customer_uid', '==', user.uid),
        orderBy('scheduled_for', 'desc')
      );
      const visitsSnapshot = await getDocs(q);

      const now = new Date();
      let upcoming: Array<{ visit: Visit; slot: Slot }> = [];
      let past: Array<{ visit: Visit; slot: Slot }> = [];

      for (const visitDoc of visitsSnapshot.docs) {
        const visit = { ...visitDoc.data(), id: visitDoc.id } as Visit;
        
        // Get slot data
        const slotDoc = await getDoc(doc(db, 'slots', visit.slot_id));
        if (slotDoc.exists()) {
          const slot = { ...slotDoc.data(), id: slotDoc.id } as Slot;
          const visitData = { visit, slot };

          if (visit.status === 'scheduled' && visit.scheduled_for.toDate() > now) {
            upcoming.push(visitData);
          } else {
            past.push(visitData);
          }
        }
      }

      // Set next visit (earliest upcoming)
      if (upcoming.length > 0) {
        upcoming.sort((a, b) => 
          a.visit.scheduled_for.toDate().getTime() - b.visit.scheduled_for.toDate().getTime()
        );
        setNextVisit(upcoming[0]);
      }

      setPastVisits(past);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingMessage(true);

    try {
      await addDoc(collection(db, 'messages'), {
        customer_uid: user!.uid,
        subject: messageForm.subject,
        body: messageForm.body,
        status: 'open',
        created_at: Timestamp.now(),
      });

      toast({
        title: 'Message Sent',
        description: 'We\'ll get back to you soon!',
      });

      setMessageForm({ subject: '', body: '' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to send message',
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setLocation('/');
  };

  const loadAvailableSlots = async () => {
    try {
      const slotsRef = collection(db, 'slots');
      const q = query(
        slotsRef,
        where('status', '==', 'open'),
        orderBy('date', 'asc')
      );
      const slotsSnapshot = await getDocs(q);
      
      const now = new Date();
      const slots: Slot[] = [];
      
      slotsSnapshot.forEach((slotDoc) => {
        const slot = { ...slotDoc.data(), id: slotDoc.id } as Slot;
        const slotDate = new Date(slot.date);
        
        // Only show future slots with available capacity
        if (slotDate > now && slot.booked_count < slot.capacity) {
          slots.push(slot);
        }
      });
      
      setAvailableSlots(slots);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load available slots',
      });
    }
  };

  const handleCancelVisit = async () => {
    if (!nextVisit) return;
    
    setActionLoading(true);
    try {
      const visitRef = doc(db, 'visits', nextVisit.visit.id);
      const slotRef = doc(db, 'slots', nextVisit.slot.id);

      // Run both updates in a single transaction for data consistency
      await runTransaction(db, async (transaction) => {
        const slotDoc = await transaction.get(slotRef);
        
        if (slotDoc.exists()) {
          const currentCount = slotDoc.data().booked_count || 0;
          transaction.update(slotRef, {
            booked_count: Math.max(0, currentCount - 1),
          });
        }

        transaction.update(visitRef, {
          status: 'canceled',
        });
      });

      toast({
        title: 'Visit Canceled',
        description: 'Your visit has been successfully canceled.',
      });

      setShowCancelDialog(false);
      await loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to cancel visit',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRescheduleVisit = async () => {
    if (!nextVisit || !selectedNewSlot) return;
    
    setActionLoading(true);
    try {
      const oldSlotRef = doc(db, 'slots', nextVisit.slot.id);
      const newSlotRef = doc(db, 'slots', selectedNewSlot.id);
      const visitRef = doc(db, 'visits', nextVisit.visit.id);

      await runTransaction(db, async (transaction) => {
        const oldSlotDoc = await transaction.get(oldSlotRef);
        const newSlotDoc = await transaction.get(newSlotRef);

        if (!newSlotDoc.exists()) {
          throw new Error('Selected slot no longer exists');
        }

        const newSlotData = newSlotDoc.data();
        if (newSlotData.booked_count >= newSlotData.capacity) {
          throw new Error('Selected slot is now full');
        }

        // Decrement old slot count
        if (oldSlotDoc.exists()) {
          const oldCount = oldSlotDoc.data().booked_count || 0;
          transaction.update(oldSlotRef, {
            booked_count: Math.max(0, oldCount - 1),
          });
        }

        // Increment new slot count
        transaction.update(newSlotRef, {
          booked_count: newSlotData.booked_count + 1,
        });

        // Convert slot date and time to Firestore Timestamp
        // Combine date (YYYY-MM-DD) with window_start time (HH:mm)
        const dateTimeString = `${selectedNewSlot.date}T${selectedNewSlot.window_start}:00`;
        const scheduledTimestamp = Timestamp.fromDate(new Date(dateTimeString));

        // Update visit with new slot
        transaction.update(visitRef, {
          slot_id: selectedNewSlot.id,
          scheduled_for: scheduledTimestamp,
        });
      });

      toast({
        title: 'Visit Rescheduled',
        description: 'Your visit has been successfully rescheduled.',
      });

      setShowRescheduleDialog(false);
      setSelectedNewSlot(null);
      await loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to reschedule visit',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const openRescheduleDialog = async () => {
    setShowRescheduleDialog(true);
    await loadAvailableSlots();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      scheduled: 'default',
      completed: 'secondary',
      canceled: 'destructive',
      skipped: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-portal" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white dark:bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-[hsl(210,100%,25%)]" data-testid="heading-customer-portal">
              Hello {customer?.name || user?.email?.split('@')[0] || 'there'}!
            </h1>
            <Button variant="outline" onClick={handleSignOut} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6">
          {/* Next Visit Card */}
          <Card className="bg-gradient-to-br from-[hsl(210,100%,90%)] to-white dark:from-[hsl(210,100%,20%)] dark:to-background" data-testid="card-next-visit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Next Scheduled Visit
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextVisit ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-lg" data-testid="text-visit-date">
                        {format(nextVisit.visit.scheduled_for.toDate(), 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1.5" data-testid="text-visit-time">
                        <Clock className="h-4 w-4" />
                        {nextVisit.slot.window_start} - {nextVisit.slot.window_end}
                      </p>
                    </div>
                    {getStatusBadge(nextVisit.visit.status)}
                  </div>
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5" />
                    <span data-testid="text-visit-address">
                      {customer?.address.street}, {customer?.address.city}, {customer?.address.state}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={openRescheduleDialog}
                      className="flex-1"
                      data-testid="button-reschedule"
                    >
                      <CalendarClock className="h-4 w-4 mr-2" />
                      Reschedule
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowCancelDialog(true)}
                      className="flex-1"
                      data-testid="button-cancel"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground" data-testid="text-no-visits">
                  No upcoming visits scheduled
                </p>
              )}
            </CardContent>
          </Card>

          {/* Security Note */}
          {nextVisit && (
            <div className="flex items-start gap-2 text-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 p-4 rounded-lg border border-amber-500/20">
              <ShieldAlert className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <span data-testid="text-security-note">
                Please make sure your dog is secure before our technician arrives.
              </span>
            </div>
          )}

          {/* Visit History */}
          <Card className="bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Visit History
              </CardTitle>
              <CardDescription>Your past service visits</CardDescription>
            </CardHeader>
            <CardContent>
              {pastVisits.length === 0 ? (
                <p className="text-muted-foreground text-center py-8" data-testid="text-no-history">
                  No visit history yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastVisits.map(({ visit, slot }) => (
                      <TableRow key={visit.id} data-testid={`row-visit-${visit.id}`}>
                        <TableCell>
                          {format(visit.scheduled_for.toDate(), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          {slot.window_start} - {slot.window_end}
                        </TableCell>
                        <TableCell>{getStatusBadge(visit.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Contact Form */}
          <Card className="bg-gradient-to-br from-blue-500/5 via-background to-background border-blue-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Contact Us
              </CardTitle>
              <CardDescription>Send us a message</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendMessage} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={messageForm.subject}
                    onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
                    required
                    data-testid="input-message-subject"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body">Message</Label>
                  <Textarea
                    id="body"
                    value={messageForm.body}
                    onChange={(e) => setMessageForm({ ...messageForm, body: e.target.value })}
                    required
                    rows={4}
                    data-testid="input-message-body"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={sendingMessage}
                  data-testid="button-send-message"
                >
                  {sendingMessage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Message'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent data-testid="modal-cancel">
          <DialogHeader>
            <DialogTitle>Cancel Visit</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your scheduled visit? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={actionLoading}
              data-testid="button-cancel-no"
            >
              No, Keep It
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelVisit}
              disabled={actionLoading}
              data-testid="button-cancel-yes"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Canceling...
                </>
              ) : (
                'Yes, Cancel Visit'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="max-w-2xl" data-testid="modal-reschedule">
          <DialogHeader>
            <DialogTitle>Reschedule Visit</DialogTitle>
            <DialogDescription>
              Select a new time slot for your service visit
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {availableSlots.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No available time slots at the moment. Please check back later or contact us.
              </p>
            ) : (
              <div className="grid gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedNewSlot(slot)}
                    className={`p-4 border rounded-lg text-left hover-elevate ${
                      selectedNewSlot?.id === slot.id
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
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowRescheduleDialog(false);
                setSelectedNewSlot(null);
              }}
              disabled={actionLoading}
              data-testid="button-reschedule-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRescheduleVisit}
              disabled={!selectedNewSlot || actionLoading}
              data-testid="button-reschedule-confirm"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rescheduling...
                </>
              ) : (
                'Confirm Reschedule'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
