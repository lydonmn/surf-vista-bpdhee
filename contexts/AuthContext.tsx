
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform, InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/app/integrations/supabase/client';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { Database } from '@/app/integrations/supabase/types';
import { initializeRevenueCat } from '@/utils/superwallConfig';
import { ensurePushTokenRegistered } from '@/utils/pushNotifications';
import { errorLogger } from '@/utils/errorLogger';

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
  const hasInitializedNativeModulesRef = useRef(false);

  // 🚨 CRITICAL FIX: Defer native module initialization until after auth is stable
  useEffect(() => {
    if (!isInitialized || hasInitializedNativeModulesRef.current) {
      return;
    }

    console.log('[AuthContext] 🚀 Auth initialized, scheduling native module initialization...');
    hasInitializedNativeModulesRef.current = true;

    // Use InteractionManager to defer until UI is stable
    InteractionManager.runAfterInteractions(async () => {
      console.log('[AuthContext] 🎬 Starting native module initialization (after interactions)...');
      
      // Initialize RevenueCat
      try {
        console.log('[AuthContext] 💳 Initializing RevenueCat...');
        await initializeRevenueCat();
        console.log('[AuthContext] ✅ RevenueCat initialized');
      } catch (rcError) {
        console.error('[AuthContext] ⚠️ RevenueCat initialization failed (non-critical):', rcError);
        errorLogger.logError(rcError, 'AuthContext: Failed to initialize RevenueCat');
      }
      
      // Register push token if user is logged in
      if (user?.id) {
        try {
          console.log('[AuthContext] 📲 Checking push token registration...');
          await ensurePushTokenRegistered(user.id);
          console.log('[AuthContext] ✅ Push token check complete');
        } catch (pushError) {
          console.error('[AuthContext] ⚠️ Push token registration failed (non-critical):', pushError);
          errorLogger.logError(pushError, 'AuthContext: Failed to register push token');
        }
      }
      
      console.log('[AuthContext] ✅ Native module initialization complete');
    });
  }, [isInitialized, user?.id]);

  const loadUserProfile = useCallback(async (authUser: SupabaseUser) => {
    try {
      console.log('[AuthContext] Loading profile for user:', authUser.id);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile load timeout')), 10000)
      );
      
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      const { data: profileData, error } = await Promise.race([
        profilePromise,
        timeoutPromise
      ]) as any;

      if (profileData) {
        console.log('[AuthContext] ✅ Profile loaded:', profileData.email);
        setProfile(profileData);
        setUser({ ...authUser, profile: profileData });
        return;
      }

      if (error?.code === 'PGRST116') {
        console.log('[AuthContext] Profile not found, creating...');
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
          console.log('[AuthContext] ✅ Profile created');
          setProfile(newProfile);
          setUser({ ...authUser, profile: newProfile });
          return;
        }
      }

      console.log('[AuthContext] ⚠️ Profile load failed, setting user without profile');
      setProfile(null);
      setUser({ ...authUser });
    } catch (error) {
      console.error('[AuthContext] Exception loading profile:', error);
      errorLogger.logError(error, 'AuthContext: Exception loading profile');
      setProfile(null);
      setUser({ ...authUser });
    }
  }, []);

  const signOut = useCallback(async () => {
    console.log('[AuthContext] ===== SIGN OUT STARTED =====');
    
    try {
      console.log('[AuthContext] Clearing local state...');
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoading(false);
      
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
      errorLogger.logError(error, 'AuthContext: Sign out exception');
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoading(false);
      console.log('[AuthContext] ===== SIGN OUT COMPLETE (with errors) =====');
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      console.log('[AuthContext] 🔄 Refreshing session...');
      const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[AuthContext] ❌ Session refresh error:', error);
        
        if (error.message.includes('Invalid Refresh Token') || 
            error.message.includes('Refresh Token Not Found') ||
            error.message.includes('refresh_token_not_found')) {
          console.log('[AuthContext] Invalid refresh token detected - clearing session');
          
          await AsyncStorage.removeItem('supabase.auth.token');
          await signOut();
        }
        return;
      }
      
      if (newSession) {
        console.log('[AuthContext] ✅ Session refreshed');
        setSession(newSession);
        
        if (newSession.user) {
          await loadUserProfile(newSession.user);
        }
      }
    } catch (error) {
      console.error('[AuthContext] Exception refreshing session:', error);
      errorLogger.logError(error, 'AuthContext: Exception refreshing session');
      
      try {
        await AsyncStorage.removeItem('supabase.auth.token');
        await signOut();
      } catch (clearError) {
        console.error('[AuthContext] Error clearing session:', clearError);
      }
    }
  }, [loadUserProfile, signOut]);

  useEffect(() => {
    if (isInitializingRef.current) {
      console.log('[AuthContext] Already initializing, skipping...');
      return;
    }

    console.log('[AuthContext] 🚀 Starting initialization...');
    isInitializingRef.current = true;
    
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('[AuthContext] Getting initial session...');
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[AuthContext] Session error:', sessionError);
          
          if (sessionError.message.includes('Invalid Refresh Token') || 
              sessionError.message.includes('Refresh Token Not Found') ||
              sessionError.message.includes('refresh_token_not_found')) {
            console.log('[AuthContext] Invalid refresh token on init - clearing storage');
            
            try {
              await AsyncStorage.removeItem('supabase.auth.token');
            } catch (clearError) {
              console.error('[AuthContext] Error clearing token:', clearError);
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

        console.log('[AuthContext] Session check:', initialSession?.user?.email || 'No session');
        
        if (initialSession?.user) {
          setSession(initialSession);
          console.log('[AuthContext] Loading profile...');
          await loadUserProfile(initialSession.user);
        }
        
        if (mounted) {
          console.log('[AuthContext] ✅ Initialization complete');
          setIsLoading(false);
          setIsInitialized(true);
        }
        
      } catch (error) {
        console.error('[AuthContext] ❌ Initialization error:', error);
        errorLogger.logError(error, 'AuthContext: Initialization error');
        if (mounted) {
          console.log('[AuthContext] ✅ Completing initialization despite error');
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

      console.log('[AuthContext] Auth event:', event);
      
      if (event === 'SIGNED_OUT') {
        console.log('[AuthContext] SIGNED_OUT event');
        setUser(null);
        setProfile(null);
        setSession(null);
        setIsLoading(false);
      } else if (event === 'SIGNED_IN' && newSession?.user) {
        console.log('[AuthContext] SIGNED_IN event');
        setSession(newSession);
        await loadUserProfile(newSession.user);
        setIsLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && newSession?.user) {
        console.log('[AuthContext] TOKEN_REFRESHED event');
        setSession(newSession);
      } else if (event === 'USER_UPDATED' && newSession?.user) {
        console.log('[AuthContext] USER_UPDATED event');
        setSession(newSession);
        await loadUserProfile(newSession.user);
        setIsLoading(false);
      } else if (!newSession) {
        console.log('[AuthContext] No session, clearing');
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
  }, [loadUserProfile]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      console.log('[AuthContext] Refreshing profile...');
      await loadUserProfile(session.user);
    }
  }, [session?.user, loadUserProfile]);

  const signUp = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('[AuthContext] Sign up:', email);
      
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
      console.log('[AuthContext] Redirect URL:', redirectTo);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
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
        console.log('[AuthContext] Email confirmation required');
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
      errorLogger.logError(error, 'AuthContext: Sign up exception');
      return { success: false, message: error.message || 'An unexpected error occurred' };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('[AuthContext] Sign in:', email);
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
        console.log('[AuthContext] Sign in successful');
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, message: 'Signed in successfully!' };
      }

      setIsLoading(false);
      return { success: false, message: 'Sign in failed' };
    } catch (error: any) {
      console.error('[AuthContext] Sign in exception:', error);
      errorLogger.logError(error, 'AuthContext: Sign in exception');
      setIsLoading(false);
      return { success: false, message: error.message || 'An unexpected error occurred' };
    }
  };

  const deleteAccount = async (): Promise<{ success: boolean; message: string }> => {
    console.log('[AuthContext] ===== DELETE ACCOUNT STARTED =====');
    
    if (!user) {
      return { success: false, message: 'No user is currently signed in' };
    }

    try {
      const userId = user.id;
      console.log('[AuthContext] Deleting user:', userId);

      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error('[AuthContext] Error deleting profile:', profileError);
        return { success: false, message: 'Failed to delete profile data: ' + profileError.message };
      }

      console.log('[AuthContext] ✅ Profile deleted');

      const { error: authError } = await supabase.auth.admin.deleteUser(userId);

      if (authError) {
        console.error('[AuthContext] Error deleting auth:', authError);
        await signOut();
        return { success: false, message: 'Account data deleted but auth deletion failed. Please contact support.' };
      }

      console.log('[AuthContext] ✅ Auth deleted');

      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoading(false);

      console.log('[AuthContext] ===== DELETE ACCOUNT COMPLETE =====');
      return { success: true, message: 'Your account has been permanently deleted' };
    } catch (error: any) {
      console.error('[AuthContext] ❌ Delete account exception:', error);
      errorLogger.logError(error, 'AuthContext: Delete account exception');
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
