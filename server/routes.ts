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
    // Use service account credentials from environment
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is required for Firebase Admin');
    }
    
    // Parse the service account JSON
    const serviceAccountObj = JSON.parse(serviceAccount);
    
    initializeApp({
      credential: cert(serviceAccountObj)
    });
  }
  db = getFirestore();
  console.log('Firebase Admin initialized successfully with service account');
} catch (error) {
  console.error('Firebase Admin initialization failed:', error);
  throw new Error('Firebase Admin setup failed. Payment functionality is unavailable.');
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

// Visit buffer size constant (8 visits for recurring bookings)
const VISIT_BUFFER_SIZE = 8;

// Helper function to calculate next service date for recurring slots
const calculateNextServiceDate = (dayOfWeek: number, windowStart: string): Date => {
  const now = new Date();
  const currentDay = now.getDay();
  const daysUntilNext = (dayOfWeek - currentDay + 7) % 7;
  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + (daysUntilNext === 0 ? 7 : daysUntilNext));
  
  const [hours, minutes] = windowStart.split(':').map(Number);
  nextDate.setHours(hours, minutes, 0, 0);
  
  return nextDate;
};

// Webhook handler for successful payment - Creates booking in Firestore
async function handlePaymentSuccess(paymentIntent: any) {
  if (!db) {
    console.error('Firebase Admin not available - cannot create booking');
    return;
  }

  const { id: paymentIntentId, metadata } = paymentIntent;
  const { customerId, slotId } = metadata;

  console.log(`Processing payment success for intent: ${paymentIntentId}`);

  try {
    // Check if this payment has already been processed (idempotency)
    const paymentTrackingRef = db.collection('payment_tracking').doc(paymentIntentId);
    const paymentTrackingDoc = await paymentTrackingRef.get();
    
    if (paymentTrackingDoc.exists) {
      console.log(`Payment ${paymentIntentId} already processed - skipping`);
      return;
    }

    // Get slot and customer data
    const slotDoc = await db.collection('slots').doc(slotId).get();
    if (!slotDoc.exists) {
      throw new Error(`Slot ${slotId} not found`);
    }
    const slotData = slotDoc.data();

    // Create booking with transaction to ensure atomicity
    await db.runTransaction(async (transaction) => {
      // Re-check slot capacity
      const freshSlot = await transaction.get(slotDoc.ref);
      if (!freshSlot.exists) {
        throw new Error('Slot no longer exists');
      }
      const freshSlotData = freshSlot.data();
      if (freshSlotData!.booked_count >= freshSlotData!.capacity) {
        throw new Error('Slot is full');
      }

      // Create visits
      const visitsToCreate = slotData!.is_recurring ? VISIT_BUFFER_SIZE : 1;
      const recurringGroupId = slotData!.is_recurring ? crypto.randomUUID() : undefined;

      for (let i = 0; i < visitsToCreate; i++) {
        let scheduledDate: Date;
        
        if (slotData!.is_recurring) {
          const firstDate = calculateNextServiceDate(
            slotData!.day_of_week || 0, 
            slotData!.window_start
          );
          scheduledDate = new Date(firstDate);
          scheduledDate.setDate(firstDate.getDate() + (i * 7));
        } else {
          const dateTimeString = `${slotData!.date} ${slotData!.window_start}`;
          scheduledDate = new Date(dateTimeString);
        }
        
        const visitData: any = {
          customer_uid: customerId,
          slot_id: slotId,
          scheduled_for: scheduledDate,
          status: 'scheduled',
          notes: '',
          created_at: new Date(),
          updated_at: new Date(),
          payment_intent_id: paymentIntentId,
        };
        
        if (slotData!.is_recurring) {
          visitData.is_recurring = true;
          visitData.recurring_group_id = recurringGroupId;
          visitData.recurring_day_of_week = slotData!.day_of_week;
          visitData.recurring_window_start = slotData!.window_start;
          visitData.recurring_window_end = slotData!.window_end;
        } else {
          visitData.is_recurring = false;
        }

        const visitRef = db!.collection('visits').doc();
        transaction.set(visitRef, visitData);
      }

      // Update slot booked count
      transaction.update(slotDoc.ref, {
        booked_count: freshSlotData!.booked_count + 1,
      });

      // Mark payment as processed
      transaction.set(paymentTrackingRef, {
        payment_intent_id: paymentIntentId,
        customer_id: customerId,
        slot_id: slotId,
        processed_at: new Date(),
        status: 'completed',
      });
    });

    console.log(`Successfully created booking for payment intent: ${paymentIntentId}`);
  } catch (error: any) {
    console.error(`Failed to create booking for payment ${paymentIntentId}:`, error.message);
    throw error;
  }
}

// Webhook handler for failed payment
async function handlePaymentFailed(paymentIntent: any) {
  const { id: paymentIntentId, metadata } = paymentIntent;
  console.log(`Payment failed for intent: ${paymentIntentId}`, metadata);
  
  if (!db) return;

  // Track failed payment
  try {
    await db.collection('payment_tracking').doc(paymentIntentId).set({
      payment_intent_id: paymentIntentId,
      customer_id: metadata.customerId,
      slot_id: metadata.slotId,
      processed_at: new Date(),
      status: 'failed',
    });
  } catch (error: any) {
    console.error(`Failed to track payment failure: ${error.message}`);
  }
}

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
        paymentIntentId: paymentIntent.id, // Return for polling
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

  // Booking status polling endpoint - Check if payment has been processed
  app.get("/api/booking-status/:paymentIntentId", async (req, res) => {
    try {
      const { paymentIntentId } = req.params;

      if (!db) {
        return res.status(503).json({ 
          error: "Service temporarily unavailable" 
        });
      }

      // Check payment tracking
      const paymentTrackingDoc = await db.collection('payment_tracking')
        .doc(paymentIntentId)
        .get();

      if (!paymentTrackingDoc.exists) {
        return res.json({ 
          status: 'pending',
          message: 'Payment is being processed'
        });
      }

      const trackingData = paymentTrackingDoc.data();
      
      if (trackingData!.status === 'completed') {
        // Find the created visits
        const visitsSnapshot = await db.collection('visits')
          .where('payment_intent_id', '==', paymentIntentId)
          .limit(1)
          .get();

        return res.json({
          status: 'completed',
          message: 'Booking confirmed',
          hasVisits: !visitsSnapshot.empty
        });
      } else if (trackingData!.status === 'failed') {
        return res.json({
          status: 'failed',
          message: 'Payment failed'
        });
      }

      return res.json({
        status: 'pending',
        message: 'Payment is being processed'
      });
    } catch (error: any) {
      console.error("Booking status check error:", error.message);
      res.status(500).json({ 
        error: "Unable to check booking status" 
      });
    }
  });

  // Webhook endpoint for Stripe payment events - Production-ready
  app.post("/api/stripe-webhook", async (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      console.error('Webhook error: Missing stripe-signature header');
      return res.status(400).send('Missing stripe-signature header');
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('Webhook error: STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).send('Webhook secret not configured');
    }

    let event: any;

    try {
      // Verify webhook signature to ensure request is from Stripe
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    // Handle verified webhook events
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook processing error:", error.message);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
