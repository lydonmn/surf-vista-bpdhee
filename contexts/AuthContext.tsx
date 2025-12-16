
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
    console.log('[AuthContext] Initializing...');
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[AuthContext] Initial session check:', session?.user?.email || 'No session');
      setSession(session);
      
      if (session?.user) {
        console.log('[AuthContext] Loading initial profile...');
        await loadUserProfile(session.user);
        console.log('[AuthContext] Initial profile loaded');
      } else {
        console.log('[AuthContext] No session, setting loading to false');
        setIsLoading(false);
      }
      
      setIsInitialized(true);
      console.log('[AuthContext] Initialization complete');
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[AuthContext] Auth state changed:', _event, session?.user?.email || 'No session');
      setSession(session);
      
      if (session?.user) {
        console.log('[AuthContext] Loading profile after auth change...');
        await loadUserProfile(session.user);
        console.log('[AuthContext] Profile loaded after auth change');
      } else {
        console.log('[AuthContext] No session, clearing user data');
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
      
      if (!isInitialized) {
        setIsInitialized(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('[AuthContext] Loading profile for user:', authUser.id);
      setIsLoading(true);
      
      // Add a small delay to ensure database is ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.log('[AuthContext] Error loading profile:', error.message, error.code);
        
        // If profile doesn't exist, try to create it
        if (error.code === 'PGRST116') {
          console.log('[AuthContext] Profile not found, creating...');
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
            console.log('[AuthContext] Error creating profile:', createError.message);
            setProfile(null);
            setUser({ ...authUser });
          } else {
            console.log('[AuthContext] Profile created successfully:', newProfile);
            setProfile(newProfile);
            setUser({ ...authUser, profile: newProfile });
          }
        } else {
          setProfile(null);
          setUser({ ...authUser });
        }
      } else {
        console.log('[AuthContext] Profile loaded successfully:', {
          email: profileData.email,
          is_admin: profileData.is_admin,
          is_subscribed: profileData.is_subscribed,
          subscription_end_date: profileData.subscription_end_date
        });
        setProfile(profileData);
        setUser({ ...authUser, profile: profileData });
      }
    } catch (error) {
      console.log('[AuthContext] Exception loading user profile:', error);
      setProfile(null);
      setUser({ ...authUser });
    } finally {
      console.log('[AuthContext] Setting isLoading to false');
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (session?.user) {
      console.log('[AuthContext] Refreshing profile...');
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
        console.log('[AuthContext] Sign up error:', error);
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
      console.log('[AuthContext] Sign up error:', error);
      return { success: false, message: 'An unexpected error occurred' };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('[AuthContext] Attempting sign in for:', email);
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.log('[AuthContext] Sign in error:', error);
        setIsLoading(false);
        return { success: false, message: error.message };
      }

      if (data.user && data.session) {
        console.log('[AuthContext] Sign in successful, setting session...');
        setSession(data.session);
        
        // Load profile and wait for it to complete
        console.log('[AuthContext] Loading profile after sign in...');
        await loadUserProfile(data.user);
        
        console.log('[AuthContext] Sign in complete, profile loaded');
        return { success: true, message: 'Signed in successfully!' };
      }

      setIsLoading(false);
      return { success: false, message: 'Sign in failed' };
    } catch (error) {
      console.log('[AuthContext] Sign in error:', error);
      setIsLoading(false);
      return { success: false, message: 'An unexpected error occurred' };
    }
  };

  const signOut = async () => {
    try {
      console.log('[AuthContext] Signing out...');
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
      console.log('[AuthContext] Sign out complete');
    } catch (error) {
      console.log('[AuthContext] Sign out error:', error);
    }
  };

  const checkSubscription = (): boolean => {
    const hasSubscription = (() => {
      // If no profile, not subscribed
      if (!profile) {
        return false;
      }

      // Admin users always have access
      if (profile.is_admin) {
        return true;
      }

      // Check if user is subscribed
      if (!profile.is_subscribed) {
        return false;
      }
      
      // If subscribed and no end date, subscription is active
      if (!profile.subscription_end_date) {
        return true;
      }
      
      // If there's an end date, check if it's in the future
      const endDate = new Date(profile.subscription_end_date);
      return endDate > new Date();
    })();

    console.log('[AuthContext] Subscription check:', {
      profile_exists: !!profile,
      is_admin: profile?.is_admin,
      is_subscribed: profile?.is_subscribed,
      subscription_end_date: profile?.subscription_end_date,
      is_loading: isLoading,
      result: hasSubscription
    });

    return hasSubscription;
  };

  const isAdmin = (): boolean => {
    const adminStatus = profile?.is_admin || false;
    console.log('[AuthContext] Admin status:', adminStatus);
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
