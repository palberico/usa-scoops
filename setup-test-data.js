import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setupTestData() {
  console.log('Setting up test data...');
  
  // Add service zip
  const serviceZipRef = await addDoc(collection(db, 'service_zips'), {
    zip_code: '90210',
    active: true
  });
  console.log('Created service zip:', serviceZipRef.id);
  
  // Add recurring slot
  const recurringSlotRef = await addDoc(collection(db, 'slots'), {
    zip_code: '90210',
    is_recurring: true,
    day_of_week: 2, // Tuesday
    window_start: '09:00',
    window_end: '11:00',
    capacity: 10,
    booked: 0
  });
  console.log('Created recurring slot:', recurringSlotRef.id);
  
  // Add one-time slot
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  
  const oneTimeSlotRef = await addDoc(collection(db, 'slots'), {
    zip_code: '90210',
    is_recurring: false,
    date: dateStr,
    window_start: '14:00',
    window_end: '16:00',
    capacity: 10,
    booked: 0
  });
  console.log('Created one-time slot:', oneTimeSlotRef.id);
  
  console.log('Test data setup complete!');
  process.exit(0);
}

setupTestData().catch(error => {
  console.error('Error setting up test data:', error);
  process.exit(1);
});
