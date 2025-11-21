import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar } from 'lucide-react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import BookingWizard from '@/components/BookingWizard';
import type { Customer } from '@shared/types';
import { DEFAULT_PRICING } from '@shared/types';

export default function BookService() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [serviceType, setServiceType] = useState<'recurring' | 'onetime' | null>(null);

  useEffect(() => {
    loadCustomerData();
  }, [user]);

  const loadCustomerData = async () => {
    if (!user) {
      setLocation('/login');
      return;
    }

    try {
      // Fetch customer data and pricing in parallel
      const [customerDoc, pricingSnapshot] = await Promise.all([
        getDoc(doc(db, 'customers', user.uid)),
        getDocs(collection(db, 'pricing'))
      ]);

      // Load pricing from Firestore
      if (!pricingSnapshot.empty) {
        const data = pricingSnapshot.docs[0].data();
        setPricing({
          recurring_base: data.recurring_base || DEFAULT_PRICING.recurring_base,
          recurring_additional: data.recurring_additional || DEFAULT_PRICING.recurring_additional,
          onetime_base: data.onetime_base || DEFAULT_PRICING.onetime_base,
          onetime_additional: data.onetime_additional || DEFAULT_PRICING.onetime_additional,
        });
      }

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
              {serviceType ? 'Select a time slot for your pet waste removal service' : 'Choose your service type'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!serviceType ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="text-sm font-medium text-foreground">Service Type</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setServiceType('recurring')}
                      className="p-4 rounded-lg border-2 border-border hover-elevate transition-all"
                      data-testid="button-service-recurring"
                    >
                      <div className="font-semibold text-left">Recurring</div>
                      <div className="text-sm text-muted-foreground text-left">Monthly service</div>
                    </button>
                    <button
                      onClick={() => setServiceType('onetime')}
                      className="p-4 rounded-lg border-2 border-border hover-elevate transition-all"
                      data-testid="button-service-onetime"
                    >
                      <div className="font-semibold text-left">One-Time</div>
                      <div className="text-sm text-muted-foreground text-left">Single visit</div>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setServiceType(null)}
                  className="mb-4"
                  data-testid="button-change-service-type"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Change Service Type
                </Button>
                {user && (
                  <BookingWizard
                    customerId={user.uid}
                    customerData={{
                      zip: customer.address.zip,
                      dog_count: customer.dog_count,
                    }}
                    serviceType={serviceType}
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                    showPaymentStep={true}
                    pricing={pricing}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
