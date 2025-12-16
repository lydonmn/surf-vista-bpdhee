
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
  isInitialized: boolean;
  signUp: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkSubscription: () => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session?.user?.email);
      setSession(session);
      if (session?.user) {
        loadUserProfile(session.user).then(() => {
          setIsInitialized(true);
        });
      } else {
        setIsLoading(false);
        setIsInitialized(true);
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
      setIsInitialized(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('Loading profile for user:', authUser.id);
      
      // Add a small delay to ensure database is ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.log('Error loading profile:', error);
        
        // If profile doesn't exist, try to create it
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating...');
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email,
              is_admin: false,
              is_subscribed: false,
            })
            .select()
            .single();
          
          if (createError) {
            console.log('Error creating profile:', createError);
            setProfile(null);
            setUser({ ...authUser });
          } else {
            console.log('Profile created:', newProfile);
            setProfile(newProfile);
            setUser({ ...authUser, profile: newProfile });
          }
        } else {
          setProfile(null);
          setUser({ ...authUser });
        }
      } else {
        console.log('Profile loaded successfully:', {
          email: profileData.email,
          is_admin: profileData.is_admin,
          is_subscribed: profileData.is_subscribed,
          subscription_end_date: profileData.subscription_end_date
        });
        setProfile(profileData);
        setUser({ ...authUser, profile: profileData });
      }
    } catch (error) {
      console.log('Error loading user profile:', error);
      setProfile(null);
      setUser({ ...authUser });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (session?.user) {
      console.log('Refreshing profile...');
      setIsLoading(true);
      await loadUserProfile(session.user);
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
      console.log('Attempting sign in for:', email);
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.log('Sign in error:', error);
        setIsLoading(false);
        return { success: false, message: error.message };
      }

      if (data.user && data.session) {
        console.log('Sign in successful, loading profile...');
        setSession(data.session);
        
        // Load profile and wait for it to complete with longer delay
        await new Promise(resolve => setTimeout(resolve, 300));
        await loadUserProfile(data.user);
        
        // Additional delay to ensure state is fully updated
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log('Profile loaded after sign in, user state updated');
        return { success: true, message: 'Signed in successfully!' };
      }

      setIsLoading(false);
      return { success: false, message: 'Sign in failed' };
    } catch (error) {
      console.log('Sign in error:', error);
      setIsLoading(false);
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
    console.log('Checking subscription:', {
      profile_exists: !!profile,
      is_admin: profile?.is_admin,
      is_subscribed: profile?.is_subscribed,
      subscription_end_date: profile?.subscription_end_date,
      is_loading: isLoading
    });

    // If still loading, return false to show loading state
    if (isLoading) {
      console.log('Still loading profile data');
      return false;
    }

    // If no profile, not subscribed
    if (!profile) {
      console.log('No profile found');
      return false;
    }

    // Admin users always have access
    if (profile.is_admin) {
      console.log('User is admin, granting access');
      return true;
    }

    // Check if user is subscribed
    if (!profile.is_subscribed) {
      console.log('User is not subscribed');
      return false;
    }
    
    // If subscribed and no end date, subscription is active
    if (!profile.subscription_end_date) {
      console.log('Subscription active (no end date)');
      return true;
    }
    
    // If there's an end date, check if it's in the future
    const endDate = new Date(profile.subscription_end_date);
    const isValid = endDate > new Date();
    console.log('Subscription end date check:', { 
      endDate: endDate.toISOString(), 
      now: new Date().toISOString(),
      isValid 
    });
    return isValid;
  };

  const isAdmin = (): boolean => {
    const adminStatus = profile?.is_admin || false;
    console.log('Admin status:', adminStatus);
    return adminStatus;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile,
      session,
      isLoading, 
      isInitialized,
      signUp,
      signIn, 
      signOut,
      refreshProfile,
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
