
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/app/integrations/supabase/client';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { Database } from '@/app/integrations/supabase/types';

// 🚨 CRITICAL: Ultra-defensive module imports with fallbacks
let initializeRevenueCat: any = async () => false;
let identifyUser: any = async () => {};
let logoutUser: any = async () => {};
let ensurePushTokenRegistered: any = async () => {};

// Try to load RevenueCat - fail silently if not available
try {
  const superwallConfig = require('@/utils/superwallConfig');
  if (superwallConfig.initializeRevenueCat) initializeRevenueCat = superwallConfig.initializeRevenueCat;
  if (superwallConfig.identifyUser) identifyUser = superwallConfig.identifyUser;
  if (superwallConfig.logoutUser) logoutUser = superwallConfig.logoutUser;
} catch {
  // Silently fail - RevenueCat is optional
}

// Try to load push notifications - fail silently if not available
try {
  const pushNotifications = require('@/utils/pushNotifications');
  if (pushNotifications.ensurePushTokenRegistered) {
    ensurePushTokenRegistered = pushNotifications.ensurePushTokenRegistered;
  }
} catch {
  // Silently fail - push notifications are optional
}

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
  refreshSession: () => Promise<void>;
  checkSubscription: () => boolean;
  isAdmin: () => boolean;
  isRegionalAdmin: () => boolean;
  canManageLocation: (locationId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const isInitializingRef = useRef(false);

  // 🚨 CRITICAL: Ultra-defensive push token registration
  const registerPushTokenIfNeeded = useCallback(async (userId: string) => {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 5000)
      );
      
      await Promise.race([
        ensurePushTokenRegistered(userId),
        timeoutPromise
      ]);
    } catch {
      // Silently fail - push tokens are non-critical
    }
  }, []);

  // 🚨 CRITICAL: Ultra-defensive profile loading
  const loadUserProfile = useCallback(async (authUser: SupabaseUser) => {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 8000)
      );
      
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      let result: any;
      try {
        result = await Promise.race([profilePromise, timeoutPromise]);
      } catch {
        // Timeout or error - continue without profile
        setProfile(null);
        setUser({ ...authUser });
        return;
      }

      if (result?.data) {
        setProfile(result.data);
        setUser({ ...authUser, profile: result.data });
        
        // Register push token in background - don't block
        registerPushTokenIfNeeded(authUser.id).catch(() => {});
        return;
      }

      // Profile not found - try to create it
      if (result?.error?.code === 'PGRST116') {
        try {
          const { data: newProfile } = await supabase
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
            setProfile(newProfile);
            setUser({ ...authUser, profile: newProfile });
            return;
          }
        } catch {
          // Silently fail
        }
      }

      // Fallback - set user without profile
      setProfile(null);
      setUser({ ...authUser });
    } catch {
      // Ultimate fallback
      setProfile(null);
      setUser({ ...authUser });
    }
  }, [registerPushTokenIfNeeded]);

  const signOut = useCallback(async () => {
    try {
      // Clear local state first
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoading(false);
      
      // Try to logout from RevenueCat
      try {
        await logoutUser();
      } catch {
        // Silently fail
      }
      
      // Try to sign out from Supabase
      try {
        await supabase.auth.signOut();
      } catch {
        // Silently fail
      }
    } catch {
      // Ultimate fallback - ensure state is cleared
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        // Handle invalid refresh tokens
        if (error.message.includes('Invalid Refresh Token') || 
            error.message.includes('Refresh Token Not Found') ||
            error.message.includes('refresh_token_not_found')) {
          try {
            await AsyncStorage.removeItem('supabase.auth.token');
          } catch {
            // Silently fail
          }
          await signOut();
        }
        return;
      }
      
      if (newSession) {
        setSession(newSession);
        if (newSession.user) {
          await loadUserProfile(newSession.user);
        }
      }
    } catch {
      // Try to clear session on error
      try {
        await AsyncStorage.removeItem('supabase.auth.token');
        await signOut();
      } catch {
        // Silently fail
      }
    }
  }, [loadUserProfile, signOut]);

  // 🚨 CRITICAL: Ultra-defensive initialization with timeout
  useEffect(() => {
    if (isInitializingRef.current) {
      return;
    }

    isInitializingRef.current = true;
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Set a timeout to ensure we don't hang on startup
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth initialization timeout')), 10000)
        );

        const authPromise = (async () => {
          const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            // Handle invalid refresh tokens
            if (sessionError.message.includes('Invalid Refresh Token') || 
                sessionError.message.includes('Refresh Token Not Found') ||
                sessionError.message.includes('refresh_token_not_found')) {
              try {
                await AsyncStorage.removeItem('supabase.auth.token');
              } catch {
                // Silently fail
              }
              
              if (mounted) {
                setUser(null);
                setProfile(null);
                setSession(null);
                setIsLoading(false);
                setIsInitialized(true);
              }
              return;
            }
          }
          
          if (!mounted) return;

          if (initialSession?.user) {
            setSession(initialSession);
            await loadUserProfile(initialSession.user);
          }
          
          if (mounted) {
            setIsLoading(false);
            setIsInitialized(true);
          }

          // Initialize RevenueCat in background on native platforms
          if (mounted && Platform.OS !== 'web') {
            (async () => {
              try {
                const initialized = await initializeRevenueCat();
                if (initialized && initialSession?.user) {
                  await identifyUser(initialSession.user.id, initialSession.user.email || undefined);
                }
              } catch {
                // Silently fail
              }
            })();
          }
        })();

        await Promise.race([authPromise, timeoutPromise]);
        
      } catch (error) {
        console.warn('[AuthContext] Initialization error (non-critical):', error);
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      } finally {
        isInitializingRef.current = false;
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        try {
          await logoutUser();
        } catch {
          // Silently fail
        }
        
        setUser(null);
        setProfile(null);
        setSession(null);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN' && newSession?.user) {
        setSession(newSession);
        await loadUserProfile(newSession.user);
        setIsLoading(false);
        
        if (Platform.OS !== 'web') {
          (async () => {
            try {
              await identifyUser(newSession.user.id, newSession.user.email || undefined);
            } catch {
              // Silently fail
            }
          })();
        }
      } else if (event === 'TOKEN_REFRESHED' && newSession?.user) {
        setSession(newSession);
      } else if (event === 'USER_UPDATED' && newSession?.user) {
        setSession(newSession);
        await loadUserProfile(newSession.user);
        setIsLoading(false);
      } else if (!newSession) {
        setUser(null);
        setProfile(null);
        setSession(null);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile, registerPushTokenIfNeeded]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await loadUserProfile(session.user);
      
      try {
        await registerPushTokenIfNeeded(session.user.id);
      } catch {
        // Silently fail
      }
    }
  }, [session?.user, loadUserProfile, registerPushTokenIfNeeded]);

  const signUp = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const getRedirectUrl = () => {
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined') {
            return `${window.location.origin}/verification-success`;
          }
          return undefined;
        } else {
          return 'surfvista://verification-success';
        }
      };

      const redirectTo = getRedirectUrl();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          return { 
            success: false, 
            message: 'This email is already registered. Please sign in instead.' 
          };
        }
        
        return { success: false, message: error.message };
      }

      if (data.user && !data.session) {
        return { 
          success: true, 
          message: 'Account created! Please check your email to verify your account.' 
        };
      }

      return { success: true, message: 'Account created successfully!' };
    } catch (error: any) {
      return { success: false, message: error.message || 'An unexpected error occurred' };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
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
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, message: 'Signed in successfully!' };
      }

      setIsLoading(false);
      return { success: false, message: 'Sign in failed' };
    } catch (error: any) {
      setIsLoading(false);
      return { success: false, message: error.message || 'An unexpected error occurred' };
    }
  };

  const deleteAccount = async (): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'No user is currently signed in' };
    }

    try {
      const userId = user.id;

      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        return { success: false, message: 'Failed to delete profile data: ' + profileError.message };
      }

      const { error: authError } = await supabase.auth.admin.deleteUser(userId);

      if (authError) {
        await signOut();
        return { success: false, message: 'Account data deleted but auth deletion failed. Please contact support.' };
      }

      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoading(false);

      try {
        await logoutUser();
      } catch {
        // Silently fail
      }

      return { success: true, message: 'Your account has been permanently deleted' };
    } catch (error: any) {
      await signOut();
      return { success: false, message: error.message || 'An unexpected error occurred while deleting your account' };
    }
  };

  const checkSubscription = useCallback((): boolean => {
    if (!profile) {
      return false;
    }

    if (profile.is_admin) {
      return true;
    }

    if (!profile.is_subscribed) {
      return false;
    }
    
    if (!profile.subscription_end_date) {
      return true;
    }
    
    const endDate = new Date(profile.subscription_end_date);
    return endDate > new Date();
  }, [profile]);

  const isAdmin = useCallback((): boolean => {
    return profile?.is_admin || false;
  }, [profile]);

  const isRegionalAdmin = useCallback((): boolean => {
    return profile?.is_regional_admin || false;
  }, [profile]);

  const canManageLocation = useCallback((locationId: string): boolean => {
    if (profile?.is_admin) {
      return true;
    }
    
    if (profile?.is_regional_admin && profile.managed_locations) {
      return profile.managed_locations.includes(locationId);
    }
    
    return false;
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
      refreshSession,
      checkSubscription,
      isAdmin,
      isRegionalAdmin,
      canManageLocation
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
