// Subscription guard — paywall is only enforced on video content.
// This hook is kept as a no-op to avoid breaking any existing imports.
export function useSubscriptionGuard() {
  // No-op: forecast, conditions, weather, and report content are freely accessible.
  // Video playback gating is handled directly in the videos tab and video player screens.
}
