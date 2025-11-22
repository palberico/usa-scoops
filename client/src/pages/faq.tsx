import { Link } from 'wouter';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

export default function FAQ() {
  return (
    <div className="min-h-screen bg-background">
      {/* Logo Header - Clickable to go back to home */}
      <div className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/">
            <a className="flex justify-center cursor-pointer" data-testid="link-home">
              <div className="inline-block rounded-full bg-white p-1">
                <img 
                  src="/logo-full.png" 
                  alt="USA Scoops" 
                  className="h-40 sm:h-48 md:h-56 lg:h-64 w-auto"
                  data-testid="logo-image"
                />
              </div>
            </a>
          </Link>
        </div>
      </div>

      {/* FAQ Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-foreground mb-8">Frequently Asked Questions</h1>
        
        <Accordion type="single" collapsible className="space-y-3">
          {/* Question 1 */}
          <AccordionItem value="item-1" className="border rounded-md px-4">
            <AccordionTrigger className="hover:no-underline text-left font-semibold text-foreground">
              How often does USA Scoops service yards?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              We offer two service options: Monthly recurring service, where we visit your yard every month, and one-time service for customers who just need a single visit. You can choose whichever option works best for your needs.
            </AccordionContent>
          </AccordionItem>

          {/* Question 2 */}
          <AccordionItem value="item-2" className="border rounded-md px-4">
            <AccordionTrigger className="hover:no-underline text-left font-semibold text-foreground">
              What times can I schedule service?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Service time windows are available throughout the week based on your zip code. When you book, you'll see all available time slots. For recurring monthly service, you'll select a preferred time window that works for your schedule.
            </AccordionContent>
          </AccordionItem>

          {/* Question 3 */}
          <AccordionItem value="item-3" className="border rounded-md px-4">
            <AccordionTrigger className="hover:no-underline text-left font-semibold text-foreground">
              How do I cancel or pause my service?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              You can pause your recurring service anytime through your customer portal. This temporarily stops scheduled visits without canceling your account. You can resume service whenever you're ready. If you'd like to cancel permanently, you can do so at the end of your billing cycle with no penalties.
            </AccordionContent>
          </AccordionItem>

          {/* Question 4 */}
          <AccordionItem value="item-4" className="border rounded-md px-4">
            <AccordionTrigger className="hover:no-underline text-left font-semibold text-foreground">
              What payment methods do you accept?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              We accept all major credit and debit cards through our secure payment system. Payment is processed at the time of booking for one-time service and at the beginning of each month for recurring service.
            </AccordionContent>
          </AccordionItem>

          {/* Question 5 */}
          <AccordionItem value="item-5" className="border rounded-md px-4">
            <AccordionTrigger className="hover:no-underline text-left font-semibold text-foreground">
              What if I'm not home during my service window?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              You don't need to be home for us to service your yard! We just need safe access to the yard area. Make sure gates are unlocked and any pets are secured indoors. Our technicians will complete the service and send you an update when finished.
            </AccordionContent>
          </AccordionItem>

          {/* Question 6 */}
          <AccordionItem value="item-6" className="border rounded-md px-4">
            <AccordionTrigger className="hover:no-underline text-left font-semibold text-foreground">
              How much does the service cost?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Pricing depends on your service type (recurring or one-time), number of dogs, and your location. During booking, you'll see the exact price before paying. Recurring service is billed monthly, and one-time service is charged upfront.
            </AccordionContent>
          </AccordionItem>

          {/* Question 7 */}
          <AccordionItem value="item-7" className="border rounded-md px-4">
            <AccordionTrigger className="hover:no-underline text-left font-semibold text-foreground">
              What happens if it rains on my service day?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Safety is our priority. If severe weather (heavy rain, lightning, extreme wind, or unsafe temperatures) prevents service, our team will reschedule your visit for the next available day. Weather delays are not grounds for refunds.
            </AccordionContent>
          </AccordionItem>

          {/* Question 8 */}
          <AccordionItem value="item-8" className="border rounded-md px-4">
            <AccordionTrigger className="hover:no-underline text-left font-semibold text-foreground">
              How do I reschedule a visit?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              You can reschedule any upcoming visit through your customer portal. Just select the visit you want to move and choose a new time slot. Rescheduling must be done at least 24 hours before your scheduled service time.
            </AccordionContent>
          </AccordionItem>

          {/* Question 9 */}
          <AccordionItem value="item-9" className="border rounded-md px-4">
            <AccordionTrigger className="hover:no-underline text-left font-semibold text-foreground">
              What information do you need from me?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              During signup, we'll need your address, zip code, phone number, number of dogs, and any special instructions (like gate codes). This helps us schedule service and ensure our technicians can access your yard safely.
            </AccordionContent>
          </AccordionItem>

          {/* Question 10 */}
          <AccordionItem value="item-10" className="border rounded-md px-4">
            <AccordionTrigger className="hover:no-underline text-left font-semibold text-foreground">
              How do you prevent cross contamination?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              We disinfect all tools and shoes after each cleaning with a kennel safe disinfectant. This ensures our gear is ready to go for the next house.
            </AccordionContent>
          </AccordionItem>

          {/* Question 11 */}
          <AccordionItem value="item-11" className="border rounded-md px-4">
            <AccordionTrigger className="hover:no-underline text-left font-semibold text-foreground">
              What if there's an issue with my service?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              We want you to be happy! If you have any concerns about your service, you can send a message to our team through your customer portal. We'll respond promptly and work to resolve the issue.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Back to Home Button */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Separator className="mb-6" />
        <div className="text-center">
          <Link href="/">
            <a>
              <Button
                variant="ghost"
                data-testid="link-back-home"
              >
                ← Back to Home
              </Button>
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
