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
  dog_names?: string[];
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
  zip: string; // Service area zip code
  date: string; // YYYY-MM-DD (for one-time slots) or empty for recurring
  window_start: string; // HH:mm
  window_end: string; // HH:mm
  status: 'open' | 'held' | 'booked' | 'blocked';
  capacity: number;
  booked_count: number;
  // Recurring schedule fields
  is_recurring?: boolean; // true for recurring slots (weekly)
  day_of_week?: number; // 0-6 (0 = Sunday, 1 = Monday, etc.) for recurring slots
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
  // Recurring schedule tracking
  is_recurring?: boolean; // true if this is a recurring monthly plan
  recurring_group_id?: string; // UUID linking all visits from same recurring subscription
  recurring_day_of_week?: number; // 0-6 for recurring visits
  recurring_window_start?: string; // HH:mm for recurring visits
  recurring_window_end?: string; // HH:mm for recurring visits
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

// Pricing Types
export interface Pricing {
  id: string;
  recurring_base: number;
  recurring_additional: number;
  onetime_base: number;
  onetime_additional: number;
  updated_at: Timestamp;
}

export interface InsertPricing extends Omit<Pricing, 'id' | 'updated_at'> {}

// Default pricing values (fallback)
export const DEFAULT_PRICING: Omit<Pricing, 'id' | 'updated_at'> = {
  recurring_base: 15,
  recurring_additional: 5,
  onetime_base: 20,
  onetime_additional: 7,
};

// Pricing calculation
export const calculateQuote = (dogCount: number, isRecurring: boolean = true, pricing?: Omit<Pricing, 'id' | 'updated_at'>): number => {
  const config = pricing || DEFAULT_PRICING;
  if (isRecurring) {
    return config.recurring_base + (dogCount - 1) * config.recurring_additional;
  } else {
    return config.onetime_base + (dogCount - 1) * config.onetime_additional;
  }
};

// Helper function to calculate next occurrence of a recurring visit
export const calculateNextServiceDate = (dayOfWeek: number, windowStart?: string): Date => {
  const now = new Date();
  const todayDayOfWeek = now.getDay();
  
  // Calculate days until next occurrence
  let daysUntilNext = dayOfWeek - todayDayOfWeek;
  
  // If it's the same day, check if the time window has passed
  if (daysUntilNext === 0 && windowStart) {
    const [hours, minutes] = windowStart.split(':').map(Number);
    const windowTime = new Date(now);
    windowTime.setHours(hours, minutes, 0, 0);
    
    // If the window has passed today, schedule for next week
    if (now > windowTime) {
      daysUntilNext = 7;
    }
  } else if (daysUntilNext < 0) {
    // Day has passed this week, schedule for next week
    daysUntilNext += 7;
  }
  
  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + daysUntilNext);
  
  // Set the time to the window start time
  if (windowStart) {
    const [hours, minutes] = windowStart.split(':').map(Number);
    nextDate.setHours(hours, minutes, 0, 0);
  } else {
    nextDate.setHours(0, 0, 0, 0);
  }
  
  return nextDate;
};

// Helper to get day name from number
export const getDayName = (dayOfWeek: number): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || 'Unknown';
};

// Helper to format recurring schedule display
export const formatRecurringSchedule = (dayOfWeek: number, windowStart: string, windowEnd: string): string => {
  const dayName = getDayName(dayOfWeek);
  return `Every ${dayName} ${windowStart} - ${windowEnd}`;
};
