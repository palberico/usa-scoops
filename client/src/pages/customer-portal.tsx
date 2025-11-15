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
import { Loader2, Calendar, MapPin, MessageSquare, LogOut } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, doc, getDoc, orderBy, Timestamp } from 'firebase/firestore';
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
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold" data-testid="heading-customer-portal">Customer Portal</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {customer?.name}
              </span>
              <Button variant="outline" onClick={handleSignOut} data-testid="button-logout">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6">
          {/* Next Visit Card */}
          <Card data-testid="card-next-visit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Next Scheduled Visit
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextVisit ? (
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-lg" data-testid="text-visit-date">
                        {format(nextVisit.visit.scheduled_for.toDate(), 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="text-muted-foreground" data-testid="text-visit-time">
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
                </div>
              ) : (
                <p className="text-muted-foreground" data-testid="text-no-visits">
                  No upcoming visits scheduled
                </p>
              )}
            </CardContent>
          </Card>

          {/* Visit History */}
          <Card>
            <CardHeader>
              <CardTitle>Visit History</CardTitle>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
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
    </div>
  );
}
