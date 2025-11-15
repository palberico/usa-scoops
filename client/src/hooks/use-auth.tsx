import { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserRole } from '@shared/types';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, userData: any) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Fetch user role from Firestore
        try {
          // Check customers collection first
          const customerDoc = await getDoc(doc(db, 'customers', firebaseUser.uid));
          if (customerDoc.exists()) {
            const data = customerDoc.data();
            // Support multi-role: admin takes precedence
            if (data.role === 'admin') {
              setRole('admin');
            } else if (data.role === 'technician') {
              setRole('technician');
            } else {
              setRole('customer');
            }
            setLoading(false);
            return;
          }

          // Check technicians collection
          const techDoc = await getDoc(doc(db, 'technicians', firebaseUser.uid));
          if (techDoc.exists()) {
            const data = techDoc.data();
            // Support multi-role: admin takes precedence
            if (data.role === 'admin') {
              setRole('admin');
            } else {
              setRole('technician');
            }
            setLoading(false);
            return;
          }

          // Default to customer if no role found
          setRole('customer');
        } catch (err) {
          console.error('Error fetching user role:', err);
          setError('Failed to fetch user role');
        }
      } else {
        setRole(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signUp = async (email: string, password: string, userData: any) => {
    try {
      setError(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Helper function to remove undefined values
      const removeUndefined = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(removeUndefined);
        }
        if (obj !== null && typeof obj === 'object') {
          return Object.entries(obj).reduce((acc, [key, value]) => {
            if (value !== undefined) {
              acc[key] = removeUndefined(value);
            }
            return acc;
          }, {} as any);
        }
        return obj;
      };
      
      // Create customer document in Firestore
      const { Timestamp } = await import('firebase/firestore');
      const cleanUserData = removeUndefined(userData);
      
      await setDoc(doc(db, 'customers', userCredential.user.uid), {
        ...cleanUserData,
        uid: userCredential.user.uid,
        email,
        role: 'customer',
        status: 'prospect',
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      
      setRole('customer');
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await firebaseSignOut(auth);
      setRole(null);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, error, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
