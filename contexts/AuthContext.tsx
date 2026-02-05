
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
  deleteAccount: () => Promise<{ success: boolean; message: string }>;
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
        // Get session first - this is critical and should not be delayed
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

        // Initialize RevenueCat AFTER the app is fully loaded (completely non-blocking)
        // This runs in the background and will not block the UI or cause crashes
        // We use a longer delay to ensure the app is fully rendered first
        // ⚠️ GRACEFUL DEGRADATION: If RevenueCat fails, the app continues normally
        setTimeout(() => {
          if (!mounted) return;
          
          // Run RevenueCat initialization in a separate async context
          (async () => {
            try {
              console.log('[AuthContext] ⏰ Starting background RevenueCat initialization (delayed)...');
              console.log('[AuthContext] ⚠️ App will continue normally even if RevenueCat fails');
              
              const revenueCatInitialized = await initializeRevenueCat();
              
              if (revenueCatInitialized) {
                console.log('[AuthContext] ✅ RevenueCat initialized successfully');
                
                // If user is logged in, identify them in RevenueCat
                if (initialSession?.user) {
                  setTimeout(async () => {
                    try {
                      console.log('[AuthContext] Identifying user in RevenueCat...');
                      await identifyUser(initialSession.user.id, initialSession.user.email || undefined);
                      console.log('[AuthContext] ✅ User identified in RevenueCat');
                    } catch (error) {
                      console.warn('[AuthContext] ⚠️ Error identifying user (non-critical):', error);
                      // App continues normally
                    }
                  }, 500);
                }
              } else {
                console.warn('[AuthContext] ⚠️ RevenueCat initialization failed (non-critical)');
                console.log('[AuthContext] ✅ App continues normally without subscription features');
              }
            } catch (revenueCatError) {
              console.warn('[AuthContext] ⚠️ RevenueCat initialization error (non-critical):', revenueCatError);
              console.log('[AuthContext] ✅ App continues normally without subscription features');
              // App continues to work without RevenueCat
            }
          })();
        }, 3000); // 3 second delay to ensure app is fully loaded and stable
        
      } catch (error) {
        console.error('[AuthContext] Initialization error:', error);
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      console.log('[AuthContext] Auth state changed:', event, newSession?.user?.email || 'No session');
      
      if (event === 'SIGNED_OUT') {
        console.log('[AuthContext] SIGNED_OUT event detected, clearing all user data');
        
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
        
        // Identify user in RevenueCat (completely non-blocking and fault-tolerant)
        setTimeout(() => {
          (async () => {
            try {
              console.log('[AuthContext] Attempting to identify user in RevenueCat...');
              await identifyUser(newSession.user.id, newSession.user.email || undefined);
              console.log('[AuthContext] ✅ User identified in RevenueCat');
            } catch (error) {
              console.warn('[AuthContext] ⚠️ Error identifying user in RevenueCat (non-critical):', error);
              console.log('[AuthContext] ✅ App continues normally');
              // App continues normally - this is not critical
            }
          })();
        }, 2000); // Longer delay to ensure stability
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
  }, [loadUserProfile, isInitialized]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      console.log('[AuthContext] Refreshing profile...');
      await loadUserProfile(session.user, true);
    }
  }, [session, loadUserProfile]);

  const signUp = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('[AuthContext] Attempting sign up for:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.log('[AuthContext] Sign up error:', error);
        
        if (error.message.includes('already registered')) {
          return { 
            success: false, 
            message: 'This email is already registered. Please sign in instead.' 
          };
        }
        
        return { success: false, message: error.message };
      }

      if (data.user && !data.session) {
        console.log('[AuthContext] Email confirmation required for:', email);
        return { 
          success: true, 
          message: 'Account created! Please check your email to verify your account.' 
        };
      }

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
      console.log('[AuthContext] Clearing local state immediately...');
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoading(false);
      
      logoutUser().catch(error => {
        console.error('[AuthContext] Error logging out from RevenueCat (non-critical):', error);
      });
      
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
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoading(false);
      console.log('[AuthContext] ===== SIGN OUT COMPLETE (with errors) =====');
    }
  };

  const deleteAccount = async (): Promise<{ success: boolean; message: string }> => {
    console.log('[AuthContext] ===== DELETE ACCOUNT STARTED =====');
    console.log('[AuthContext] User to delete:', user?.email);
    
    if (!user) {
      console.log('[AuthContext] No user to delete');
      return { success: false, message: 'No user is currently signed in' };
    }

    try {
      const userId = user.id;
      console.log('[AuthContext] Deleting user ID:', userId);

      console.log('[AuthContext] Deleting profile from database...');
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error('[AuthContext] Error deleting profile:', profileError);
        return { success: false, message: 'Failed to delete profile data: ' + profileError.message };
      }

      console.log('[AuthContext] ✅ Profile deleted successfully');

      console.log('[AuthContext] Deleting auth account...');
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);

      if (authError) {
        console.error('[AuthContext] Error deleting auth account:', authError);
        await signOut();
        return { success: false, message: 'Account data deleted but auth deletion failed. Please contact support.' };
      }

      console.log('[AuthContext] ✅ Auth account deleted successfully');

      console.log('[AuthContext] Clearing local state...');
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoading(false);

      try {
        await logoutUser();
      } catch (error) {
        console.error('[AuthContext] Error logging out from RevenueCat (non-critical):', error);
      }

      console.log('[AuthContext] ===== DELETE ACCOUNT COMPLETE =====');
      return { success: true, message: 'Your account has been permanently deleted' };
    } catch (error: any) {
      console.error('[AuthContext] ❌ Delete account exception:', error);
      await signOut();
      return { success: false, message: error.message || 'An unexpected error occurred while deleting your account' };
    }
  };

  const checkSubscription = useCallback((): boolean => {
    if (isLoading || !profile) {
      console.log('[AuthContext] Subscription check: loading or no profile');
      return false;
    }

    if (profile.is_admin) {
      console.log('[AuthContext] Subscription check: user is admin - GRANTED');
      return true;
    }

    if (!profile.is_subscribed) {
      console.log('[AuthContext] Subscription check: not subscribed');
      return false;
    }
    
    if (!profile.subscription_end_date) {
      console.log('[AuthContext] Subscription check: subscribed with no end date - GRANTED');
      return true;
    }
    
    const endDate = new Date(profile.subscription_end_date);
    const isActive = endDate > new Date();
    console.log('[AuthContext] Subscription check: subscribed with end date -', isActive ? 'GRANTED' : 'EXPIRED');
    return isActive;
  }, [isLoading, profile]);

  const isAdmin = useCallback((): boolean => {
    const adminStatus = profile?.is_admin || false;
    console.log('[AuthContext] Admin status:', adminStatus);
    return adminStatus;
  }, [profile]);

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
      deleteAccount,
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
