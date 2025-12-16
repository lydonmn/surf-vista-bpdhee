
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
    
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        console.log('[AuthContext] Initial session check:', initialSession?.user?.email || 'No session');
        
        if (initialSession?.user) {
          setSession(initialSession);
          console.log('[AuthContext] Loading initial profile...');
          await loadUserProfile(initialSession.user, mounted);
        } else {
          console.log('[AuthContext] No session, setting loading to false');
          setIsLoading(false);
        }
        
        if (mounted) {
          setIsInitialized(true);
          console.log('[AuthContext] Initialization complete');
        }
      } catch (error) {
        console.error('[AuthContext] Initialization error:', error);
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      console.log('[AuthContext] Auth state changed:', event, newSession?.user?.email || 'No session');
      
      setSession(newSession);
      
      if (newSession?.user) {
        console.log('[AuthContext] Loading profile after auth change...');
        await loadUserProfile(newSession.user, mounted);
      } else {
        console.log('[AuthContext] No session, clearing user data');
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
      
      if (!isInitialized && mounted) {
        setIsInitialized(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (authUser: SupabaseUser, mounted: boolean = true) => {
    try {
      console.log('[AuthContext] Loading profile for user:', authUser.id);
      
      if (mounted) {
        setIsLoading(true);
      }
      
      // Retry logic for profile loading
      let retries = 3;
      let profileData = null;
      let error = null;

      while (retries > 0 && !profileData) {
        const result = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (result.data) {
          profileData = result.data;
          break;
        }

        error = result.error;
        
        // If profile doesn't exist, try to create it
        if (error?.code === 'PGRST116') {
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
          
          if (newProfile) {
            profileData = newProfile;
            console.log('[AuthContext] Profile created successfully');
            break;
          } else {
            console.log('[AuthContext] Error creating profile:', createError?.message);
          }
        }

        retries--;
        if (retries > 0) {
          console.log(`[AuthContext] Retrying profile load... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!mounted) return;

      if (profileData) {
        console.log('[AuthContext] Profile loaded successfully:', {
          email: profileData.email,
          is_admin: profileData.is_admin,
          is_subscribed: profileData.is_subscribed,
          subscription_end_date: profileData.subscription_end_date
        });
        setProfile(profileData);
        setUser({ ...authUser, profile: profileData });
      } else {
        console.log('[AuthContext] Failed to load profile after retries');
        setProfile(null);
        setUser({ ...authUser });
      }
    } catch (error) {
      console.error('[AuthContext] Exception loading user profile:', error);
      if (mounted) {
        setProfile(null);
        setUser({ ...authUser });
      }
    } finally {
      if (mounted) {
        console.log('[AuthContext] Setting isLoading to false');
        setIsLoading(false);
      }
    }
  };

  const refreshProfile = async () => {
    if (session?.user) {
      console.log('[AuthContext] Refreshing profile...');
      await loadUserProfile(session.user, true);
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
      console.error('[AuthContext] Sign up error:', error);
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
        console.log('[AuthContext] Sign in successful, user:', data.user.email);
        
        // The onAuthStateChange listener will handle loading the profile
        // Just wait a moment to ensure it's triggered
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('[AuthContext] Sign in complete');
        return { success: true, message: 'Signed in successfully!' };
      }

      setIsLoading(false);
      return { success: false, message: 'Sign in failed' };
    } catch (error) {
      console.error('[AuthContext] Sign in error:', error);
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
      console.error('[AuthContext] Sign out error:', error);
    }
  };

  const checkSubscription = (): boolean => {
    // Don't check subscription while loading
    if (isLoading || !profile) {
      console.log('[AuthContext] Subscription check: loading or no profile');
      return false;
    }

    // Admin users always have access
    if (profile.is_admin) {
      console.log('[AuthContext] Subscription check: user is admin - GRANTED');
      return true;
    }

    // Check if user is subscribed
    if (!profile.is_subscribed) {
      console.log('[AuthContext] Subscription check: not subscribed');
      return false;
    }
    
    // If subscribed and no end date, subscription is active
    if (!profile.subscription_end_date) {
      console.log('[AuthContext] Subscription check: subscribed with no end date - GRANTED');
      return true;
    }
    
    // If there's an end date, check if it's in the future
    const endDate = new Date(profile.subscription_end_date);
    const isActive = endDate > new Date();
    console.log('[AuthContext] Subscription check: subscribed with end date -', isActive ? 'GRANTED' : 'EXPIRED');
    return isActive;
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
