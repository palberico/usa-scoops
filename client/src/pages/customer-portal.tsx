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
import { Loader2, Calendar, MapPin, MessageSquare, LogOut, Clock, ShieldAlert, XCircle, CalendarClock, Plus, Menu } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { collection, query, where, getDocs, addDoc, doc, getDoc, orderBy, Timestamp, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Visit, Slot, Customer, Technician } from '@shared/types';
import { getDayName, calculateNextServiceDate } from '@shared/types';
import { format } from 'date-fns';
import { useLocation } from 'wouter';
import { useIsMobile } from '@/hooks/use-mobile';

export default function CustomerPortal() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [nextVisit, setNextVisit] = useState<{ visit: Visit; slot: Slot } | null>(null);
  const [upcomingVisits, setUpcomingVisits] = useState<Array<{ visit: Visit; slot: Slot }>>([]);
  const [pastVisits, setPastVisits] = useState<Array<{ visit: Visit; slot: Slot }>>([]);
  const [messageForm, setMessageForm] = useState({ subject: '', body: '' });
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [selectedNewSlot, setSelectedNewSlot] = useState<Slot | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [schedulePage, setSchedulePage] = useState(0);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [technicianName, setTechnicianName] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  // Reset/clamp pagination when upcoming visits or recurring group changes
  useEffect(() => {
    if (upcomingVisits.length > 0) {
      const firstRecurringVisit = upcomingVisits.find(v => v.visit.is_recurring);
      const newGroupId = firstRecurringVisit?.visit.recurring_group_id || null;
      
      // If the recurring group changed, reset to page 0
      if (newGroupId && newGroupId !== currentGroupId) {
        setCurrentGroupId(newGroupId);
        setSchedulePage(0);
      } else {
        // Otherwise just clamp to valid range
        const visitsPerPage = 4;
        const totalPages = Math.ceil(upcomingVisits.length / visitsPerPage);
        setSchedulePage(prev => Math.min(prev, totalPages - 1));
      }
    } else {
      setSchedulePage(0);
      setCurrentGroupId(null);
    }
  }, [upcomingVisits, currentGroupId]);

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

      let upcoming: Array<{ visit: Visit; slot: Slot }> = [];
      let past: Array<{ visit: Visit; slot: Slot }> = [];

      for (const visitDoc of visitsSnapshot.docs) {
        const visit = { ...visitDoc.data(), id: visitDoc.id } as Visit;
        
        // Get slot data
        const slotDoc = await getDoc(doc(db, 'slots', visit.slot_id));
        if (slotDoc.exists()) {
          const slot = { ...slotDoc.data(), id: slotDoc.id } as Slot;
          const visitData = { visit, slot };

          // Scheduled visits are "upcoming" regardless of time (until completed/cancelled)
          if (visit.status === 'scheduled') {
            upcoming.push(visitData);
          } else {
            past.push(visitData);
          }
        }
      }

      // Set next visit (earliest upcoming) and all upcoming visits
      if (upcoming.length > 0) {
        upcoming.sort((a, b) => 
          a.visit.scheduled_for.toDate().getTime() - b.visit.scheduled_for.toDate().getTime()
        );
        const next = upcoming[0];
        setNextVisit(next);
        setUpcomingVisits(upcoming);

        // Fetch technician name if assigned
        if (next.visit.technician_uid) {
          try {
            // Check customers collection first
            let techDoc = await getDoc(doc(db, 'customers', next.visit.technician_uid));
            if (techDoc.exists()) {
              const techData = techDoc.data();
              setTechnicianName(techData.name || 'Unknown');
            } else {
              // Check technicians collection as fallback
              techDoc = await getDoc(doc(db, 'technicians', next.visit.technician_uid));
              if (techDoc.exists()) {
                const techData = techDoc.data();
                setTechnicianName(techData.name || 'Unknown');
              } else {
                setTechnicianName(null);
              }
            }
          } catch (error) {
            console.error('Failed to fetch technician:', error);
            setTechnicianName(null);
          }
        } else {
          setTechnicianName(null);
        }
      } else {
        setNextVisit(null);
        setUpcomingVisits([]);
        setTechnicianName(null);
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
        
        // For recurring slots, check if they have capacity
        // For one-time slots, check if date is in future
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
    
    // Prevent rescheduling to the same slot
    if (nextVisit.slot.id === selectedNewSlot.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You are already booked in this time slot',
      });
      return;
    }
    
    setActionLoading(true);
    try {
      const oldSlotRef = doc(db, 'slots', nextVisit.slot.id);
      const newSlotRef = doc(db, 'slots', selectedNewSlot.id);
      const visitRef = doc(db, 'visits', nextVisit.visit.id);

      // Pre-fetch recurring group visits to calculate replacement date
      // Note: This creates a potential race condition, but it's acceptable because:
      // 1. The auto-replenishment logic will fix any gaps when visits are completed
      // 2. Duplicate dates are prevented by the buffer size check
      let replacementDate: Date | null = null;
      if (nextVisit.visit.is_recurring && nextVisit.visit.recurring_group_id) {
        const groupQuery = query(
          collection(db, 'visits'),
          where('recurring_group_id', '==', nextVisit.visit.recurring_group_id),
          where('status', '==', 'scheduled')
        );
        const groupSnapshot = await getDocs(groupQuery);
        const groupVisits = groupSnapshot.docs
          .map(doc => ({ ...doc.data(), id: doc.id }) as Visit)
          .filter(v => v.id !== nextVisit.visit.id) // Exclude the one being rescheduled
          .sort((a, b) => b.scheduled_for.toDate().getTime() - a.scheduled_for.toDate().getTime());
        
        if (groupVisits.length > 0) {
          // Latest visit + 7 days
          const latestDate = groupVisits[0].scheduled_for.toDate();
          replacementDate = new Date(latestDate);
          replacementDate.setDate(latestDate.getDate() + 7);
          
          // Set time from recurring window
          if (nextVisit.visit.recurring_window_start) {
            const [hours, minutes] = nextVisit.visit.recurring_window_start.split(':').map(Number);
            replacementDate.setHours(hours, minutes, 0, 0);
          }
        }
      }

      await runTransaction(db, async (transaction) => {
        // Read all documents inside transaction
        const oldSlotDoc = await transaction.get(oldSlotRef);
        const newSlotDoc = await transaction.get(newSlotRef);
        const currentVisitDoc = await transaction.get(visitRef);

        if (!currentVisitDoc.exists()) {
          throw new Error('Visit no longer exists');
        }

        if (!newSlotDoc.exists()) {
          throw new Error('Selected slot no longer exists');
        }

        const currentVisit = currentVisitDoc.data();
        const newSlotData = newSlotDoc.data();
        const oldSlotData = oldSlotDoc.data();
        
        if (newSlotData.booked_count >= newSlotData.capacity) {
          throw new Error('Selected slot is now full');
        }

        // Calculate new scheduled time
        let scheduledDate: Date;
        if (selectedNewSlot.is_recurring) {
          scheduledDate = calculateNextServiceDate(selectedNewSlot.day_of_week || 0, selectedNewSlot.window_start);
        } else {
          const dateTimeString = `${selectedNewSlot.date}T${selectedNewSlot.window_start}:00`;
          scheduledDate = new Date(dateTimeString);
        }
        const scheduledTimestamp = Timestamp.fromDate(scheduledDate);

        // Update the visit: remove from recurring group and reschedule as standalone
        transaction.update(visitRef, {
          slot_id: selectedNewSlot.id,
          scheduled_for: scheduledTimestamp,
          is_recurring: false,
          recurring_group_id: null,
          recurring_day_of_week: null,
          recurring_window_start: null,
          recurring_window_end: null,
        });

        // If this was a recurring visit, create a REPLACEMENT visit for the original slot
        // to maintain the 24-week buffer for the customer's recurring subscription
        if (currentVisit.is_recurring && currentVisit.recurring_group_id && replacementDate) {
          const newVisitRef = doc(collection(db, 'visits'));
          transaction.set(newVisitRef, {
            customer_uid: currentVisit.customer_uid,
            slot_id: currentVisit.slot_id, // Use ORIGINAL slot_id to keep recurring series anchored
            scheduled_for: Timestamp.fromDate(replacementDate),
            status: 'scheduled',
            notes: '',
            is_recurring: true,
            recurring_group_id: currentVisit.recurring_group_id,
            recurring_day_of_week: currentVisit.recurring_day_of_week,
            recurring_window_start: currentVisit.recurring_window_start,
            recurring_window_end: currentVisit.recurring_window_end,
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
          });
        }

        // Slot counts: only adjust for one-time visits
        // Recurring visits don't affect slot counts when rescheduled (customer remains subscribed)
        if (!currentVisit.is_recurring && oldSlotDoc.exists() && oldSlotData) {
          transaction.update(oldSlotRef, {
            booked_count: Math.max(0, (oldSlotData.booked_count || 0) - 1),
          });
        }

        if (!selectedNewSlot.is_recurring) {
          transaction.update(newSlotRef, {
            booked_count: newSlotData.booked_count + 1,
          });
        }
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
    const labels: Record<string, string> = {
      scheduled: 'Scheduled',
      completed: 'Completed',
      canceled: 'Canceled',
      skipped: 'Skipped',
      not_complete: 'Not Complete',
    };
    
    // Special styling for completed (green) and not_complete (red)
    if (status === 'completed') {
      return (
        <Badge className="bg-green-600 hover:bg-green-700 text-white" data-testid={`badge-${status}`}>
          {labels[status] || status}
        </Badge>
      );
    }
    
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      scheduled: 'default',
      canceled: 'destructive',
      skipped: 'destructive',
      not_complete: 'destructive',
    };
    
    return <Badge variant={variants[status] || 'default'} data-testid={`badge-${status}`}>{labels[status] || status}</Badge>;
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
      <header className="bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl sm:text-2xl font-bold" data-testid="heading-customer-portal">
              Hello {customer?.name || user?.email?.split('@')[0] || 'there'}!
            </h1>
            
            {/* Desktop: Show Sign Out button */}
            {!isMobile && (
              <Button variant="outline" onClick={handleSignOut} data-testid="button-logout">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            )}
            
            {/* Mobile: Show drawer menu */}
            {isMobile && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" data-testid="button-menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px]">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleSignOut();
                      }}
                      className="w-full justify-start"
                      data-testid="button-logout-mobile"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            )}
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
                    <div className="space-y-1">
                      {nextVisit.visit.is_recurring && (
                        <Badge variant="secondary" className="mb-1" data-testid="badge-recurring">
                          Recurring Monthly Plan
                        </Badge>
                      )}
                      <p className="font-semibold text-lg" data-testid="text-visit-date">
                        Next Service: {format(nextVisit.visit.scheduled_for.toDate(), 'MMM d, yyyy')}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1.5" data-testid="text-visit-time">
                        <Clock className="h-4 w-4" />
                        {nextVisit.slot.window_start} - {nextVisit.slot.window_end}
                      </p>
                    </div>
                    {getStatusBadge(nextVisit.visit.status)}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      <span data-testid="text-visit-address">
                        {customer?.address.street}, {customer?.address.city}, {customer?.address.state}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground pl-6" data-testid="text-technician">
                      Technician: <span className="font-medium">{technicianName || 'Pending'}</span>
                    </div>
                  </div>

                  {/* Action Buttons - Temporarily hidden, keeping logic for potential future use */}
                  {/* <div className="flex gap-3 pt-2">
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
                  </div> */}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-muted-foreground" data-testid="text-no-visits">
                    No upcoming visits scheduled
                  </p>
                  <Button 
                    onClick={() => setLocation('/portal/book')}
                    className="w-full"
                    data-testid="button-book-new-service"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Book New Service
                  </Button>
                </div>
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

          {/* Upcoming Recurring Schedule */}
          {nextVisit?.visit.is_recurring && upcomingVisits.length > 0 && (() => {
            const visitsPerPage = 4;
            const totalPages = Math.ceil(upcomingVisits.length / visitsPerPage);
            const startIndex = schedulePage * visitsPerPage;
            const endIndex = startIndex + visitsPerPage;
            const paginatedVisits = upcomingVisits.slice(startIndex, endIndex);
            
            return (
              <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-primary" />
                    Your Recurring Schedule
                  </CardTitle>
                  <CardDescription>
                    {upcomingVisits.length} visits scheduled • {getDayName(nextVisit.visit.recurring_day_of_week || 0)}s at {nextVisit.slot.window_start}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-hidden">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-3">
                      Your weekly service is scheduled every {getDayName(nextVisit.visit.recurring_day_of_week || 0)} from {nextVisit.slot.window_start} to {nextVisit.slot.window_end}. We maintain a 24-week schedule so you're always covered!
                    </p>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">Date</TableHead>
                        <TableHead className="min-w-[80px]">Day</TableHead>
                        <TableHead className="min-w-[120px]">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedVisits.map(({ visit, slot }, localIndex) => {
                        const globalIndex = startIndex + localIndex;
                        const visitDate = visit.scheduled_for.toDate();
                        const now = new Date();
                        const isPast = visitDate < now;
                        
                        return (
                          <TableRow 
                            key={visit.id} 
                            data-testid={`row-upcoming-visit-${visit.id}`}
                            className={globalIndex === 0 ? 'bg-primary/5' : ''}
                          >
                            <TableCell className="font-medium">
                              {format(visitDate, 'MMM d, yyyy')}
                              {globalIndex === 0 && !isPast && (
                                <Badge variant="default" className="ml-2">Next</Badge>
                              )}
                              {isPast && (
                                <Badge variant="secondary" className="ml-2">Pending</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {getDayName(visitDate.getDay())}
                            </TableCell>
                            <TableCell>
                              {slot.window_start} - {slot.window_end}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
                      <div className="text-sm text-muted-foreground text-center sm:text-left">
                        Showing {startIndex + 1}-{Math.min(endIndex, upcomingVisits.length)} of {upcomingVisits.length} visits
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSchedulePage(p => Math.max(0, p - 1))}
                          disabled={schedulePage === 0}
                          data-testid="button-prev-page"
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSchedulePage(p => Math.min(totalPages - 1, p + 1))}
                          disabled={schedulePage === totalPages - 1}
                          data-testid="button-next-page"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
          })()}

          {/* Visit History */}
          <Card className="bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Visit History
              </CardTitle>
              <CardDescription>Your past service visits</CardDescription>
            </CardHeader>
            <CardContent className="overflow-hidden">
              {pastVisits.length === 0 ? (
                <p className="text-muted-foreground text-center py-8" data-testid="text-no-history">
                  No visit history yet
                </p>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Date</TableHead>
                      <TableHead className="min-w-[120px]">Time</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[200px]">Notes</TableHead>
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
                        <TableCell>
                          {visit.notes ? (
                            <p className="text-sm text-muted-foreground" data-testid={`text-notes-${visit.id}`}>
                              {visit.notes}
                            </p>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No notes</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
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
