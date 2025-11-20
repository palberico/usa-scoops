import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface StripePaymentFormProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  buttonText?: string;
  amount?: number;
}

export function StripePaymentForm({
  onSuccess,
  onError,
  buttonText = "Pay Now",
  amount,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/portal`,
        },
        redirect: 'if_required',
      });

      if (error) {
        const errorMessage = error.message || 'Payment failed';
        toast({
          title: "Payment Failed",
          description: errorMessage,
          variant: "destructive",
        });
        onError?.(errorMessage);
      } else {
        toast({
          title: "Payment Successful",
          description: "Your payment has been processed successfully!",
        });
        onSuccess?.();
      }
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred';
      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive",
      });
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 border rounded-lg bg-card">
        <PaymentElement 
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {amount && (
        <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
          <span className="font-semibold">Total Amount:</span>
          <span className="text-2xl font-bold text-primary">
            ${amount.toFixed(2)}
          </span>
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        size="lg"
        data-testid="button-submit-payment"
      >
        {isProcessing ? "Processing..." : buttonText}
      </Button>
    </form>
  );
}
