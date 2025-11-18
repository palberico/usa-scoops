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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Calendar, Plus, Trash2, DollarSign, User, Mail, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ServiceZip, Slot, Visit, Customer, Pricing, Technician, Message } from '@shared/types';
import { getDayName, DEFAULT_PRICING } from '@shared/types';
import { format, addDays, startOfDay, endOfDay } from 'date-fns';
import { useLocation } from 'wouter';
import { PortalHeader } from '@/components/portal-header';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const [slotType, setSlotType] = useState<'one-time' | 'recurring'>('recurring');
  const [slotForm, setSlotForm] = useState({
    zip: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    day_of_week: 6, // Saturday by default
    window_start: '09:00',
    window_end: '11:00',
    capacity: 4,
  });
  
  // Visits
  const [visits, setVisits] = useState<VisitWithCustomer[]>([]);
  const [upcomingVisits, setUpcomingVisits] = useState<VisitWithCustomer[]>([]);
  const [visitFilter, setVisitFilter] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'all',
  });
  const [visitsPage, setVisitsPage] = useState(0);
  const visitsPerPage = 10;
  
  // Pricing
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [pricingLoading, setPricingLoading] = useState(false);
  
  // Visit Detail Dialog
  const [selectedVisit, setSelectedVisit] = useState<VisitWithCustomer | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [assigningTech, setAssigningTech] = useState(false);
  
  // Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [customersMap, setCustomersMap] = useState<Record<string, Customer>>({});
  const [messagesLoading, setMessagesLoading] = useState(false);
  
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
    loadUpcomingVisits();
    loadTechnicians();
    loadPricing();
    loadMessages();
    loadCustomers();
  }, []);

  useEffect(() => {
    loadVisits();
    setVisitsPage(0);
  }, [visitFilter]);
  
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(visits.length / visitsPerPage) - 1);
    if (visitsPage > maxPage) {
      setVisitsPage(maxPage);
    }
  }, [visits.length, visitsPage, visitsPerPage]);

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
      
      // Sort: recurring first (by day_of_week), then one-time (by date, then time)
      data.sort((a, b) => {
        // Separate recurring and one-time slots
        const aRecurring = a.is_recurring || false;
        const bRecurring = b.is_recurring || false;
        
        if (aRecurring && !bRecurring) return -1;
        if (!aRecurring && bRecurring) return 1;
        
        if (aRecurring && bRecurring) {
          // Both recurring - sort by day_of_week, then time
          const dayCompare = (a.day_of_week || 0) - (b.day_of_week || 0);
          if (dayCompare !== 0) return dayCompare;
          return a.window_start.localeCompare(b.window_start);
        } else {
          // Both one-time - sort by date, then time
          const dateCompare = a.date.localeCompare(b.date);
          if (dateCompare !== 0) return dateCompare;
          return a.window_start.localeCompare(b.window_start);
        }
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
    
    // Validate zip code
    if (!slotForm.zip || slotForm.zip.length !== 5) {
      toast({
        variant: 'destructive',
        title: 'Invalid Zip Code',
        description: 'Please enter a valid 5-digit zip code',
      });
      return;
    }
    
    // Validate time window
    if (slotForm.window_start >= slotForm.window_end) {
      toast({
        variant: 'destructive',
        title: 'Invalid Time Window',
        description: 'Start time must be before end time',
      });
      return;
    }

    try {
      const slotData: any = {
        zip: slotForm.zip,
        window_start: slotForm.window_start,
        window_end: slotForm.window_end,
        capacity: slotForm.capacity,
        booked_count: 0,
        status: 'open',
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      };

      if (slotType === 'recurring') {
        // Recurring slot - use day_of_week, no specific date
        slotData.is_recurring = true;
        slotData.day_of_week = slotForm.day_of_week;
        slotData.date = ''; // Empty for recurring slots
      } else {
        // One-time slot - use specific date
        slotData.is_recurring = false;
        slotData.date = slotForm.date;
      }

      await addDoc(collection(db, 'slots'), slotData);

      toast({
        title: 'Success',
        description: `${slotType === 'recurring' ? 'Recurring' : 'One-time'} slot created`,
      });

      // Reset form
      setSlotForm({
        zip: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        day_of_week: 6,
        window_start: '09:00',
        window_end: '11:00',
        capacity: 4,
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
        q = query(visitsRef, orderBy('scheduled_for', 'asc'));
      } else {
        q = query(visitsRef, where('status', '==', visitFilter.status), orderBy('scheduled_for', 'asc'));
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

  // Load upcoming visits (next 7 days)
  const loadUpcomingVisits = async () => {
    try {
      const now = Timestamp.fromDate(startOfDay(new Date()));
      const sevenDaysLater = Timestamp.fromDate(endOfDay(addDays(new Date(), 7)));
      
      const visitsRef = collection(db, 'visits');
      // Query only by date range, filter status in code to avoid composite index requirement
      const q = query(
        visitsRef,
        where('scheduled_for', '>=', now),
        where('scheduled_for', '<=', sevenDaysLater),
        orderBy('scheduled_for', 'asc')
      );

      const snapshot = await getDocs(q);
      const data: VisitWithCustomer[] = [];

      for (const visitDoc of snapshot.docs) {
        const visit = { ...visitDoc.data(), id: visitDoc.id } as VisitWithCustomer;
        
        // Filter by status in code to avoid composite index
        if (visit.status !== 'scheduled') continue;
        
        // Get customer
        try {
          const customerSnap = await getDocs(query(collection(db, 'customers'), where('__name__', '==', visit.customer_uid)));
          if (!customerSnap.empty) {
            visit.customer = { ...customerSnap.docs[0].data(), uid: customerSnap.docs[0].id } as Customer;
          }
        } catch (e) {
          console.error('Error loading customer:', e);
        }

        // Get slot
        try {
          const slotSnap = await getDocs(query(collection(db, 'slots'), where('__name__', '==', visit.slot_id)));
          if (!slotSnap.empty) {
            visit.slot = { ...slotSnap.docs[0].data(), id: slotSnap.docs[0].id } as Slot;
          }
        } catch (e) {
          console.error('Error loading slot:', e);
        }

        data.push(visit);
      }

      setUpcomingVisits(data);
    } catch (error: any) {
      console.error('Error loading upcoming visits:', error);
    }
  };

  // Load technicians (users with admin or technician role from customers collection)
  const loadTechnicians = async () => {
    try {
      const customersRef = collection(db, 'customers');
      const snapshot = await getDocs(customersRef);
      const data = snapshot.docs
        .map(doc => ({
          ...doc.data(),
          uid: doc.id,
        }))
        .filter((user: any) => user.role === 'admin' || user.role === 'technician') as Technician[];
      setTechnicians(data);
    } catch (error: any) {
      console.error('Error loading technicians:', error);
    }
  };

  // Assign technician to visit
  const handleAssignTechnician = async (technicianUid: string) => {
    if (!selectedVisit) return;
    
    setAssigningTech(true);
    try {
      await updateDoc(doc(db, 'visits', selectedVisit.id), {
        technician_uid: technicianUid || null,
      });

      toast({
        title: 'Success',
        description: technicianUid ? 'Technician assigned' : 'Technician removed',
      });

      // Refresh visits
      await loadVisits();
      await loadUpcomingVisits();
      setSelectedVisit(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to assign technician',
      });
    } finally {
      setAssigningTech(false);
    }
  };

  // Pricing Functions
  const loadPricing = async () => {
    setPricingLoading(true);
    try {
      const pricingDoc = await getDocs(query(collection(db, 'pricing')));
      if (!pricingDoc.empty) {
        const data = pricingDoc.docs[0].data();
        setPricing({
          recurring_base: data.recurring_base || DEFAULT_PRICING.recurring_base,
          recurring_additional: data.recurring_additional || DEFAULT_PRICING.recurring_additional,
          onetime_base: data.onetime_base || DEFAULT_PRICING.onetime_base,
          onetime_additional: data.onetime_additional || DEFAULT_PRICING.onetime_additional,
        });
      }
    } catch (error: any) {
      console.error('Error loading pricing:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load pricing',
      });
    } finally {
      setPricingLoading(false);
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPricingLoading(true);
    try {
      // Use a fixed document ID for singleton pricing
      await setDoc(doc(db, 'pricing', 'default'), {
        recurring_base: pricing.recurring_base,
        recurring_additional: pricing.recurring_additional,
        onetime_base: pricing.onetime_base,
        onetime_additional: pricing.onetime_additional,
        updated_at: Timestamp.now(),
      });

      toast({
        title: 'Success',
        description: 'Pricing updated successfully',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update pricing',
      });
    } finally {
      setPricingLoading(false);
    }
  };

  // Messages Functions
  const loadMessages = async () => {
    setMessagesLoading(true);
    try {
      const messagesRef = collection(db, 'messages');
      const q = query(messagesRef, orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      const data: Message[] = [];
      snapshot.forEach((doc) => {
        data.push({ ...doc.data(), id: doc.id } as Message);
      });
      setMessages(data);
    } catch (error: any) {
      console.error('Error loading messages:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load messages',
      });
    } finally {
      setMessagesLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const customersRef = collection(db, 'customers');
      const snapshot = await getDocs(customersRef);
      const map: Record<string, Customer> = {};
      snapshot.forEach((doc) => {
        map[doc.id] = { ...doc.data(), uid: doc.id } as Customer;
      });
      setCustomersMap(map);
    } catch (error: any) {
      console.error('Error loading customers:', error);
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    try {
      await updateDoc(doc(db, 'messages', messageId), {
        status: 'closed',
      });
      toast({
        title: 'Success',
        description: 'Message marked as read',
      });
      loadMessages();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update message',
      });
    }
  };

  const handleDeleteMessage = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'messages', id));
      toast({
        title: 'Success',
        description: 'Message deleted',
      });
      loadMessages();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete message',
      });
    }
    setDeleteDialog({ open: false, type: '', id: '' });
  };

  const handleSignOut = async () => {
    await signOut();
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader
        title="Admin Dashboard"
        role={role as 'admin' | 'technician' | 'customer'}
        onSignOut={handleSignOut}
        onSwitchPortal={role === 'admin' ? () => setLocation('/tech') : undefined}
        switchPortalLabel={role === 'admin' ? 'Tech Portal' : undefined}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="visits" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 lg:flex lg:w-auto lg:grid-cols-none gap-0 lg:gap-1">
            <TabsTrigger value="visits" data-testid="tab-visits" className="col-span-2 lg:col-span-1">Visits</TabsTrigger>
            <TabsTrigger value="slots" data-testid="tab-slots" className="col-span-2 lg:col-span-1">Service Slots</TabsTrigger>
            <TabsTrigger value="zips" data-testid="tab-zips" className="col-span-2 lg:col-span-1">Zip Codes</TabsTrigger>
            <TabsTrigger value="pricing" data-testid="tab-pricing" className="col-span-3 lg:col-span-1">Pricing</TabsTrigger>
            <TabsTrigger value="messages" data-testid="tab-messages" className="relative col-span-3 lg:col-span-1">
              <Mail className="h-4 w-4 mr-2" />
              Messages
              {messages.filter(m => m.status === 'open').length > 0 && (
                <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-xs min-w-5 h-5">
                  {messages.filter(m => m.status === 'open').length}
                </Badge>
              )}
            </TabsTrigger>
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

                <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px]">Zip Code</TableHead>
                      <TableHead className="min-w-[80px]">Status</TableHead>
                      <TableHead className="min-w-[140px]">Actions</TableHead>
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
                </div>
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
                  {/* Slot Type Selection */}
                  <div className="space-y-3">
                    <Label>Slot Type</Label>
                    <RadioGroup 
                      value={slotType} 
                      onValueChange={(value) => setSlotType(value as 'one-time' | 'recurring')}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="recurring" id="recurring" data-testid="radio-recurring" />
                        <Label htmlFor="recurring" className="font-normal cursor-pointer">
                          Recurring (Monthly Plan)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="one-time" id="one-time" data-testid="radio-one-time" />
                        <Label htmlFor="one-time" className="font-normal cursor-pointer">
                          One-Time Service
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Zip Code */}
                  <div className="space-y-2">
                    <Label htmlFor="slot-zip">Service Zip Code</Label>
                    <Select
                      value={slotForm.zip}
                      onValueChange={(value) => setSlotForm({ ...slotForm, zip: value })}
                    >
                      <SelectTrigger id="slot-zip" data-testid="select-slot-zip">
                        <SelectValue placeholder="Select zip code" />
                      </SelectTrigger>
                      <SelectContent>
                        {zips.filter(z => z.active).map((zip) => (
                          <SelectItem key={zip.id} value={zip.zip}>
                            {zip.zip}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Date or Day of Week */}
                    {slotType === 'one-time' ? (
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
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="slot-day">Day of Week</Label>
                        <Select
                          value={slotForm.day_of_week.toString()}
                          onValueChange={(value) => setSlotForm({ ...slotForm, day_of_week: parseInt(value) })}
                        >
                          <SelectTrigger id="slot-day" data-testid="select-day-of-week">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Sunday</SelectItem>
                            <SelectItem value="1">Monday</SelectItem>
                            <SelectItem value="2">Tuesday</SelectItem>
                            <SelectItem value="3">Wednesday</SelectItem>
                            <SelectItem value="4">Thursday</SelectItem>
                            <SelectItem value="5">Friday</SelectItem>
                            <SelectItem value="6">Saturday</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

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
                    Create {slotType === 'recurring' ? 'Recurring' : 'One-Time'} Slot
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Existing Slots</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Date/Schedule</TableHead>
                      <TableHead className="min-w-[120px]">Time Window</TableHead>
                      <TableHead className="min-w-[140px]">Booked / Capacity</TableHead>
                      <TableHead className="min-w-[80px]">Status</TableHead>
                      <TableHead className="min-w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slots.map((slot) => (
                      <TableRow key={slot.id} data-testid={`row-slot-${slot.id}`}>
                        <TableCell>
                          {slot.is_recurring ? (
                            <div>
                              <div className="font-medium">Every {getDayName(slot.day_of_week || 0)}</div>
                              <Badge variant="secondary" className="mt-1">Recurring</Badge>
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium">{format(new Date(slot.date), 'MMM d, yyyy')}</div>
                              <Badge variant="outline" className="mt-1">One-Time</Badge>
                            </div>
                          )}
                        </TableCell>
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Visits Tab */}
          <TabsContent value="visits" className="space-y-4">
            {/* Upcoming Week Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Week
                </CardTitle>
                <CardDescription>Visits scheduled for the next 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingVisits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming visits</p>
                ) : (
                  <div className="overflow-x-auto -mx-6 px-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Date</TableHead>
                          <TableHead className="min-w-[120px]">Time</TableHead>
                          <TableHead className="min-w-[120px]">Customer</TableHead>
                          <TableHead className="min-w-[180px]">Address</TableHead>
                          <TableHead className="min-w-[100px]">Technician</TableHead>
                          <TableHead className="min-w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {upcomingVisits.map((visit) => (
                          <TableRow 
                            key={visit.id} 
                            data-testid={`row-upcoming-visit-${visit.id}`}
                            className={visit.technician_uid ? 'bg-green-50 dark:bg-green-950/20' : ''}
                          >
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
                              {visit.technician_uid ? (
                                <Badge variant="secondary">
                                  {technicians.find(t => t.uid === visit.technician_uid)?.name || 'Assigned'}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedVisit(visit)}
                                data-testid={`button-assign-tech-${visit.id}`}
                              >
                                <User className="h-4 w-4 mr-1" />
                                Assign
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Visits</CardTitle>
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

                <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Date</TableHead>
                      <TableHead className="min-w-[120px]">Time</TableHead>
                      <TableHead className="min-w-[120px]">Customer</TableHead>
                      <TableHead className="min-w-[180px]">Address</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visits.slice(visitsPage * visitsPerPage, (visitsPage + 1) * visitsPerPage).map((visit) => (
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
                </div>
                
                {/* Pagination Controls */}
                {visits.length > visitsPerPage && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      <span className="hidden sm:inline">Showing </span>
                      {visitsPage * visitsPerPage + 1} to {Math.min((visitsPage + 1) * visitsPerPage, visits.length)} of {visits.length}
                      <span className="hidden sm:inline"> visits</span>
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setVisitsPage(Math.max(0, visitsPage - 1))}
                        disabled={visitsPage === 0}
                        data-testid="button-prev-visits"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setVisitsPage(visitsPage + 1)}
                        disabled={(visitsPage + 1) * visitsPerPage >= visits.length}
                        data-testid="button-next-visits"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Customer Messages
                </CardTitle>
                <CardDescription>Messages from customers via contact form</CardDescription>
              </CardHeader>
              <CardContent>
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No messages yet</p>
                ) : (
                  <div className="overflow-x-auto -mx-6 px-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Customer</TableHead>
                          <TableHead className="min-w-[120px]">Date</TableHead>
                          <TableHead className="min-w-[300px]">Message</TableHead>
                          <TableHead className="min-w-[100px]">Status</TableHead>
                          <TableHead className="min-w-[120px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {messages.map((message) => (
                          <TableRow key={message.id} data-testid={`row-message-${message.id}`}>
                            <TableCell className="font-medium">
                              {customersMap[message.customer_uid]?.name || 'Unknown'}
                            </TableCell>
                            <TableCell>
                              {format(message.created_at.toDate(), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-sm">{message.subject}</p>
                                <p className="text-sm text-muted-foreground line-clamp-2">{message.body}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={message.status === 'open' ? 'destructive' : 'secondary'}>
                                {message.status === 'open' ? 'Unread' : 'Read'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {message.status === 'open' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMarkAsRead(message.id)}
                                    data-testid={`button-read-${message.id}`}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setDeleteDialog({ open: true, type: 'message', id: message.id })}
                                  data-testid={`button-delete-message-${message.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Pricing Configuration
                </CardTitle>
                <CardDescription>Manage service pricing for quotes</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSavePricing} className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Recurring Pricing */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Recurring Service Pricing</h3>
                      <div className="space-y-2">
                        <Label htmlFor="recurring-base">Base Price (First Dog)</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            id="recurring-base"
                            type="number"
                            min="0"
                            step="0.01"
                            value={pricing.recurring_base}
                            onChange={(e) => setPricing({ ...pricing, recurring_base: parseFloat(e.target.value) || 0 })}
                            required
                            data-testid="input-recurring-base"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="recurring-additional">Additional Dog Price</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            id="recurring-additional"
                            type="number"
                            min="0"
                            step="0.01"
                            value={pricing.recurring_additional}
                            onChange={(e) => setPricing({ ...pricing, recurring_additional: parseFloat(e.target.value) || 0 })}
                            required
                            data-testid="input-recurring-additional"
                          />
                        </div>
                      </div>
                    </div>

                    {/* One-Time Pricing */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">One-Time Service Pricing</h3>
                      <div className="space-y-2">
                        <Label htmlFor="onetime-base">Base Price (First Dog)</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            id="onetime-base"
                            type="number"
                            min="0"
                            step="0.01"
                            value={pricing.onetime_base}
                            onChange={(e) => setPricing({ ...pricing, onetime_base: parseFloat(e.target.value) || 0 })}
                            required
                            data-testid="input-onetime-base"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="onetime-additional">Additional Dog Price</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            id="onetime-additional"
                            type="number"
                            min="0"
                            step="0.01"
                            value={pricing.onetime_additional}
                            onChange={(e) => setPricing({ ...pricing, onetime_additional: parseFloat(e.target.value) || 0 })}
                            required
                            data-testid="input-onetime-additional"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-3">Pricing Examples</h4>
                    <div className="grid gap-3 md:grid-cols-2 text-sm text-muted-foreground">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">Recurring:</p>
                        <p>1 dog: ${pricing.recurring_base.toFixed(2)}</p>
                        <p>2 dogs: ${(pricing.recurring_base + pricing.recurring_additional).toFixed(2)}</p>
                        <p>3 dogs: ${(pricing.recurring_base + pricing.recurring_additional * 2).toFixed(2)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">One-Time:</p>
                        <p>1 dog: ${pricing.onetime_base.toFixed(2)}</p>
                        <p>2 dogs: ${(pricing.onetime_base + pricing.onetime_additional).toFixed(2)}</p>
                        <p>3 dogs: ${(pricing.onetime_base + pricing.onetime_additional * 2).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={pricingLoading} data-testid="button-save-pricing">
                    {pricingLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Pricing'
                    )}
                  </Button>
                </form>
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
                } else if (deleteDialog.type === 'message') {
                  handleDeleteMessage(deleteDialog.id);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Visit Detail Dialog */}
      <Dialog open={!!selectedVisit} onOpenChange={(open) => !open && setSelectedVisit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Technician</DialogTitle>
            <DialogDescription>
              Assign a technician to this visit
            </DialogDescription>
          </DialogHeader>
          
          {selectedVisit && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Visit Details</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Customer: {selectedVisit.customer?.name}</p>
                  <p>Date: {format(selectedVisit.scheduled_for.toDate(), 'EEEE, MMM d, yyyy')}</p>
                  <p>Time: {selectedVisit.slot?.window_start} - {selectedVisit.slot?.window_end}</p>
                  <p>Address: {selectedVisit.customer?.address.street}, {selectedVisit.customer?.address.city}, {selectedVisit.customer?.address.state} {selectedVisit.customer?.address.zip}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="technician">Technician</Label>
                <Select
                  value={selectedVisit.technician_uid || 'unassigned'}
                  onValueChange={handleAssignTechnician}
                  disabled={assigningTech}
                >
                  <SelectTrigger id="technician" data-testid="select-technician">
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.uid} value={tech.uid}>
                        {tech.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {assigningTech && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Updating...</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
