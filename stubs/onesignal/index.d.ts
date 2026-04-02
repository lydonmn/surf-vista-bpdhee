export declare const OneSignal: {
  initialize(appId: string): void;
  login(externalId: string): void;
  logout(): void;
  setConsentRequired(required: boolean): void;
  setConsentGiven(granted: boolean): void;
  Debug: { setLogLevel(level: any): void; setAlertLevel(level: any): void; };
  User: {
    addTag(key: string, value: string): void;
    addTags(tags: Record<string, string>): void;
    removeTag(key: string): void;
    addEventListener(event: string, handler: any): void;
    removeEventListener(event: string, handler: any): void;
    pushSubscription: {
      getIdAsync(): Promise<string | null>;
      getTokenAsync(): Promise<string | null>;
      getOptedInAsync(): Promise<boolean>;
      optIn(): void;
      optOut(): void;
      addEventListener(event: string, handler: any): void;
      removeEventListener(event: string, handler: any): void;
    };
  };
  Notifications: {
    hasPermission: boolean;
    getPermissionAsync(): Promise<boolean>;
    requestPermission(fallbackToSettings: boolean): Promise<boolean>;
    canRequestPermission(): Promise<boolean>;
    addEventListener(event: string, handler: any): void;
    removeEventListener(event: string, handler: any): void;
    clearAll(): void;
  };
  InAppMessages: {
    addTrigger(key: string, value: string): void;
    removeTrigger(key: string): void;
    setPaused(paused: boolean): void;
    getPaused(): Promise<boolean>;
    addEventListener(event: string, handler: any): void;
    removeEventListener(event: string, handler: any): void;
  };
  Location: { requestPermission(): void; setShared(shared: boolean): void; };
  Session: {
    addOutcome(name: string): void;
    addUniqueOutcome(name: string): void;
    addOutcomeWithValue(name: string, value: number): void;
  };
};
export default OneSignal;
