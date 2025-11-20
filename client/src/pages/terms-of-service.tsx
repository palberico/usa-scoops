import { Link } from 'wouter';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      {/* Logo Header - Clickable to go back to home */}
      <div className="py-8 border-b">
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

      {/* Terms Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold text-foreground mb-8">USA Scoops Terms of Service</h1>
          
          <p className="text-lg text-muted-foreground mb-8">
            Welcome to USA Scoops. We provide residential pet waste removal services designed to keep your yard clean, safe, and ready to enjoy. These Terms of Service explain what customers can expect from us and what we need from customers to deliver reliable service. By scheduling or receiving service from USA Scoops, you agree to the terms below.
          </p>

          {/* Section 1 */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">1. Services Offered</h2>
            <p className="text-muted-foreground mb-3">USA Scoops offers the following:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Monthly recurring pet waste removal service</li>
              <li>One-time pet waste removal service</li>
              <li>Optional yard sanitizing (available as an add-on)</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">2. Billing and Payments</h2>
            
            <h3 className="text-xl font-semibold text-foreground mb-3">Monthly Service</h3>
            <p className="text-muted-foreground mb-4">
              Monthly pet waste removal is billed automatically each month. When you sign up, you authorize USA Scoops to charge the payment method you place on file for ongoing service. Payment is collected at sign up.
            </p>
            <p className="text-muted-foreground mb-6">
              This service does not include deep cleaning or yard restoration. We simply remove visible pet waste in the service area based on normal yard conditions.
            </p>

            <h3 className="text-xl font-semibold text-foreground mb-3">One-Time Pet Waste Removal</h3>
            <p className="text-muted-foreground mb-4">
              USA Scoops offers a one-time pet waste removal service for customers who need a single visit instead of monthly recurring service. This service is billed at the time of scheduling and must be paid in full before the appointment is confirmed.
            </p>
            <p className="text-muted-foreground mb-4">
              One-time removal visits are final and nonrefundable once completed.
            </p>
            <p className="text-muted-foreground mb-6">
              This service does not include deep cleaning or yard restoration. We simply remove visible pet waste in the service area based on normal yard conditions.
            </p>

            <h3 className="text-xl font-semibold text-foreground mb-3">Payment Terms</h3>
            <p className="text-muted-foreground mb-4">
              All payments are processed through our secure online system. If a payment fails, you will receive a notice by email or text. We may pause service until a valid payment method is updated.
            </p>
          </section>

          {/* Section 3 */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">3. Cancellations</h2>
            <p className="text-muted-foreground mb-4">
              You may cancel recurring monthly service at any time through our website. Cancellations take effect at the end of the current billing period. We do not issue partial refunds for unused days within a billing cycle.
            </p>
          </section>

          {/* Section 4 */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">4. Yard Access</h2>
            <p className="text-muted-foreground mb-3">
              To complete your service, we need safe and uninterrupted access to your yard. This includes:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
              <li>Unlocked gates</li>
              <li>Safe paths to the service area</li>
              <li>Pets secured indoors or in another safe space</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              If we arrive and cannot access the yard, the visit will be marked as unable to service. This visit is not refundable. We can attempt to reschedule for another day depending on availability.
            </p>
          </section>

          {/* Section 5 */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">5. Yard Condition and Maintenance</h2>
            <p className="text-muted-foreground mb-4">
              Our team can only perform service in yards that are reasonably maintained and safe to enter. Grass should be kept to a manageable height so waste is visible. Excessively tall grass, debris, or hazards may prevent us from completing the service.
            </p>
            <p className="text-muted-foreground mb-4">
              If we cannot service the yard due to maintenance issues, no refund will be issued for that visit. We can attempt to reschedule depending on availability.
            </p>
          </section>

          {/* Section 6 */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">6. Yard Sanitizing</h2>
            <p className="text-muted-foreground mb-4">
              Yard sanitizing is available as an optional add-on. Sanitizing solutions are pet safe and applied only to solid surfaces or areas suitable for treatment.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">7. Weather and Delays</h2>
            <p className="text-muted-foreground mb-4">
              We make every effort to service your yard on your scheduled day. Safety comes first, so extreme weather can cause delays. This includes heavy rain, lightning, high wind, ice, or unsafe temperatures.
            </p>
            <p className="text-muted-foreground mb-4">
              If we must delay service due to weather, we will attempt to reschedule as soon as conditions allow. Weather delays are not grounds for refunds.
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Liability and Property Conditions</h2>
            <p className="text-muted-foreground mb-3">USA Scoops is not responsible for:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
              <li>Damage caused by hidden hazards, unsafe yard conditions, or aggressive animals</li>
              <li>Illnesses caused by existing waste or bacteria in your yard</li>
              <li>Damage to landscaping caused by normal walking or cleaning activities</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">9. Privacy Policy</h2>
            <p className="text-muted-foreground mb-4">
              USA Scoops collects basic customer information such as your name, address, phone number, email, service details, payment information, and communication history. This information is used to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
              <li>Provide and manage your scheduled services</li>
              <li>Process payments</li>
              <li>Contact you about service updates or issues</li>
              <li>Improve scheduling and customer support</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              We store customer data securely and do not sell your personal information to any third party. Your information may be shared with trusted service providers who support our business operations.
            </p>
          </section>

          {/* Section 10 */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">10. Changes to These Terms</h2>
            <p className="text-muted-foreground mb-4">
              USA Scoops may update these Terms of Service at any time. Changes take effect when posted on our website.
            </p>
          </section>

          {/* Section 12 (Note: Section 11 is missing in original document) */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-foreground mb-4">12. Contact Information</h2>
            <p className="text-muted-foreground mb-4">
              For questions or support, contact us via your customer portal at:{' '}
              <a href="https://www.usascoops.com" className="text-primary hover:underline">
                www.usascoops.com
              </a>
            </p>
          </section>
        </div>

        {/* Back to Home Button */}
        <div className="mt-12 pt-8 border-t text-center">
          <Link href="/">
            <a>
              <button
                className="text-primary hover:underline text-lg"
                data-testid="link-back-home"
              >
                ← Back to Home
              </button>
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
