import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { CheckCircle2, MapPin, Calendar } from 'lucide-react';
import heroImage from '@assets/generated_images/Clean_backyard_with_happy_dog_d695ab48.png';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-b z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Row - Logo and Brand */}
          <div className="flex items-center justify-center py-4 border-b border-border/50">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <img 
                src="/logo-icon.png" 
                alt="USA Scoops" 
                className="h-32 sm:h-36 md:h-40 w-auto"
                data-testid="logo-image"
              />
              <span className="text-3xl sm:text-4xl md:text-5xl font-bold" style={{ color: '#003366' }}>
                USA Scoops
              </span>
            </div>
          </div>
          
          {/* Bottom Row - Navigation */}
          <div className="flex items-center justify-end py-3">
            <nav className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" data-testid="button-login">
                  Sign In
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden mt-60 sm:mt-64 md:mt-72">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={heroImage}
            alt="Clean backyard with happy dog"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/60" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6"
            data-testid="heading-hero"
          >
            America's Cleanest Yards, One Scoop at a Time
          </h1>
          <p className="text-xl sm:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
            Professional pet waste removal service for your home. Enjoy your yard again without the hassle.
          </p>
          <Link href="/signup">
            <Button 
              size="lg" 
              className="h-14 px-8 text-lg border-2 border-primary-foreground/20"
              style={{ backgroundColor: '#003366' }}
              data-testid="button-get-started-hero"
            >
              Get Started Today
            </Button>
          </Link>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 md:py-24 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-4">
            How It Works
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Get started in three simple steps
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center" data-testid="step-check-zip">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <MapPin className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">1. Check Your Zip</h3>
              <p className="text-muted-foreground">
                Enter your zip code to see if we service your area
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center" data-testid="step-pick-time">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Calendar className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">2. Pick a Time Window</h3>
              <p className="text-muted-foreground">
                Choose a convenient service window that works for you
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center" data-testid="step-we-scoop">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">3. We Scoop Your Yard</h3>
              <p className="text-muted-foreground">
                Our team handles the dirty work so you don't have to
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl mb-8 text-primary-foreground/90">
            Join hundreds of happy customers enjoying clean, waste-free yards
          </p>
          <Link href="/signup">
            <Button 
              size="lg" 
              variant="secondary"
              className="h-12 px-8"
              data-testid="button-signup-cta"
            >
              Sign Up Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-card border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-muted-foreground">
            <p>&copy; 2024 USA Scoops. All rights reserved.</p>
            <p className="mt-2">Professional Pet Waste Removal Service</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
