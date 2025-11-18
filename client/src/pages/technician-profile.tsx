import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { uploadTechnicianAvatar } from '@/lib/storage';
import { TechnicianProfile } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, User } from 'lucide-react';
import { useLocation } from 'wouter';

export default function TechnicianProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [profile, setProfile] = useState<TechnicianProfile | null>(null);
  const [formData, setFormData] = useState({
    display_name: '',
    title: '',
    owns_dogs: false,
    bio: '',
    avatar_url: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const profileDoc = await getDoc(doc(db, 'technician_profiles', user.uid));
      
      if (profileDoc.exists()) {
        const data = profileDoc.data() as TechnicianProfile;
        setProfile(data);
        setFormData({
          display_name: data.display_name,
          title: data.title,
          owns_dogs: data.owns_dogs,
          bio: data.bio,
          avatar_url: data.avatar_url || '',
        });
        setPreviewUrl(data.avatar_url || '');
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load profile',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      let avatarUrl = formData.avatar_url;

      if (selectedFile) {
        setUploading(true);
        const result = await uploadTechnicianAvatar(user.uid, selectedFile);
        avatarUrl = result.downloadURL;
        setUploading(false);
      }

      const profileData: TechnicianProfile = {
        uid: user.uid,
        display_name: formData.display_name,
        title: formData.title,
        owns_dogs: formData.owns_dogs,
        bio: formData.bio,
        avatar_url: avatarUrl,
        updated_at: Timestamp.now(),
      };

      await setDoc(doc(db, 'technician_profiles', user.uid), profileData);

      toast({
        title: 'Success',
        description: 'Profile saved successfully',
      });

      setProfile(profileData);
      setSelectedFile(null);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save profile',
      });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto p-4 lg:p-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/technician-portal')}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Portal
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>My Profile</CardTitle>
            <CardDescription>
              Manage your public profile information. This will be visible to customers and on the About Us page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={previewUrl} />
                  <AvatarFallback>
                    <User className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex flex-col items-center space-y-2">
                  <Label htmlFor="avatar-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 text-sm text-primary hover-elevate active-elevate-2 px-4 py-2 rounded-md border">
                      <Upload className="h-4 w-4" />
                      {selectedFile ? 'Change Photo' : 'Upload Photo'}
                    </div>
                  </Label>
                  <Input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    data-testid="input-avatar"
                  />
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, WebP, or GIF (max 5MB)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name *</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="Enter your display name"
                  required
                  data-testid="input-display-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Lead Scooper, Pet Waste Specialist"
                  required
                  data-testid="input-title"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="owns_dogs"
                  checked={formData.owns_dogs}
                  onCheckedChange={(checked) => setFormData({ ...formData, owns_dogs: checked as boolean })}
                  data-testid="checkbox-owns-dogs"
                />
                <Label htmlFor="owns_dogs" className="cursor-pointer">
                  I own one or more dogs
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio *</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Tell customers a bit about yourself..."
                  rows={6}
                  required
                  data-testid="textarea-bio"
                />
                <p className="text-xs text-muted-foreground">
                  Share your experience, passion for pets, or anything else you'd like customers to know.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={saving || uploading}
                  className="flex-1"
                  data-testid="button-save-profile"
                >
                  {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save Profile'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/technician-portal')}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
