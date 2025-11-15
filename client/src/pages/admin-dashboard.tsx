import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Calendar, Plus, Trash2, LogOut, Users } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ServiceZip, Slot, Visit, Customer } from '@shared/types';
import { format } from 'date-fns';
import { useLocation } from 'wouter';

interface VisitWithCustomer extends Visit {
  customer?: Customer;
  slot?: Slot;
}

export default function AdminDashboard() {
  const { user, role, signOut } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  
  // Zip Codes
  const [zips, setZips] = useState<ServiceZip[]>([]);
  const [newZip, setNewZip] = useState('');
  
  // Slots
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotForm, setSlotForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    window_start: '09:00',
    window_end: '11:00',
    capacity: 4,
  });
  
  // Visits
  const [visits, setVisits] = useState<VisitWithCustomer[]>([]);
  const [visitFilter, setVisitFilter] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'all',
  });
  
  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: string; id: string }>({
    open: false,
    type: '',
    id: '',
  });

  useEffect(() => {
    loadZips();
    loadSlots();
    loadVisits();
  }, []);

  useEffect(() => {
    loadVisits();
  }, [visitFilter]);

  // Zip Code Functions
  const loadZips = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'service_zips'));
      const data: ServiceZip[] = [];
      snapshot.forEach((doc) => {
        data.push({ ...doc.data(), id: doc.id } as ServiceZip);
      });
      setZips(data.sort((a, b) => a.zip.localeCompare(b.zip)));
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load zip codes',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddZip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newZip.length !== 5) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Zip code must be 5 digits',
      });
      return;
    }

    try {
      await addDoc(collection(db, 'service_zips'), {
        zip: newZip,
        active: true,
      });

      toast({
        title: 'Success',
        description: 'Zip code added',
      });

      setNewZip('');
      loadZips();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add zip code',
      });
    }
  };

  const handleToggleZip = async (id: string, currentActive: boolean) => {
    try {
      await updateDoc(doc(db, 'service_zips', id), {
        active: !currentActive,
      });
      loadZips();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update zip code',
      });
    }
  };

  const handleDeleteZip = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'service_zips', id));
      toast({
        title: 'Success',
        description: 'Zip code deleted',
      });
      loadZips();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete zip code',
      });
    }
    setDeleteDialog({ open: false, type: '', id: '' });
  };

  // Slot Functions
  const loadSlots = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'slots'));
      const data: Slot[] = [];
      snapshot.forEach((doc) => {
        data.push({ ...doc.data(), id: doc.id } as Slot);
      });
      // Sort by date and time
      data.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.window_start.localeCompare(b.window_start);
      });
      setSlots(data);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load slots',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await addDoc(collection(db, 'slots'), {
        date: slotForm.date,
        window_start: slotForm.window_start,
        window_end: slotForm.window_end,
        capacity: slotForm.capacity,
        booked_count: 0,
        status: 'open',
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      toast({
        title: 'Success',
        description: 'Slot created',
      });

      loadSlots();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create slot',
      });
    }
  };

  const handleUpdateSlotCapacity = async (id: string, newCapacity: number) => {
    try {
      await updateDoc(doc(db, 'slots', id), {
        capacity: newCapacity,
        updated_at: Timestamp.now(),
      });
      loadSlots();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update slot',
      });
    }
  };

  const handleUpdateSlotStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'slots', id), {
        status: newStatus,
        updated_at: Timestamp.now(),
      });
      loadSlots();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update slot',
      });
    }
  };

  const handleDeleteSlot = async (id: string) => {
    try {
      // Check if slot has bookings
      const slot = slots.find((s) => s.id === id);
      if (slot && slot.booked_count > 0) {
        toast({
          variant: 'destructive',
          title: 'Cannot Delete',
          description: 'This slot has bookings. Cancel them first.',
        });
        return;
      }

      await deleteDoc(doc(db, 'slots', id));
      toast({
        title: 'Success',
        description: 'Slot deleted',
      });
      loadSlots();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete slot',
      });
    }
    setDeleteDialog({ open: false, type: '', id: '' });
  };

  // Visit Functions
  const loadVisits = async () => {
    setLoading(true);
    try {
      const visitsRef = collection(db, 'visits');
      let q;
      
      if (visitFilter.status === 'all') {
        q = query(visitsRef, orderBy('scheduled_for', 'desc'));
      } else {
        q = query(visitsRef, where('status', '==', visitFilter.status), orderBy('scheduled_for', 'desc'));
      }

      const snapshot = await getDocs(q);
      const data: VisitWithCustomer[] = [];

      for (const visitDoc of snapshot.docs) {
        const visit = { ...visitDoc.data(), id: visitDoc.id } as VisitWithCustomer;
        
        // Get customer
        try {
          const customerDoc = await doc(db, 'customers', visit.customer_uid);
          const customerSnap = await getDocs(query(collection(db, 'customers'), where('__name__', '==', visit.customer_uid)));
          if (!customerSnap.empty) {
            visit.customer = { ...customerSnap.docs[0].data(), uid: customerSnap.docs[0].id } as Customer;
          }
        } catch (e) {
          console.error('Error loading customer:', e);
        }

        // Get slot
        try {
          const slotDoc = await doc(db, 'slots', visit.slot_id);
          const slotSnap = await getDocs(query(collection(db, 'slots'), where('__name__', '==', visit.slot_id)));
          if (!slotSnap.empty) {
            visit.slot = { ...slotSnap.docs[0].data(), id: slotSnap.docs[0].id } as Slot;
          }
        } catch (e) {
          console.error('Error loading slot:', e);
        }

        data.push(visit);
      }

      setVisits(data);
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

  const handleSignOut = async () => {
    await signOut();
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold" data-testid="heading-admin-dashboard">Admin Dashboard</h1>
            <div className="flex items-center gap-4">
              {role === 'admin' && (
                <Button variant="outline" onClick={() => setLocation('/tech')} data-testid="button-tech-portal">
                  <Users className="h-4 w-4 mr-2" />
                  Tech Portal
                </Button>
              )}
              <Button variant="outline" onClick={handleSignOut} data-testid="button-logout">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="zips" className="space-y-4">
          <TabsList>
            <TabsTrigger value="zips" data-testid="tab-zips">Zip Codes</TabsTrigger>
            <TabsTrigger value="slots" data-testid="tab-slots">Service Slots</TabsTrigger>
            <TabsTrigger value="visits" data-testid="tab-visits">Visits</TabsTrigger>
          </TabsList>

          {/* Zip Codes Tab */}
          <TabsContent value="zips" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Service Zip Codes
                </CardTitle>
                <CardDescription>Manage which zip codes you service</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleAddZip} className="flex gap-4">
                  <Input
                    placeholder="Enter 5-digit zip code"
                    value={newZip}
                    onChange={(e) => setNewZip(e.target.value)}
                    maxLength={5}
                    data-testid="input-new-zip"
                  />
                  <Button type="submit" data-testid="button-add-zip">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Zip
                  </Button>
                </form>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zip Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zips.map((zip) => (
                      <TableRow key={zip.id} data-testid={`row-zip-${zip.zip}`}>
                        <TableCell className="font-medium">{zip.zip}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={zip.active}
                              onCheckedChange={() => handleToggleZip(zip.id, zip.active)}
                              data-testid={`switch-zip-${zip.zip}`}
                            />
                            <span className="text-sm text-muted-foreground">
                              {zip.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteDialog({ open: true, type: 'zip', id: zip.id })}
                            data-testid={`button-delete-zip-${zip.zip}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Slots Tab */}
          <TabsContent value="slots" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Create Service Slot
                </CardTitle>
                <CardDescription>Add available service windows</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateSlot} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="slot-date">Date</Label>
                      <Input
                        id="slot-date"
                        type="date"
                        value={slotForm.date}
                        onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })}
                        required
                        data-testid="input-slot-date"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slot-capacity">Capacity</Label>
                      <Input
                        id="slot-capacity"
                        type="number"
                        min="1"
                        value={slotForm.capacity}
                        onChange={(e) => setSlotForm({ ...slotForm, capacity: parseInt(e.target.value) })}
                        required
                        data-testid="input-slot-capacity"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slot-start">Start Time</Label>
                      <Input
                        id="slot-start"
                        type="time"
                        value={slotForm.window_start}
                        onChange={(e) => setSlotForm({ ...slotForm, window_start: e.target.value })}
                        required
                        data-testid="input-slot-start"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slot-end">End Time</Label>
                      <Input
                        id="slot-end"
                        type="time"
                        value={slotForm.window_end}
                        onChange={(e) => setSlotForm({ ...slotForm, window_end: e.target.value })}
                        required
                        data-testid="input-slot-end"
                      />
                    </div>
                  </div>

                  <Button type="submit" data-testid="button-create-slot">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Slot
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Existing Slots</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time Window</TableHead>
                      <TableHead>Booked / Capacity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slots.map((slot) => (
                      <TableRow key={slot.id} data-testid={`row-slot-${slot.id}`}>
                        <TableCell>{format(new Date(slot.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          {slot.window_start} - {slot.window_end}
                        </TableCell>
                        <TableCell>
                          {slot.booked_count} / {slot.capacity}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={slot.status === 'open' ? 'default' : 'secondary'}
                            data-testid={`badge-slot-status-${slot.id}`}
                          >
                            {slot.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {slot.status === 'open' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateSlotStatus(slot.id, 'blocked')}
                                data-testid={`button-block-${slot.id}`}
                              >
                                Block
                              </Button>
                            )}
                            {slot.status === 'blocked' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateSlotStatus(slot.id, 'open')}
                                data-testid={`button-unblock-${slot.id}`}
                              >
                                Unblock
                              </Button>
                            )}
                            {slot.booked_count === 0 && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteDialog({ open: true, type: 'slot', id: slot.id })}
                                data-testid={`button-delete-slot-${slot.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Visits Tab */}
          <TabsContent value="visits" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Visits Overview</CardTitle>
                <CardDescription>View and manage all visits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="visit-status">Status</Label>
                    <select
                      id="visit-status"
                      value={visitFilter.status}
                      onChange={(e) => setVisitFilter({ ...visitFilter, status: e.target.value })}
                      className="border rounded px-3 py-2"
                      data-testid="select-visit-status"
                    >
                      <option value="all">All</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="canceled">Canceled</option>
                    </select>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visits.map((visit) => (
                      <TableRow key={visit.id} data-testid={`row-visit-${visit.id}`}>
                        <TableCell>
                          {format(visit.scheduled_for.toDate(), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          {visit.slot?.window_start} - {visit.slot?.window_end}
                        </TableCell>
                        <TableCell>{visit.customer?.name || 'Unknown'}</TableCell>
                        <TableCell>
                          {visit.customer?.address.city}, {visit.customer?.address.state}
                        </TableCell>
                        <TableCell>
                          <Badge>{visit.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this {deleteDialog.type}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialog.type === 'zip') {
                  handleDeleteZip(deleteDialog.id);
                } else if (deleteDialog.type === 'slot') {
                  handleDeleteSlot(deleteDialog.id);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
