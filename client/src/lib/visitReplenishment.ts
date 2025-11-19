import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Visit } from '@shared/types';

const VISIT_BUFFER_SIZE = 8;

export interface ReplenishVisitsParams {
  recurringGroupId: string;
  customerUid: string;
  slotId: string;
  recurringDayOfWeek: number;
  recurringWindowStart: string;
  recurringWindowEnd: string;
}

/**
 * Ensures that a recurring visit group maintains an 8-visit rolling buffer.
 * Creates new visits to bring the total future scheduled visits to 8.
 * Only counts visits scheduled for the future (ignores overdue visits).
 * 
 * @param params - The recurring visit configuration
 * @param completedVisitDate - Optional: the date of the visit that was just completed (used as fallback if no future visits exist)
 * @returns The number of visits created
 */
export async function replenishVisits(
  params: ReplenishVisitsParams,
  completedVisitDate?: Date
): Promise<number> {
  const {
    recurringGroupId,
    customerUid,
    slotId,
    recurringDayOfWeek,
    recurringWindowStart,
    recurringWindowEnd,
  } = params;

  const now = Timestamp.now();

  // Count future scheduled visits in this recurring group (exclude past-due visits)
  const futureVisitsQuery = query(
    collection(db, 'visits'),
    where('recurring_group_id', '==', recurringGroupId),
    where('status', '==', 'scheduled'),
    where('scheduled_for', '>=', now)
  );
  
  const futureVisitsSnapshot = await getDocs(futureVisitsQuery);
  const futureVisits = futureVisitsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Visit));
  
  // Sort by scheduled_for to find the latest
  futureVisits.sort((a, b) => b.scheduled_for.toDate().getTime() - a.scheduled_for.toDate().getTime());
  
  const visitsToCreate = VISIT_BUFFER_SIZE - futureVisits.length;
  
  if (visitsToCreate <= 0) {
    return 0; // Buffer is full
  }
  
  // Find the latest scheduled visit date
  // If no future visits exist, use the completed visit date or current date
  const latestVisitDate = futureVisits.length > 0 
    ? futureVisits[0].scheduled_for.toDate() 
    : (completedVisitDate || new Date());
  
  // Create new visits to maintain buffer
  for (let i = 1; i <= visitsToCreate; i++) {
    const nextDate = new Date(latestVisitDate);
    nextDate.setDate(latestVisitDate.getDate() + (i * 7)); // Add weeks
    
    // Set the time from the recurring window
    const [hours, minutes] = recurringWindowStart.split(':').map(Number);
    nextDate.setHours(hours, minutes, 0, 0);
    
    await addDoc(collection(db, 'visits'), {
      customer_uid: customerUid,
      slot_id: slotId,
      scheduled_for: Timestamp.fromDate(nextDate),
      status: 'scheduled',
      notes: '',
      is_recurring: true,
      recurring_group_id: recurringGroupId,
      recurring_day_of_week: recurringDayOfWeek,
      recurring_window_start: recurringWindowStart,
      recurring_window_end: recurringWindowEnd,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });
  }
  
  return visitsToCreate;
}

/**
 * Creates the initial set of visits for a new recurring booking.
 * 
 * @param params - The recurring visit configuration
 * @param startDate - The date of the first visit
 * @returns Array of visit data objects ready to be created in a transaction
 */
export function createInitialVisits(
  params: ReplenishVisitsParams,
  startDate: Date
): Array<{
  customer_uid: string;
  slot_id: string;
  scheduled_for: Timestamp;
  status: 'scheduled';
  notes: string;
  is_recurring: boolean;
  recurring_group_id: string;
  recurring_day_of_week: number;
  recurring_window_start: string;
  recurring_window_end: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}> {
  const visits = [];
  
  for (let i = 0; i < VISIT_BUFFER_SIZE; i++) {
    const scheduledDate = new Date(startDate);
    scheduledDate.setDate(startDate.getDate() + (i * 7)); // Add weeks
    
    visits.push({
      customer_uid: params.customerUid,
      slot_id: params.slotId,
      scheduled_for: Timestamp.fromDate(scheduledDate),
      status: 'scheduled' as const,
      notes: '',
      is_recurring: true,
      recurring_group_id: params.recurringGroupId,
      recurring_day_of_week: params.recurringDayOfWeek,
      recurring_window_start: params.recurringWindowStart,
      recurring_window_end: params.recurringWindowEnd,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });
  }
  
  return visits;
}

export { VISIT_BUFFER_SIZE };
