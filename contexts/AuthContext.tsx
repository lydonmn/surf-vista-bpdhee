
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/app/integrations/supabase/client';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { Database } from '@/app/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface User extends SupabaseUser {
  profile?: Profile;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  signOut: () => Promise<void>;
  checkSubscription: () => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session?.user?.email);
      setSession(session);
      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth state changed:', _event, session?.user?.email);
      setSession(session);
      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (authUser: SupabaseUser) => {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.log('Error loading profile:', error);
        setProfile(null);
      } else {
        console.log('Profile loaded:', profileData);
        setProfile(profileData);
        setUser({ ...authUser, profile: profileData });
      }
    } catch (error) {
      console.log('Error loading user profile:', error);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'https://natively.dev/email-confirmed'
        }
      });

      if (error) {
        console.log('Sign up error:', error);
        return { success: false, message: error.message };
      }

      if (data.user && !data.session) {
        return { 
          success: true, 
          message: 'Please check your email to verify your account before signing in.' 
        };
      }

      return { success: true, message: 'Account created successfully!' };
    } catch (error) {
      console.log('Sign up error:', error);
      return { success: false, message: 'An unexpected error occurred' };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.log('Sign in error:', error);
        return { success: false, message: error.message };
      }

      if (data.user) {
        return { success: true, message: 'Signed in successfully!' };
      }

      return { success: false, message: 'Sign in failed' };
    } catch (error) {
      console.log('Sign in error:', error);
      return { success: false, message: 'An unexpected error occurred' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
    } catch (error) {
      console.log('Sign out error:', error);
    }
  };

  const checkSubscription = (): boolean => {
    if (!profile || !profile.is_subscribed) return false;
    
    if (profile.subscription_end_date) {
      const endDate = new Date(profile.subscription_end_date);
      return endDate > new Date();
    }
    
    return true;
  };

  const isAdmin = (): boolean => {
    return profile?.is_admin || false;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile,
      session,
      isLoading, 
      signUp,
      signIn, 
      signOut, 
      checkSubscription,
      isAdmin 
    }}>
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
