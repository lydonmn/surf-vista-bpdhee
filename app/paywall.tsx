
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { openPaywall } from '@/utils/paywallHelper';
import Purchases, { PurchasesPackage } from 'react-native-purchases';

const FEATURES = [
  {
    icon_ios: 'video.fill',
    icon_android: 'videocam',
    title: '6K Drone Videos',
    description: 'Daily high-resolution surf condition videos from above',
  },
  {
    icon_ios: 'waveform.path',
    icon_android: 'waves',
    title: 'AI Surf Forecasts',
    description: '7-day predictions powered by real-time buoy & weather data',
  },
  {
    icon_ios: 'clock.fill',
    icon_android: 'schedule',
    title: 'Daily 5 AM Reports',
    description: 'Fresh surf reports delivered every morning before you paddle out',
  },
  {
    icon_ios: 'bell.fill',
    icon_android: 'notifications',
    title: 'Push Notifications',
    description: 'Get alerted when conditions are firing at your spot',
  },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { isSubscribed, loading, packages, isWeb, restorePurchases } = useSubscription();
  const { user } = useAuth();
  const [rcPackages, setRcPackages] = useState<PurchasesPackage[]>([]);

  // If already subscribed, go back to the app
  useEffect(() => {
    if (!loading && isSubscribed) {
      console.log('[Paywall] User is already subscribed, redirecting to tabs');
      router.replace('/(tabs)');
    }
  }, [isSubscribed, loading]);

  // Fetch real pricing from RevenueCat
  useEffect(() => {
    if (isWeb) return;
    console.log('[Paywall] Fetching offerings from RevenueCat');
    Purchases.getOfferings()
      .then(offerings => {
        console.log('[Paywall] Offerings received:', offerings.current?.identifier);
        if (offerings.current?.availablePackages) {
          setRcPackages(offerings.current.availablePackages);
          console.log('[Paywall] Available packages:', offerings.current.availablePackages.map(p => p.identifier));
        }
      })
      .catch(err => {
        console.log('[Paywall] Failed to fetch offerings:', err);
      });
  }, [isWeb]);

  const handleSubscribe = async () => {
    console.log('[Paywall] Subscribe button pressed');
    if (isWeb) {
      console.log('[Paywall] Web platform — purchases not available');
      return;
    }
    if (packages.length > 0) {
      console.log('[Paywall] Opening native RevenueCat paywall');
      await openPaywall(user?.id, user?.email ?? undefined);
    } else {
      console.log('[Paywall] No packages available, opening native paywall UI');
      await openPaywall(user?.id, user?.email ?? undefined);
    }
  };

  const handleRestore = async () => {
    console.log('[Paywall] Restore purchases pressed');
    try {
      await restorePurchases();
    } catch {
      // handled inside restorePurchases
    }
  };

  const handleTermsPress = () => {
    console.log('[Paywall] Terms of Service link pressed');
    router.push('/terms-of-service');
  };

  const handlePrivacyPress = () => {
    console.log('[Paywall] Privacy Policy link pressed');
    router.push('/privacy-policy');
  };

  // Derive price display from RevenueCat packages or context packages
  const displayPackages = rcPackages.length > 0 ? rcPackages : packages;
  const priceLabel = displayPackages.length > 0
    ? displayPackages[0].product.priceString + ' / ' + (displayPackages[0].packageType === 'ANNUAL' ? 'year' : 'month')
    : null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <IconSymbol
              ios_icon_name="waveform.path"
              android_material_icon_name="waves"
              size={40}
              color={colors.primary}
            />
          </View>
          <Text style={styles.title}>Unlock SurfVista Pro</Text>
          <Text style={styles.subtitle}>
            Get full access to daily surf reports, 6K drone videos, and AI-powered forecasts.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIconCircle}>
                <IconSymbol
                  ios_icon_name={feature.icon_ios}
                  android_material_icon_name={feature.icon_android}
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check_circle"
                size={20}
                color={colors.success}
              />
            </View>
          ))}
        </View>

        {/* Pricing from RevenueCat */}
        {priceLabel && (
          <View style={styles.pricingContainer}>
            {displayPackages.map(pkg => (
              <Text key={pkg.identifier} style={styles.pricingText}>
                {pkg.product.title}
                {' — '}
                {pkg.product.priceString}
              </Text>
            ))}
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={styles.subscribeButton}
          onPress={handleSubscribe}
          activeOpacity={0.85}
        >
          <Text style={styles.subscribeButtonText}>
            {isWeb ? 'Available on iOS & Android' : 'Subscribe Now'}
          </Text>
        </TouchableOpacity>

        {!isWeb && (
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            activeOpacity={0.7}
          >
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.termsText}>
          Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
        </Text>

        {/* Legal links — required for App Store compliance */}
        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={handleTermsPress} activeOpacity={0.7}>
            <Text style={styles.legalLinkText}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={styles.legalSeparator}>{'  •  '}</Text>
          <TouchableOpacity onPress={handlePrivacyPress} activeOpacity={0.7}>
            <Text style={styles.legalLinkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1E',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0F1E',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.primary}22`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    marginBottom: 32,
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  featureIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  featureDescription: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  pricingContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  pricingText: {
    fontSize: 15,
    color: '#CBD5E1',
    fontWeight: '600',
    textAlign: 'center',
  },
  subscribeButton: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  restoreButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  restoreButtonText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '500',
  },
  termsText: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legalLinkText: {
    fontSize: 11,
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontSize: 11,
    color: '#475569',
  },
});
