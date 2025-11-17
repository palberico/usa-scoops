import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Loader2, Calendar, CheckCircle2, User } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Visit, Customer, Slot, Technician } from '@shared/types';
import { format } from 'date-fns';
import { useLocation } from 'wouter';
import { PortalHeader } from '@/components/portal-header';

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

  useEffect(() => {
    loadTechnicians();
  }, []);

  useEffect(() => {
    loadVisits();
  }, [user, selectedDate, technicians]);

  const loadTechnicians = async () => {
    try {
      const customersRef = collection(db, 'customers');
      const snapshot = await getDocs(customersRef);
      const techMap: Record<string, Technician> = {};
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.role === 'admin' || data.role === 'technician') {
          techMap[doc.id] = {
            ...data,
            uid: doc.id,
          } as Technician;
        }
      });
      
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
      
      // Filter to only scheduled and completed visits
      const allVisitDocs = visitsSnapshot.docs.filter(doc => {
        const status = doc.data().status;
        return status === 'scheduled' || status === 'completed';
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

  const handleMarkCompleted = async (visitId: string) => {
    setUpdatingVisit(visitId);
    try {
      // Get the visit being completed
      const visitDoc = await getDoc(doc(db, 'visits', visitId));
      if (!visitDoc.exists()) {
        throw new Error('Visit not found');
      }
      const visit = { ...visitDoc.data(), id: visitDoc.id } as Visit;

      // Mark visit as completed
      await updateDoc(doc(db, 'visits', visitId), {
        status: 'completed',
        updated_at: Timestamp.now(),
      });

      // If this is a recurring visit, maintain the 24-week buffer
      if (visit.is_recurring && visit.recurring_group_id) {
        // Count future scheduled visits in this recurring group
        const futureVisitsQuery = query(
          collection(db, 'visits'),
          where('recurring_group_id', '==', visit.recurring_group_id),
          where('status', '==', 'scheduled')
        );
        const futureVisitsSnapshot = await getDocs(futureVisitsQuery);
        const futureVisits = futureVisitsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Visit));
        
        // Sort by scheduled_for to find the latest
        futureVisits.sort((a, b) => b.scheduled_for.toDate().getTime() - a.scheduled_for.toDate().getTime());
        
        const bufferSize = 24;
        const visitsToCreate = bufferSize - futureVisits.length;
        
        if (visitsToCreate > 0 && visit.recurring_day_of_week !== undefined) {
          // Find the latest scheduled visit date
          const latestVisitDate = futureVisits.length > 0 
            ? futureVisits[0].scheduled_for.toDate() 
            : visit.scheduled_for.toDate();
          
          // Create new visits to maintain buffer
          for (let i = 1; i <= visitsToCreate; i++) {
            const nextDate = new Date(latestVisitDate);
            nextDate.setDate(latestVisitDate.getDate() + (i * 7));
            
            // Set the time from the recurring window
            if (visit.recurring_window_start) {
              const [hours, minutes] = visit.recurring_window_start.split(':').map(Number);
              nextDate.setHours(hours, minutes, 0, 0);
            }
            
            await addDoc(collection(db, 'visits'), {
              customer_uid: visit.customer_uid,
              slot_id: visit.slot_id,
              scheduled_for: Timestamp.fromDate(nextDate),
              status: 'scheduled',
              notes: '',
              is_recurring: true,
              recurring_group_id: visit.recurring_group_id,
              recurring_day_of_week: visit.recurring_day_of_week,
              recurring_window_start: visit.recurring_window_start,
              recurring_window_end: visit.recurring_window_end,
              created_at: Timestamp.now(),
              updated_at: Timestamp.now(),
            });
          }
        }
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
                  className="flex-1 sm:max-w-xs"
                  data-testid="input-date-filter"
                />
                <Button onClick={loadVisits} data-testid="button-refresh-visits" className="w-full sm:w-auto">
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* My Assigned Visits Card */}
          <Card>
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
                      <TableHead className="min-w-[150px]">Notes</TableHead>
                      <TableHead className="min-w-[120px]">Action</TableHead>
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
                          <TableCell className="max-w-xs" data-testid={`text-my-notes-${visit.id}`}>
                            <div className="text-sm text-muted-foreground truncate">
                              {visit.customer.address.notes || visit.notes || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handleMarkCompleted(visit.id)}
                              disabled={updatingVisit === visit.id}
                              data-testid={`button-my-complete-${visit.id}`}
                            >
                              {updatingVisit === visit.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Complete
                                </>
                              )}
                            </Button>
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
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Visits</CardTitle>
              <CardDescription>
                Visits for {format(new Date(selectedDate), 'MMMM d, yyyy')}
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
                      <TableHead className="min-w-[150px]">Notes</TableHead>
                      <TableHead className="min-w-[120px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visits.filter(v => v.status === 'scheduled').map((visit) => {
                      // Fallback to slot window times if recurring times not set
                      const windowStart = visit.recurring_window_start || visit.slot.window_start;
                      const windowEnd = visit.recurring_window_end || visit.slot.window_end;
                      
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
                          <TableCell className="max-w-xs" data-testid={`text-notes-${visit.id}`}>
                            <div className="text-sm text-muted-foreground truncate">
                              {visit.customer.address.notes || visit.notes || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handleMarkCompleted(visit.id)}
                              disabled={updatingVisit === visit.id}
                              data-testid={`button-complete-${visit.id}`}
                            >
                              {updatingVisit === visit.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Complete
                                </>
                              )}
                            </Button>
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
          <Card>
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
    </div>
  );
}
