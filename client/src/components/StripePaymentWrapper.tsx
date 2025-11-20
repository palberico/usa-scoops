import { useEffect, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { StripePaymentForm } from './StripePaymentForm';

// Load Stripe outside of component to avoid recreating on every render
// Reference: blueprint:javascript_stripe
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface StripePaymentWrapperProps {
  clientSecret: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  amount?: number;
  buttonText?: string;
}

export function StripePaymentWrapper({
  clientSecret,
  onSuccess,
  onError,
  amount,
  buttonText,
}: StripePaymentWrapperProps) {
  const [options, setOptions] = useState<StripeElementsOptions | null>(null);

  useEffect(() => {
    if (clientSecret) {
      setOptions({
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#1e40af', // Navy blue from USA Scoops branding
            colorBackground: '#ffffff',
            colorText: '#1f2937',
            colorDanger: '#dc2626',
            fontFamily: 'Roboto, system-ui, sans-serif',
            spacingUnit: '4px',
            borderRadius: '6px',
          },
        },
      });
    }
  }, [clientSecret]);

  if (!options) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <StripePaymentForm
        onSuccess={onSuccess}
        onError={onError}
        amount={amount}
        buttonText={buttonText}
      />
    </Elements>
  );
}
