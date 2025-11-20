import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { CheckCircle2, MapPin, Calendar } from 'lucide-react';
import heroImage from '@assets/generated_images/Clean_backyard_with_happy_dog_d695ab48.png';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
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
          {/* Large Logo with White Circle Background */}
          <div className="inline-block rounded-full bg-white p-1 mb-8">
            <img 
              src="/logo-full.png" 
              alt="USA Scoops" 
              className="h-40 sm:h-48 md:h-56 lg:h-64 w-auto"
              data-testid="logo-image"
            />
          </div>
          
          <h1 
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6"
            data-testid="heading-hero"
          >
            America's Cleanest Yards
          </h1>
          <p className="text-xl sm:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
            Professional pet waste removal service for your home. Enjoy your yard again without the hassle.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button 
                size="lg" 
                className="w-48 h-14 text-lg border-2 border-primary-foreground/20"
                style={{ backgroundColor: '#003366' }}
                data-testid="button-get-started-hero"
              >
                Get Started Today
              </Button>
            </Link>
            <Link href="/login">
              <Button 
                size="lg"
                variant="outline" 
                className="w-48 h-14 text-lg bg-background/95 backdrop-blur-sm border-2 border-primary-foreground/20"
                data-testid="button-login"
              >
                Sign In
              </Button>
            </Link>
          </div>
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
          <div className="text-center text-muted-foreground space-y-3">
            <div className="flex justify-center gap-4">
              <Link href="/about">
                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-primary"
                  data-testid="link-about-us"
                >
                  About Us
                </Button>
              </Link>
              <Link href="/terms">
                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-primary"
                  data-testid="link-terms"
                >
                  Terms of Service
                </Button>
              </Link>
            </div>
            <p>&copy; 2024 USA Scoops. All rights reserved.</p>
            <p>Professional Pet Waste Removal Service</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
