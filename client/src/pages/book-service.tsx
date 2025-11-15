import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import BookingWizard from '@/components/BookingWizard';
import type { Customer } from '@shared/types';

export default function BookService() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomerData();
  }, [user]);

  const loadCustomerData = async () => {
    if (!user) {
      setLocation('/login');
      return;
    }

    try {
      const customerDoc = await getDoc(doc(db, 'customers', user.uid));
      if (customerDoc.exists()) {
        const customerData = { ...customerDoc.data(), uid: customerDoc.id } as Customer;
        
        // Validate required customer data
        if (!customerData.address?.zip || !customerData.dog_count) {
          console.error('Missing required customer data');
          setLocation('/portal');
          return;
        }
        
        setCustomer(customerData);
      } else {
        setLocation('/portal');
      }
    } catch (error) {
      console.error('Failed to load customer data:', error);
      setLocation('/portal');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    setLocation('/portal');
  };

  const handleCancel = () => {
    setLocation('/portal');
  };

  if (loading || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white dark:bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Button
              variant="ghost"
              onClick={handleCancel}
              data-testid="button-back-to-portal"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Portal
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              Book a Service
            </CardTitle>
            <CardDescription>
              Select a time slot for your pet waste removal service
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user && (
              <BookingWizard
                customerId={user.uid}
                customerData={{
                  zip: customer.address.zip,
                  dog_count: customer.dog_count,
                }}
                onComplete={handleComplete}
                onCancel={handleCancel}
                showPaymentStep={false}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
