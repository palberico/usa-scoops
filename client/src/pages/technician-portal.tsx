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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, CheckCircle2, User, UserPlus, Info, XCircle } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Visit, Customer, Slot, Technician } from '@shared/types';
import { format } from 'date-fns';
import { useLocation } from 'wouter';
import { PortalHeader } from '@/components/portal-header';
import { replenishVisits } from '@/lib/visitReplenishment';

interface VisitWithDetails extends Visit {
  customer: Customer;
  slot: Slot;
  technician?: Technician;
}

export default function TechnicianPortal() {
  const { user, role, signOut } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [updatingVisit, setUpdatingVisit] = useState<string | null>(null);
  const [technicians, setTechnicians] = useState<Record<string, Technician>>({});
  const [detailsVisit, setDetailsVisit] = useState<VisitWithDetails | null>(null);
  const [completeModalVisit, setCompleteModalVisit] = useState<VisitWithDetails | null>(null);
  const [completeNotes, setCompleteNotes] = useState('');
  const [notCompleteModalVisit, setNotCompleteModalVisit] = useState<VisitWithDetails | null>(null);
  const [notCompleteNotes, setNotCompleteNotes] = useState('');

  useEffect(() => {
    loadTechnicians();
  }, []);

  useEffect(() => {
    loadVisits();
  }, [user, selectedDate, technicians]);

  const loadTechnicians = async () => {
    try {
      const techMap: Record<string, Technician> = {};
      
      // Load from customers collection
      const customersRef = collection(db, 'customers');
      const customersSnapshot = await getDocs(customersRef);
      customersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.role === 'admin' || data.role === 'technician') {
          techMap[doc.id] = {
            ...data,
            uid: doc.id,
          } as Technician;
        }
      });
      
      // Also load from technicians collection (fallback)
      try {
        const techniciansRef = collection(db, 'technicians');
        const techniciansSnapshot = await getDocs(techniciansRef);
        techniciansSnapshot.docs.forEach(doc => {
          if (!techMap[doc.id]) {
            techMap[doc.id] = {
              ...doc.data(),
              uid: doc.id,
            } as Technician;
          }
        });
      } catch (e) {
        console.log('Technicians collection not accessible or empty');
      }
      
      setTechnicians(techMap);
    } catch (error: any) {
      console.error('Error loading technicians:', error);
    }
  };

  const loadVisits = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const visitsRef = collection(db, 'visits');
      
      // Parse date string as local date (not UTC)
      const [year, month, day] = selectedDate.split('-').map(Number);
      const selectedDateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
      const nextDay = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
      
      const startTimestamp = Timestamp.fromDate(selectedDateObj);
      const endTimestamp = Timestamp.fromDate(nextDay);

      // Query visits by date only, filter status in code to avoid composite index
      const visitsQuery = query(
        visitsRef,
        where('scheduled_for', '>=', startTimestamp),
        where('scheduled_for', '<', endTimestamp),
        orderBy('scheduled_for', 'asc')
      );
      const visitsSnapshot = await getDocs(visitsQuery);

      const visitsWithDetails: VisitWithDetails[] = [];
      
      // Filter to only scheduled, completed, and not_complete visits
      const allVisitDocs = visitsSnapshot.docs.filter(doc => {
        const status = doc.data().status;
        return status === 'scheduled' || status === 'completed' || status === 'not_complete';
      });
      
      for (const visitDoc of allVisitDocs) {
        const visit = { ...visitDoc.data(), id: visitDoc.id } as Visit;

        // Get slot
        const slotDoc = await getDoc(doc(db, 'slots', visit.slot_id));
        if (!slotDoc.exists()) continue;
        const slot = { ...slotDoc.data(), id: slotDoc.id } as Slot;

        // Get customer
        const customerDoc = await getDoc(doc(db, 'customers', visit.customer_uid));
        if (!customerDoc.exists()) continue;
        const customer = { ...customerDoc.data(), uid: customerDoc.id } as Customer;

        // Get technician if assigned
        const technician = visit.technician_uid ? technicians[visit.technician_uid] : undefined;

        visitsWithDetails.push({
          ...visit,
          customer,
          slot,
          technician,
        });
      }

      // Sort by scheduled_for time
      visitsWithDetails.sort((a, b) => 
        a.scheduled_for.toDate().getTime() - b.scheduled_for.toDate().getTime()
      );
      setVisits(visitsWithDetails);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load visits',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTakeVisit = async (visitId: string) => {
    if (!user) return;
    
    setUpdatingVisit(visitId);
    try {
      // Get the current technician's name
      const technicianName = technicians[user.uid]?.name || null;
      let technicianTitle = null;
      let technicianAvatarUrl = null;

      // Fetch technician profile for title and avatar
      try {
        const profileDoc = await getDoc(doc(db, 'technician_profiles', user.uid));
        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          technicianTitle = profileData.title || null;
          technicianAvatarUrl = profileData.avatar_url || null;
        }
      } catch (e) {
        console.log('Technician profile not found');
      }

      await updateDoc(doc(db, 'visits', visitId), {
        technician_uid: user.uid,
        technician_name: technicianName,
        technician_title: technicianTitle,
        technician_avatar_url: technicianAvatarUrl,
        updated_at: Timestamp.now(),
      });

      toast({
        title: 'Visit Assigned',
        description: 'Visit has been assigned to you',
      });

      loadVisits();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to assign visit',
      });
    } finally {
      setUpdatingVisit(null);
    }
  };

  const handleMarkCompleted = async (visitId: string, notes?: string) => {
    setUpdatingVisit(visitId);
    try {
      // Get the visit being completed
      const visitDoc = await getDoc(doc(db, 'visits', visitId));
      if (!visitDoc.exists()) {
        throw new Error('Visit not found');
      }
      const visit = { ...visitDoc.data(), id: visitDoc.id } as Visit;

      // Mark visit as completed with optional notes
      await updateDoc(doc(db, 'visits', visitId), {
        status: 'completed',
        notes: notes || visit.notes || '',
        updated_at: Timestamp.now(),
      });

      // If this is a recurring visit, maintain the 8-visit rolling buffer
      if (
        visit.is_recurring && 
        visit.recurring_group_id &&
        visit.recurring_day_of_week !== undefined &&
        visit.recurring_window_start &&
        visit.recurring_window_end
      ) {
        await replenishVisits(
          {
            recurringGroupId: visit.recurring_group_id,
            customerUid: visit.customer_uid,
            slotId: visit.slot_id,
            recurringDayOfWeek: visit.recurring_day_of_week,
            recurringWindowStart: visit.recurring_window_start,
            recurringWindowEnd: visit.recurring_window_end,
          },
          visit.scheduled_for.toDate() // Pass the completed visit date
        );
      }

      toast({
        title: 'Visit Completed',
        description: 'Visit marked as completed',
      });

      loadVisits();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update visit',
      });
    } finally {
      setUpdatingVisit(null);
    }
  };

  const handleMarkNotComplete = async (visitId: string, notes: string) => {
    setUpdatingVisit(visitId);
    try {
      // Mark visit as not complete with notes
      await updateDoc(doc(db, 'visits', visitId), {
        status: 'not_complete',
        notes: notes,
        updated_at: Timestamp.now(),
      });

      toast({
        title: 'Visit Marked Not Complete',
        description: 'Visit has been marked as not complete',
      });

      loadVisits();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update visit',
      });
    } finally {
      setUpdatingVisit(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader
        title="Technician Portal"
        role={role as 'admin' | 'technician' | 'customer'}
        onSignOut={handleSignOut}
        onSwitchPortal={role === 'admin' ? () => setLocation('/admin') : undefined}
        switchPortalLabel={role === 'admin' ? 'Admin Portal' : undefined}
        onProfileClick={() => setLocation('/tech/profile')}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6">
          {/* Date Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Select Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <Label htmlFor="date" className="sm:min-w-fit">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full sm:max-w-xs"
                  data-testid="input-date-filter"
                />
                <Button onClick={loadVisits} data-testid="button-refresh-visits" className="w-full sm:w-auto">
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* My Assigned Visits Card */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                My Assigned Visits
              </CardTitle>
              <CardDescription>
                Visits assigned to me for {format(new Date(selectedDate), 'MMMM d, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : visits.filter(v => v.status === 'scheduled' && v.technician_uid === user?.uid).length === 0 ? (
                <p className="text-muted-foreground text-center py-8" data-testid="text-no-assigned-visits">
                  No visits assigned to you for this date
                </p>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Time Window</TableHead>
                      <TableHead className="min-w-[120px]">Customer</TableHead>
                      <TableHead className="min-w-[120px]">Phone</TableHead>
                      <TableHead className="min-w-[200px]">Address</TableHead>
                      <TableHead className="min-w-[60px]">Dogs</TableHead>
                      <TableHead className="min-w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visits.filter(v => v.status === 'scheduled' && v.technician_uid === user?.uid).map((visit) => {
                      const windowStart = visit.recurring_window_start || visit.slot.window_start;
                      const windowEnd = visit.recurring_window_end || visit.slot.window_end;
                      
                      return (
                        <TableRow key={visit.id} data-testid={`row-my-visit-${visit.id}`}>
                          <TableCell className="font-medium" data-testid={`text-my-time-${visit.id}`}>
                            {windowStart} - {windowEnd}
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`text-my-customer-${visit.id}`}>
                            {visit.customer.name}
                          </TableCell>
                          <TableCell data-testid={`text-my-phone-${visit.id}`}>
                            {visit.customer.phone}
                          </TableCell>
                          <TableCell data-testid={`text-my-address-${visit.id}`}>
                            <div className="text-sm">
                              <div className="font-medium">{visit.customer.address.street}</div>
                              <div className="text-muted-foreground">
                                {visit.customer.address.city}, {visit.customer.address.state} {visit.customer.address.zip}
                              </div>
                              {visit.customer.address.gate_code && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Gate Code: <span className="font-mono font-semibold">{visit.customer.address.gate_code}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-my-dogs-${visit.id}`}>{visit.customer.dog_count}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                onClick={() => setCompleteModalVisit(visit)}
                                data-testid={`button-my-complete-${visit.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="destructive"
                                onClick={() => setNotCompleteModalVisit(visit)}
                                data-testid={`button-my-not-complete-${visit.id}`}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                className="bg-[hsl(var(--army-green))] text-[hsl(var(--army-green-foreground))] border-[hsl(var(--army-green-border))]"
                                onClick={() => setDetailsVisit(visit)}
                                data-testid={`button-my-details-${visit.id}`}
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scheduled Visits Table */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Scheduled Visits</CardTitle>
              <CardDescription>
                All visits for {format(new Date(selectedDate), 'MMMM d, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : visits.filter(v => v.status === 'scheduled').length === 0 ? (
                <p className="text-muted-foreground text-center py-8" data-testid="text-no-visits">
                  No scheduled visits for this date
                </p>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Time Window</TableHead>
                      <TableHead className="min-w-[120px]">Customer</TableHead>
                      <TableHead className="min-w-[120px]">Phone</TableHead>
                      <TableHead className="min-w-[200px]">Address</TableHead>
                      <TableHead className="min-w-[60px]">Dogs</TableHead>
                      <TableHead className="min-w-[120px]">Assigned To</TableHead>
                      <TableHead className="min-w-[120px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visits.filter(v => v.status === 'scheduled').map((visit) => {
                      // Fallback to slot window times if recurring times not set
                      const windowStart = visit.recurring_window_start || visit.slot.window_start;
                      const windowEnd = visit.recurring_window_end || visit.slot.window_end;
                      const isAssignedToMe = visit.technician_uid === user?.uid;
                      
                      return (
                        <TableRow key={visit.id} data-testid={`row-visit-${visit.id}`}>
                          <TableCell className="font-medium" data-testid={`text-time-${visit.id}`}>
                            {windowStart} - {windowEnd}
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`text-customer-${visit.id}`}>
                            {visit.customer.name}
                          </TableCell>
                          <TableCell data-testid={`text-phone-${visit.id}`}>
                            {visit.customer.phone}
                          </TableCell>
                          <TableCell data-testid={`text-address-${visit.id}`}>
                            <div className="text-sm">
                              <div className="font-medium">{visit.customer.address.street}</div>
                              <div className="text-muted-foreground">
                                {visit.customer.address.city}, {visit.customer.address.state} {visit.customer.address.zip}
                              </div>
                              {visit.customer.address.gate_code && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Gate Code: <span className="font-mono font-semibold">{visit.customer.address.gate_code}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-dogs-${visit.id}`}>{visit.customer.dog_count}</TableCell>
                          <TableCell data-testid={`text-assigned-${visit.id}`}>
                            {visit.technician ? (
                              <Badge variant="secondary" className="font-normal">
                                {visit.technician.name}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="font-normal text-muted-foreground">
                                Unassigned
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!isAssignedToMe && (
                              <Button
                                size="sm"
                                className="w-24"
                                variant="destructive"
                                onClick={() => handleTakeVisit(visit.id)}
                                disabled={updatingVisit === visit.id}
                                data-testid={`button-take-${visit.id}`}
                              >
                                {updatingVisit === visit.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Take
                                  </>
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Completed Jobs Table */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Completed Jobs
              </CardTitle>
              <CardDescription>
                Jobs completed on {format(new Date(selectedDate), 'MMMM d, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : visits.filter(v => v.status === 'completed').length === 0 ? (
                <p className="text-muted-foreground text-center py-8" data-testid="text-no-completed">
                  No completed jobs for this date
                </p>
              ) : (
                <>
                  <div className="mb-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                          Total Completed
                        </p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400" data-testid="text-total-completed">
                          {visits.filter(v => v.status === 'completed').length}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                          Total Dogs Serviced
                        </p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400" data-testid="text-total-dogs">
                          {visits.filter(v => v.status === 'completed').reduce((sum, v) => sum + v.customer.dog_count, 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">Time Window</TableHead>
                        <TableHead className="min-w-[120px]">Customer</TableHead>
                        <TableHead className="min-w-[180px]">Address</TableHead>
                        <TableHead className="min-w-[60px]">Dogs</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visits.filter(v => v.status === 'completed').map((visit) => {
                        const windowStart = visit.recurring_window_start || visit.slot.window_start;
                        const windowEnd = visit.recurring_window_end || visit.slot.window_end;
                        
                        return (
                          <TableRow key={visit.id} data-testid={`row-completed-${visit.id}`}>
                            <TableCell className="font-medium">
                              {windowStart} - {windowEnd}
                            </TableCell>
                            <TableCell className="font-medium">
                              {visit.customer.name}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{visit.customer.address.street}</div>
                                <div className="text-muted-foreground">
                                  {visit.customer.address.city}, {visit.customer.address.state}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{visit.customer.dog_count}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Completed
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Visit Details Modal */}
      <Dialog open={!!detailsVisit} onOpenChange={(open) => !open && setDetailsVisit(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visit Details</DialogTitle>
            <DialogDescription>
              Complete information for this scheduled visit
            </DialogDescription>
          </DialogHeader>
          
          {detailsVisit && (
            <div className="space-y-6">
              {/* Date and Time */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Date</h3>
                  <p className="text-base font-medium" data-testid="text-modal-date">
                    {format(detailsVisit.scheduled_for.toDate(), 'MMMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Time Window</h3>
                  <p className="text-base font-medium" data-testid="text-modal-time">
                    {detailsVisit.recurring_window_start || detailsVisit.slot.window_start} - {detailsVisit.recurring_window_end || detailsVisit.slot.window_end}
                  </p>
                </div>
              </div>

              {/* Customer Information */}
              <div className="border-t pt-4 space-y-4">
                <h3 className="text-lg font-semibold">Customer Information</h3>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Name</h4>
                  <p className="text-base font-medium" data-testid="text-modal-customer">
                    {detailsVisit.customer.name}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Phone</h4>
                  <p className="text-base font-medium" data-testid="text-modal-phone">
                    {detailsVisit.customer.phone}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Address</h4>
                  <div className="text-base" data-testid="text-modal-address">
                    <p className="font-medium">{detailsVisit.customer.address.street}</p>
                    <p className="text-muted-foreground">
                      {detailsVisit.customer.address.city}, {detailsVisit.customer.address.state} {detailsVisit.customer.address.zip}
                    </p>
                    {detailsVisit.customer.address.gate_code && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Gate Code: <span className="font-mono font-semibold">{detailsVisit.customer.address.gate_code}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dog Information */}
              <div className="border-t pt-4 space-y-4">
                <h3 className="text-lg font-semibold">Dog Information</h3>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Number of Dogs</h4>
                  <p className="text-base font-medium" data-testid="text-modal-dog-count">
                    {detailsVisit.customer.dog_count}
                  </p>
                </div>
                {detailsVisit.customer.dog_names && detailsVisit.customer.dog_names.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Dog Names</h4>
                    <div className="flex flex-wrap gap-2" data-testid="text-modal-dog-names">
                      {detailsVisit.customer.dog_names.map((name, index) => (
                        <Badge key={index} variant="secondary" className="font-normal">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              {(detailsVisit.customer.address.notes || detailsVisit.notes) && (
                <div className="border-t pt-4 space-y-2">
                  <h3 className="text-lg font-semibold">Notes</h3>
                  <div className="bg-muted rounded-md p-4">
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-modal-notes">
                      {detailsVisit.customer.address.notes || detailsVisit.notes}
                    </p>
                  </div>
                </div>
              )}

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Complete Visit Modal */}
      <Dialog open={!!completeModalVisit} onOpenChange={(open) => {
        if (!open) {
          setCompleteModalVisit(null);
          setCompleteNotes('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Visit</DialogTitle>
            <DialogDescription>
              Add any notes about this visit before marking it as complete
            </DialogDescription>
          </DialogHeader>
          
          {completeModalVisit && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="complete-notes">Notes (Optional)</Label>
                <Textarea
                  id="complete-notes"
                  placeholder="e.g., Gate was closed, left message, etc."
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  rows={4}
                  data-testid="textarea-complete-notes"
                />
              </div>
              
              <Button
                onClick={async () => {
                  await handleMarkCompleted(completeModalVisit.id, completeNotes);
                  setCompleteModalVisit(null);
                  setCompleteNotes('');
                }}
                disabled={updatingVisit === completeModalVisit.id}
                className="w-full"
                data-testid="button-submit-complete"
              >
                {updatingVisit === completeModalVisit.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete Visit
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Not Complete Visit Modal */}
      <Dialog open={!!notCompleteModalVisit} onOpenChange={(open) => {
        if (!open) {
          setNotCompleteModalVisit(null);
          setNotCompleteNotes('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Visit as Not Complete</DialogTitle>
            <DialogDescription>
              Please provide a reason why this visit could not be completed
            </DialogDescription>
          </DialogHeader>
          
          {notCompleteModalVisit && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="not-complete-notes">Reason (Required)</Label>
                <Textarea
                  id="not-complete-notes"
                  placeholder="e.g., Customer not home, gate locked, weather conditions, etc."
                  value={notCompleteNotes}
                  onChange={(e) => setNotCompleteNotes(e.target.value)}
                  rows={4}
                  data-testid="textarea-not-complete-notes"
                />
              </div>
              
              <Button
                onClick={async () => {
                  if (!notCompleteNotes.trim()) {
                    toast({
                      variant: 'destructive',
                      title: 'Notes Required',
                      description: 'Please provide a reason for not completing this visit',
                    });
                    return;
                  }
                  await handleMarkNotComplete(notCompleteModalVisit.id, notCompleteNotes);
                  setNotCompleteModalVisit(null);
                  setNotCompleteNotes('');
                }}
                disabled={updatingVisit === notCompleteModalVisit.id}
                variant="destructive"
                className="w-full"
                data-testid="button-submit-not-complete"
              >
                {updatingVisit === notCompleteModalVisit.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Mark as Not Complete
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
