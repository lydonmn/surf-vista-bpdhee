
import { Platform } from "react-native";
import Constants from "expo-constants";

declare const __DEV__: boolean;

const recentLogs: { [key: string]: boolean } = {};
const clearLogAfterDelay = (logKey: string) => {
  setTimeout(() => delete recentLogs[logKey], 100);
};

const MUTED_MESSAGES = [
  'each child in a list should have a unique "key" prop',
  'Each child in a list should have a unique "key" prop',
];

const shouldMuteMessage = (message: string): boolean => {
  return MUTED_MESSAGES.some(muted => message.includes(muted));
};

let logQueue: { level: string; message: string; source: string; timestamp: string; platform: string }[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 500;

const getPlatformName = (): string => {
  switch (Platform.OS) {
    case 'ios':
      return 'iOS';
    case 'android':
      return 'Android';
    case 'web':
      return 'Web';
    default:
      return Platform.OS;
  }
};

let cachedLogServerUrl: string | null = null;
let urlChecked = false;

const getLogServerUrl = (): string | null => {
  if (urlChecked) return cachedLogServerUrl;

  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      cachedLogServerUrl = `${window.location.origin}/natively-logs`;
    } else {
      const experienceUrl = (Constants as any).experienceUrl;
      if (experienceUrl) {
        let baseUrl = experienceUrl
          .replace('exp://', 'https://')
          .split('/')[0] + '//' + experienceUrl.replace('exp://', '').split('/')[0];

        if (baseUrl.includes('192.168.') || baseUrl.includes('10.') || baseUrl.includes('localhost')) {
          baseUrl = baseUrl.replace('https://', 'http://');
        }

        cachedLogServerUrl = `${baseUrl}/natively-logs`;
      } else {
        const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.hostUri;
        if (hostUri) {
          const protocol = hostUri.includes('ngrok') || hostUri.includes('.io') ? 'https' : 'http';
          cachedLogServerUrl = `${protocol}://${hostUri.split('/')[0]}/natively-logs`;
        }
      }
    }
  } catch {
    console.log('[ErrorLogger] Failed to get log server URL');
  }

  urlChecked = true;
  return cachedLogServerUrl;
};

let fetchErrorLogged = false;

const flushLogs = async () => {
  if (logQueue.length === 0) return;

  const logsToSend = [...logQueue];
  logQueue = [];
  flushTimeout = null;

  const url = getLogServerUrl();
  if (!url) {
    return;
  }

  for (const log of logsToSend) {
    try {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      }).catch(() => {
        if (!fetchErrorLogged) {
          fetchErrorLogged = true;
          if (typeof window !== 'undefined' && window.console) {
            (window.console as any).__proto__.log.call(console, '[Natively] Fetch error (will not repeat)');
          }
        }
      });
    } catch {
      console.log('[ErrorLogger] Failed to send log');
    }
  }
};

const queueLog = (level: string, message: string, source: string = '') => {
  const logKey = `${level}:${message}`;

  if (recentLogs[logKey]) return;
  recentLogs[logKey] = true;
  clearLogAfterDelay(logKey);

  logQueue.push({
    level,
    message,
    source,
    timestamp: new Date().toISOString(),
    platform: getPlatformName(),
  });

  if (!flushTimeout) {
    flushTimeout = setTimeout(flushLogs, FLUSH_INTERVAL);
  }
};

const sendErrorToParent = (level: string, message: string, data: any) => {
  const errorKey = `${level}:${message}:${JSON.stringify(data)}`;

  if (recentLogs[errorKey]) {
    return;
  }

  recentLogs[errorKey] = true;
  clearLogAfterDelay(errorKey);

  try {
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'EXPO_ERROR',
        level: level,
        message: message,
        data: data,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        source: 'expo-template'
      }, '*');
    }
  } catch {
    console.log('[ErrorLogger] Failed to send error to parent');
  }
};

const getCallerInfo = (): string => {
  const stack = new Error().stack || '';
  const lines = stack.split('\n');

  for (let i = 3; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('errorLogger') || line.includes('node_modules')) {
      continue;
    }

    let match = line.match(/at\s+\S+\s+\((?:.*\/)?([^/\s:)]+\.[jt]sx?):(\d+):(\d+)\)/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }

    match = line.match(/at\s+(?:.*\/)?([^/\s:)]+\.[jt]sx?):(\d+):(\d+)/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }

    match = line.match(/(?:.*\/)?([^/\s:)]+\.[jt]sx?):(\d+):\d+/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }

    if (line.includes('app/') || line.includes('components/') || line.includes('screens/') || line.includes('hooks/') || line.includes('utils/')) {
      match = line.match(/([^/\s:)]+\.[jt]sx?):(\d+)/);
      if (match) {
        return `${match[1]}:${match[2]}`;
      }
    }
  }

  return '';
};

const stringifyArgs = (args: any[]): string => {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }).join(' ');
};

export const setupErrorLogging = () => {
  if (!__DEV__) {
    return;
  }

  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  const logServerUrl = getLogServerUrl();
  originalConsoleLog('[Natively] Setting up error logging...');
  originalConsoleLog('[Natively] Log server URL:', logServerUrl || 'NOT AVAILABLE');
  originalConsoleLog('[Natively] Platform:', Platform.OS);

  console.log = (...args: any[]) => {
    originalConsoleLog.apply(console, args);

    const message = stringifyArgs(args);
    const source = getCallerInfo();
    queueLog('log', message, source);
  };

  console.warn = (...args: any[]) => {
    originalConsoleWarn.apply(console, args);

    const message = stringifyArgs(args);
    if (shouldMuteMessage(message)) return;

    const source = getCallerInfo();
    queueLog('warn', message, source);
  };

  console.error = (...args: any[]) => {
    const message = stringifyArgs(args);
    if (shouldMuteMessage(message)) return;

    originalConsoleError.apply(console, args);

    const source = getCallerInfo();
    queueLog('error', message, source);

    sendErrorToParent('error', 'Console Error', message);
  };

  if (typeof window !== 'undefined') {
    window.onerror = (message, source, lineno, colno) => {
      const sourceFile = source ? source.split('/').pop() : 'unknown';
      const errorMessage = `RUNTIME ERROR: ${message} at ${sourceFile}:${lineno}:${colno}`;

      queueLog('error', errorMessage, `${sourceFile}:${lineno}:${colno}`);
      sendErrorToParent('error', 'JavaScript Runtime Error', {
        message,
        source: `${sourceFile}:${lineno}:${colno}`,
      });

      return false;
    };

    if (Platform.OS === 'web') {
      window.addEventListener('unhandledrejection', (event) => {
        const message = `UNHANDLED PROMISE REJECTION: ${event.reason}`;
        queueLog('error', message, '');
        sendErrorToParent('error', 'Unhandled Promise Rejection', { reason: event.reason });
      });
    }
  }
};

if (__DEV__) {
  setupErrorLogging();
}
