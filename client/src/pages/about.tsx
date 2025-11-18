import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { TechnicianProfile } from '@shared/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { useLocation } from 'wouter';

export default function AboutPage() {
  const [, navigate] = useLocation();
  const [profiles, setProfiles] = useState<TechnicianProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const profilesRef = collection(db, 'technician_profiles');
      const snapshot = await getDocs(profilesRef);
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id,
      })) as TechnicianProfile[];
      setProfiles(data);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12 max-w-6xl">
        <div className="space-y-12">
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-8">
              <img 
                src="/logo-full.png" 
                alt="USA Scoops Logo" 
                className="h-40 sm:h-48 md:h-56 lg:h-64 w-auto cursor-pointer"
                onClick={() => navigate('/')}
                data-testid="img-logo"
              />
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-bold text-primary">
              About USA Scoops
            </h1>
            <div className="max-w-3xl mx-auto space-y-4 text-lg text-muted-foreground">
              <p>
                At USA Scoops, we understand that life gets busy, and keeping your yard clean 
                can be a chore. That's why we're here to help! We're a local pet waste removal 
                service dedicated to keeping your outdoor spaces clean, healthy, and safe for 
                your family and pets.
              </p>
              <p>
                Our team of professional scoopers is passionate about pets and committed to 
                providing reliable, friendly service. We take pride in what we do, and we 
                treat every yard like it's our own.
              </p>
              <p>
                Whether you need weekly service or a one-time cleanup, we've got you covered. 
                Sit back, relax, and let us handle the dirty work!
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center" data-testid="header-meet-scoopers">
              Meet Your Scoopers
            </h2>
            
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading team members...</p>
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No team members available yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {profiles.map((profile) => (
                  <div
                    key={profile.uid}
                    className="flex flex-col items-center space-y-4 cursor-pointer"
                    onClick={() => navigate(`/technicians/${profile.uid}`)}
                    data-testid={`card-technician-${profile.uid}`}
                  >
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={profile.avatar_url} />
                      <AvatarFallback className="bg-gray-100">
                        <User className="h-12 w-12 text-gray-400" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center space-y-1">
                      <h3 className="font-semibold text-lg" data-testid={`text-name-${profile.uid}`}>
                        {profile.display_name}
                      </h3>
                      <p className="text-sm text-muted-foreground" data-testid={`text-title-${profile.uid}`}>
                        {profile.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
