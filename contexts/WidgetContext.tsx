
import * as React from "react";
import { createContext, useCallback, useContext } from "react";
import { Platform } from "react-native";

// Conditionally import ExtensionStorage only on iOS
let ExtensionStorage: any = null;
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ExtensionStorage = require("@bacons/apple-targets").ExtensionStorage;
  } catch (error) {
    console.warn('[WidgetContext] ExtensionStorage not available:', error);
  }
}

type WidgetContextType = {
  refreshWidget: () => void;
};

const WidgetContext = createContext<WidgetContextType | null>(null);

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if (ExtensionStorage && Platform.OS === 'ios') {
      try {
        ExtensionStorage.reloadWidget();
      } catch (error) {
        console.warn('[WidgetContext] Error reloading widget:', error);
      }
    }
  }, []);

  const refreshWidget = useCallback(() => {
    if (ExtensionStorage && Platform.OS === 'ios') {
      try {
        ExtensionStorage.reloadWidget();
      } catch (error) {
        console.warn('[WidgetContext] Error refreshing widget:', error);
      }
    }
  }, []);

  return (
    <WidgetContext.Provider value={{ refreshWidget }}>
      {children}
    </WidgetContext.Provider>
  );
}

export const useWidget = () => {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("useWidget must be used within a WidgetProvider");
  }
  return context;
};
