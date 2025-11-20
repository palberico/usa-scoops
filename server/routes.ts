import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import Stripe from "stripe";
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
let db: Firestore | null = null;
try {
  if (getApps().length === 0) {
    initializeApp();
  }
  db = getFirestore();
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Firebase Admin initialization failed:', error);
  console.log('Payment validation will be disabled. For production use, configure Firebase Admin credentials.');
}

// Initialize Stripe with secret key from environment
// Reference: blueprint:javascript_stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-11-17.clover",
});

// Helper function to calculate quote server-side
const calculateQuoteServerSide = (dogCount: number, isRecurring: boolean, pricing: any): number => {
  if (isRecurring) {
    return pricing.recurring_base + (dogCount - 1) * pricing.recurring_additional;
  } else {
    return pricing.onetime_base + (dogCount - 1) * pricing.onetime_additional;
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Stripe payment intent creation - server-side amount validation
  // Security: Never trust client-provided data, always fetch from Firestore
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { customerId, slotId } = req.body;

      // Validate required fields
      if (!customerId || !slotId) {
        return res.status(400).json({ 
          error: "Missing required booking information" 
        });
      }

      // Check if Firebase Admin is available
      if (!db) {
        return res.status(503).json({ 
          error: "Payment service temporarily unavailable. Please contact support." 
        });
      }

      // Fetch customer data to get dog count (NEVER trust client)
      const customerDoc = await db.collection('customers').doc(customerId).get();
      if (!customerDoc.exists) {
        return res.status(404).json({ error: "Customer not found" });
      }
      const customerData = customerDoc.data();
      if (!customerData) {
        return res.status(404).json({ error: "Invalid customer data" });
      }
      const dogCount = customerData.dog_count || 1;

      // Fetch slot data from Firestore to validate
      const slotDoc = await db.collection('slots').doc(slotId).get();
      if (!slotDoc.exists) {
        return res.status(404).json({ error: "Slot not found" });
      }
      const slotData = slotDoc.data();
      if (!slotData) {
        return res.status(404).json({ error: "Invalid slot data" });
      }
      
      // Re-check slot capacity before creating payment intent
      const currentBooked = slotData.booked_count || 0;
      const capacity = slotData.capacity || 0;
      if (currentBooked >= capacity) {
        return res.status(409).json({ error: "Slot is no longer available" });
      }

      // Fetch pricing configuration from Firestore
      const pricingSnapshot = await db.collection('pricing').limit(1).get();
      let pricing = {
        recurring_base: 15,
        recurring_additional: 5,
        onetime_base: 20,
        onetime_additional: 7,
      };
      
      if (!pricingSnapshot.empty) {
        const pricingDoc = pricingSnapshot.docs[0].data();
        pricing = {
          recurring_base: pricingDoc.recurring_base,
          recurring_additional: pricingDoc.recurring_additional,
          onetime_base: pricingDoc.onetime_base,
          onetime_additional: pricingDoc.onetime_additional,
        };
      }

      // Calculate amount server-side (NEVER trust client)
      const amount = calculateQuoteServerSide(dogCount, slotData.is_recurring ?? true, pricing);

      // Create payment intent with validated amount
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert dollars to cents
        currency: "usd",
        metadata: {
          customerId,
          slotId,
          dogCount: dogCount.toString(),
          isRecurring: (slotData.is_recurring ?? true).toString(),
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        amount, // Return validated amount to frontend for display
      });
    } catch (error: any) {
      console.error("Payment intent error:", error.message);
      // Don't expose internal error details to client
      res.status(500).json({ 
        error: "Unable to process payment. Please try again." 
      });
    }
  });

  // Stripe subscription creation for recurring payments
  // Reference: blueprint:javascript_stripe
  app.post("/api/create-subscription", async (req, res) => {
    try {
      const { 
        priceId, 
        customerEmail, 
        customerName, 
        metadata 
      } = req.body;

      if (!priceId) {
        return res.status(400).json({ message: "Price ID is required" });
      }

      if (!customerEmail) {
        return res.status(400).json({ message: "Customer email is required" });
      }

      // Create or retrieve Stripe customer
      const customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName,
        metadata: metadata || {},
      });

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { 
          save_default_payment_method: 'on_subscription' 
        },
        expand: ['latest_invoice.payment_intent'],
      });

      // Extract client secret from expanded payment intent
      const latestInvoice = subscription.latest_invoice;
      let clientSecret: string | null = null;

      if (latestInvoice && typeof latestInvoice !== 'string') {
        const paymentIntent = (latestInvoice as any).payment_intent;
        if (paymentIntent && typeof paymentIntent !== 'string') {
          clientSecret = paymentIntent.client_secret || null;
        }
      }

      res.json({
        subscriptionId: subscription.id,
        customerId: customer.id,
        clientSecret,
      });
    } catch (error: any) {
      console.error("Subscription creation error:", error.message);
      // Don't expose internal error details to client
      res.status(500).json({ 
        error: "Unable to create subscription. Please try again." 
      });
    }
  });

  // Webhook endpoint for Stripe events (for future use)
  app.post("/api/stripe-webhook", async (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      return res.status(400).send('Missing stripe-signature header');
    }

    try {
      // Note: In production, you should verify the webhook signature
      // using stripe.webhooks.constructEvent with a webhook secret
      const event = req.body;

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          console.log('Payment succeeded:', event.data.object.id);
          break;
        case 'payment_intent.payment_failed':
          console.log('Payment failed:', event.data.object.id);
          break;
        case 'customer.subscription.updated':
          console.log('Subscription updated:', event.data.object.id);
          break;
        case 'customer.subscription.deleted':
          console.log('Subscription cancelled:', event.data.object.id);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
