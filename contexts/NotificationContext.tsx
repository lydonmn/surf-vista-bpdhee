/**
 * NotificationContext — unified implementation for all platforms.
 *
 * Uses Platform.OS guards and lazy require() so that react-native-onesignal
 * is never imported on web (where the native module does not exist).
 * This single-file approach avoids Metro's unreliable .native.tsx resolution
 * when web is also a target platform.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { useAuth } from "./AuthContext";

// Read App ID from app.json (expo.extra)
const extra = Constants.expoConfig?.extra || {};
const ONESIGNAL_APP_ID: string = extra.oneSignalAppId || "";

const isWeb = Platform.OS === "web";

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
  isWeb: true,
  requestPermission: async () => false,
  sendTag: () => {},
  deleteTag: () => {},
  lastNotification: null,
};

const NotificationContext = createContext<NotificationContextType>(defaultValue);

// Lazy-load OneSignal so a missing native module doesn't crash at import time.
// Returns null on web or if the module is unavailable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getOneSignal(): any {
  if (isWeb) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-onesignal");
    return mod?.OneSignal ?? null;
  } catch {
    console.warn("[OneSignal] react-native-onesignal native module not available.");
    return null;
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  // Safe: handles different auth context shapes (Better Auth, Supabase, etc.)
  const auth = useAuth() as Record<string, unknown> | null;
  const session = auth?.session as Record<string, unknown> | undefined;
  const user = (auth?.user ?? session?.user ?? null) as { id?: string } | null;

  const [hasPermission, setHasPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(!isWeb);
  const [lastNotification, setLastNotification] = useState<Record<string, unknown> | null>(null);

  // Initialize OneSignal on mount (native only)
  useEffect(() => {
    if (isWeb) return;

    if (!ONESIGNAL_APP_ID) {
      console.warn(
        "[OneSignal] App ID not provided. " +
        "Please add oneSignalAppId to app.json extra."
      );
      setLoading(false);
      return;
    }

    const OneSignal = getOneSignal();
    if (!OneSignal) {
      setLoading(false);
      return;
    }

    try {
      OneSignal.initialize(ONESIGNAL_APP_ID);

      if (__DEV__) {
        console.log("[OneSignal] Initialized with App ID:", ONESIGNAL_APP_ID.substring(0, 8) + "...");
      }

      // Check current permission status
      const permissionStatus = OneSignal.Notifications.hasPermission();
      setHasPermission(permissionStatus);

      // Listen for foreground notification events
      const foregroundHandler = (event: {
        getNotification: () => {
          display: () => void;
          title?: string;
          body?: string;
          additionalData?: unknown;
        };
      }) => {
        event.getNotification().display();
        const notification = event.getNotification();
        setLastNotification({
          title: notification.title,
          body: notification.body,
          additionalData: notification.additionalData,
        });
      };
      OneSignal.Notifications.addEventListener("foregroundWillDisplay", foregroundHandler);

      // Listen for permission changes
      const permissionHandler = (granted: boolean) => {
        setHasPermission(granted);
        setPermissionDenied(!granted);
      };
      OneSignal.Notifications.addEventListener("permissionChange", permissionHandler);

      return () => {
        try {
          OneSignal.Notifications.removeEventListener("foregroundWillDisplay", foregroundHandler);
          OneSignal.Notifications.removeEventListener("permissionChange", permissionHandler);
        } catch {
          // ignore cleanup errors
        }
      };
    } catch (error) {
      console.error("[OneSignal] Failed to initialize:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync OneSignal external user ID with authenticated user (native only)
  useEffect(() => {
    if (isWeb || !ONESIGNAL_APP_ID) return;

    const OneSignal = getOneSignal();
    if (!OneSignal) return;

    try {
      if (user?.id) {
        OneSignal.login(user.id);
        if (__DEV__) {
          console.log("[OneSignal] Linked user ID:", user.id);
        }
      } else {
        OneSignal.logout();
      }
    } catch (error) {
      console.error("[OneSignal] Failed to update user:", error);
    }
  }, [user?.id]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isWeb) return false;

    const OneSignal = getOneSignal();
    if (!OneSignal) return false;

    try {
      console.log("[OneSignal] Requesting notification permission...");
      const granted = await OneSignal.Notifications.requestPermission(true);
      console.log("[OneSignal] Permission result:", granted);
      setHasPermission(granted);
      setPermissionDenied(!granted);
      return granted;
    } catch (error) {
      console.error("[OneSignal] Permission request failed:", error);
      return false;
    }
  }, []);

  const sendTag = useCallback((key: string, value: string) => {
    if (isWeb) return;

    const OneSignal = getOneSignal();
    if (!OneSignal) return;

    try {
      OneSignal.User.addTag(key, value);
    } catch (error) {
      console.error("[OneSignal] Failed to send tag:", error);
    }
  }, []);

  const deleteTag = useCallback((key: string) => {
    if (isWeb) return;

    const OneSignal = getOneSignal();
    if (!OneSignal) return;

    try {
      OneSignal.User.removeTag(key);
    } catch (error) {
      console.error("[OneSignal] Failed to delete tag:", error);
    }
  }, []);

  const value: NotificationContextType = isWeb
    ? defaultValue
    : {
        hasPermission,
        permissionDenied,
        loading,
        isWeb: false,
        requestPermission,
        sendTag,
        deleteTag,
        lastNotification,
      };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  return useContext(NotificationContext);
}
