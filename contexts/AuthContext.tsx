
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/integrations/supabase/client';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { Database } from '@/app/integrations/supabase/types';
import { initializeRevenueCat, identifyUser, logoutUser } from '@/utils/superwallConfig';

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

  const loadUserProfile = useCallback(async (authUser: SupabaseUser, mounted: boolean = true) => {
    try {
      console.log('[AuthContext] Loading profile for user:', authUser.id);
      
      if (mounted) {
        setIsLoading(true);
      }
      
      // Try to fetch the profile
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

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
        setIsLoading(false);
        return;
      }

      // If profile doesn't exist, create it
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
        
        if (newProfile && mounted) {
          console.log('[AuthContext] Profile created successfully');
          setProfile(newProfile);
          setUser({ ...authUser, profile: newProfile });
          setIsLoading(false);
          return;
        } else {
          console.error('[AuthContext] Error creating profile:', createError?.message);
        }
      } else {
        console.error('[AuthContext] Error loading profile:', error?.message);
      }

      // If we get here, something went wrong
      if (mounted) {
        setProfile(null);
        setUser({ ...authUser });
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[AuthContext] Exception loading user profile:', error);
      if (mounted) {
        setProfile(null);
        setUser({ ...authUser });
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    console.log('[AuthContext] Initializing...');
    
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Initialize RevenueCat (non-blocking)
        try {
          console.log('[AuthContext] Initializing RevenueCat...');
          const revenueCatInitialized = await initializeRevenueCat();
          if (revenueCatInitialized) {
            console.log('[AuthContext] ✅ RevenueCat initialized successfully');
          } else {
            console.log('[AuthContext] ⚠️ RevenueCat initialization failed (non-critical)');
          }
        } catch (revenueCatError) {
          console.error('[AuthContext] ⚠️ RevenueCat initialization error (non-critical):', revenueCatError);
        }
        
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        console.log('[AuthContext] Initial session check:', initialSession?.user?.email || 'No session');
        
        if (initialSession?.user) {
          setSession(initialSession);
          console.log('[AuthContext] Loading initial profile...');
          await loadUserProfile(initialSession.user, mounted);
          
          // Identify user in RevenueCat
          try {
            await identifyUser(initialSession.user.id, initialSession.user.email || undefined);
          } catch (error) {
            console.error('[AuthContext] Error identifying user in RevenueCat:', error);
          }
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
      
      if (event === 'SIGNED_OUT') {
        console.log('[AuthContext] SIGNED_OUT event detected, clearing all user data');
        
        // Logout from RevenueCat
        try {
          await logoutUser();
        } catch (error) {
          console.error('[AuthContext] Error logging out from RevenueCat:', error);
        }
        
        setUser(null);
        setProfile(null);
        setSession(null);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN' && newSession?.user) {
        console.log('[AuthContext] SIGNED_IN event detected, loading profile...');
        setSession(newSession);
        await loadUserProfile(newSession.user, mounted);
        
        // Identify user in RevenueCat
        try {
          await identifyUser(newSession.user.id, newSession.user.email || undefined);
        } catch (error) {
          console.error('[AuthContext] Error identifying user in RevenueCat:', error);
        }
      } else if (event === 'TOKEN_REFRESHED' && newSession?.user) {
        console.log('[AuthContext] TOKEN_REFRESHED event detected');
        setSession(newSession);
      } else if (event === 'USER_UPDATED' && newSession?.user) {
        console.log('[AuthContext] USER_UPDATED event detected');
        setSession(newSession);
        await loadUserProfile(newSession.user, mounted);
      } else if (!newSession) {
        console.log('[AuthContext] No session in auth change, clearing user data');
        setUser(null);
        setProfile(null);
        setSession(null);
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
  }, [isInitialized, loadUserProfile]);

  const refreshProfile = async () => {
    if (session?.user) {
      console.log('[AuthContext] Refreshing profile...');
      await loadUserProfile(session.user, true);
    }
  };

  const signUp = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('[AuthContext] Attempting sign up for:', email);
      
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

      // Check if email confirmation is required
      if (data.user && !data.session) {
        console.log('[AuthContext] Email confirmation required');
        return { 
          success: true, 
          message: 'Please check your email to verify your account before signing in.' 
        };
      }

      // If we have a session, the user is automatically signed in
      if (data.user && data.session) {
        console.log('[AuthContext] Sign up successful with auto sign-in');
        return { success: true, message: 'Account created successfully!' };
      }

      return { success: true, message: 'Account created successfully!' };
    } catch (error: any) {
      console.error('[AuthContext] Sign up exception:', error);
      return { success: false, message: error.message || 'An unexpected error occurred' };
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
        
        // Provide more helpful error messages
        if (error.message.includes('Email not confirmed')) {
          return { 
            success: false, 
            message: 'Please verify your email address before signing in. Check your inbox for the confirmation link.' 
          };
        } else if (error.message.includes('Invalid login credentials')) {
          return { 
            success: false, 
            message: 'Invalid email or password. Please try again.' 
          };
        }
        
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
    } catch (error: any) {
      console.error('[AuthContext] Sign in exception:', error);
      setIsLoading(false);
      return { success: false, message: error.message || 'An unexpected error occurred' };
    }
  };

  const signOut = async () => {
    console.log('[AuthContext] ===== SIGN OUT STARTED =====');
    console.log('[AuthContext] Current session before sign out:', session?.user?.email);
    console.log('[AuthContext] Current user state:', user?.email);
    
    try {
      // Logout from RevenueCat first
      try {
        await logoutUser();
      } catch (error) {
        console.error('[AuthContext] Error logging out from RevenueCat:', error);
      }
      
      // Clear local state FIRST for immediate UI update
      console.log('[AuthContext] Clearing local state immediately...');
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoading(false);
      
      // Then call Supabase signOut to clear the session from storage
      console.log('[AuthContext] Calling supabase.auth.signOut()...');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('[AuthContext] ❌ Supabase signOut error:', error);
      } else {
        console.log('[AuthContext] ✅ Supabase signOut successful');
      }
      
      console.log('[AuthContext] ===== SIGN OUT COMPLETE =====');
    } catch (error) {
      console.error('[AuthContext] ❌ Sign out exception:', error);
      // Ensure state is cleared even on error
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoading(false);
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
