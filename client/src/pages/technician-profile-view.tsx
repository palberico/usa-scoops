import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { TechnicianProfile } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, PawPrint } from 'lucide-react';

export default function TechnicianProfileView() {
  const [match, params] = useRoute('/technicians/:uid');
  const [, navigate] = useLocation();
  const [profile, setProfile] = useState<TechnicianProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (params?.uid) {
      loadProfile(params.uid);
    }
  }, [params?.uid]);

  const loadProfile = async (uid: string) => {
    try {
      const profileDoc = await getDoc(doc(db, 'technician_profiles', uid));
      if (profileDoc.exists()) {
        setProfile({ ...profileDoc.data(), uid: profileDoc.id } as TechnicianProfile);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/about');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-6"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">Profile not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12 max-w-2xl">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader className="text-center space-y-4 pb-4">
            <div className="flex justify-center">
              <Avatar className="h-32 w-32">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback>
                  <User className="h-16 w-16" />
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl" data-testid="text-display-name">
                {profile.display_name}
              </CardTitle>
              <p className="text-lg text-muted-foreground" data-testid="text-title">
                {profile.title}
              </p>
              {profile.owns_dogs && (
                <Badge variant="secondary" className="mt-2" data-testid="badge-owns-dogs">
                  <PawPrint className="h-3 w-3 mr-1" />
                  Dog Owner
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">About Me</h3>
              <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-bio">
                {profile.bio}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
