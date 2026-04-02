import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export interface NotificationContextType {
  hasPermission: boolean;
  permissionDenied: boolean;
  loading: boolean;
  isWeb: boolean;
  requestPermission: () => Promise<boolean>;
  sendTag: (key: string, value: string) => void;
  deleteTag: (key: string) => void;
  lastNotification: Record<string, unknown> | null;
}

const defaultValue: NotificationContextType = {
  hasPermission: false,
  permissionDenied: false,
  loading: false,
  isWeb: false,
  requestPermission: async () => false,
  sendTag: () => {},
  deleteTag: () => {},
  lastNotification: null,
};

const NotificationContext = createContext<NotificationContextType>(defaultValue);

export function NotificationProvider({ children }: { children: ReactNode }) {
  return (
    <NotificationContext.Provider value={defaultValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  return useContext(NotificationContext);
}
