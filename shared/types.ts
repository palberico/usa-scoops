import { Timestamp } from 'firebase/firestore';

// Customer Types
export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  gate_code?: string;
  notes?: string;
}

export interface Customer {
  uid: string;
  name: string;
  email: string;
  phone: string;
  address: Address;
  dog_count: number;
  status: 'active' | 'paused' | 'prospect';
  role?: 'customer' | 'technician' | 'admin';
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface InsertCustomer extends Omit<Customer, 'created_at' | 'updated_at'> {}

// Service Zip Types
export interface ServiceZip {
  id: string;
  zip: string;
  active: boolean;
}

export interface InsertServiceZip extends Omit<ServiceZip, 'id'> {}

// Slot Types
export interface Slot {
  id: string;
  date: string; // YYYY-MM-DD
  window_start: string; // HH:mm
  window_end: string; // HH:mm
  status: 'open' | 'held' | 'booked' | 'blocked';
  capacity: number;
  booked_count: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface InsertSlot extends Omit<Slot, 'id' | 'created_at' | 'updated_at' | 'booked_count'> {
  booked_count?: number;
}

// Visit Types
export interface Visit {
  id: string;
  customer_uid: string;
  slot_id: string;
  scheduled_for: Timestamp;
  status: 'scheduled' | 'completed' | 'skipped' | 'canceled';
  technician_uid?: string;
  notes?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface InsertVisit extends Omit<Visit, 'id' | 'created_at' | 'updated_at'> {}

// Technician Types
export interface Technician {
  uid: string;
  name: string;
  email: string;
  phone: string;
  service_zips: string[];
  active: boolean;
  role?: 'customer' | 'technician' | 'admin';
}

export interface InsertTechnician extends Technician {}

// Message Types
export interface Message {
  id: string;
  customer_uid: string;
  subject: string;
  body: string;
  status: 'open' | 'closed';
  created_at: Timestamp;
}

export interface InsertMessage extends Omit<Message, 'id' | 'created_at'> {}

// Waitlist Types
export interface Waitlist {
  id: string;
  name: string;
  email: string;
  zip: string;
  created_at: Timestamp;
}

export interface InsertWaitlist extends Omit<Waitlist, 'id' | 'created_at'> {}

// User Role Type (stored in customers or technicians collection)
export type UserRole = 'customer' | 'technician' | 'admin';

// Pricing calculation
export const calculateQuote = (dogCount: number): number => {
  const basePrice = 15;
  const pricePerDog = 5;
  return basePrice + (dogCount - 1) * pricePerDog;
};
