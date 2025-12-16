
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSubscription: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.log('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Demo login - in production, this would call your backend
      // Admin credentials: admin@surfvista.com / admin123
      // Regular user: user@example.com / user123
      
      if (email === 'admin@surfvista.com' && password === 'admin123') {
        const adminUser: User = {
          id: '1',
          email,
          isSubscribed: true,
          isAdmin: true,
        };
        await AsyncStorage.setItem('user', JSON.stringify(adminUser));
        setUser(adminUser);
        return true;
      } else if (email === 'user@example.com' && password === 'user123') {
        const regularUser: User = {
          id: '2',
          email,
          isSubscribed: true,
          isAdmin: false,
          subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
        await AsyncStorage.setItem('user', JSON.stringify(regularUser));
        setUser(regularUser);
        return true;
      }
      
      return false;
    } catch (error) {
      console.log('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      setUser(null);
    } catch (error) {
      console.log('Logout error:', error);
    }
  };

  const checkSubscription = (): boolean => {
    if (!user || !user.isSubscribed) return false;
    
    if (user.subscriptionEndDate) {
      const endDate = new Date(user.subscriptionEndDate);
      return endDate > new Date();
    }
    
    return true;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, checkSubscription }}>
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
