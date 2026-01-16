
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Stack, router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';

export default function DemoPaywallScreen() {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }} 
      />
      
      <View style={styles.container}>
        {/* Close Button */}
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <IconSymbol
            ios_icon_name="xmark"
            android_material_icon_name="close"
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <IconSymbol
                ios_icon_name="waveform.path"
                android_material_icon_name="waves"
                size={48}
                color={colors.primary}
              />
            </View>
            <Text style={styles.title}>Unlock Premium Surf Reports</Text>
            <Text style={styles.subtitle}>
              Get exclusive access to 6K drone videos and AI-powered surf forecasts
            </Text>
          </View>

          {/* Features */}
          <View style={styles.featuresContainer}>
            <FeatureItem 
              icon="videocam"
              title="6K Drone Videos"
              description="Daily high-resolution surf condition videos"
            />
            <FeatureItem 
              icon="waves"
              title="AI Surf Forecasts"
              description="7-day predictions powered by real-time data"
            />
            <FeatureItem 
              icon="schedule"
              title="Tide & Weather"
              description="Accurate tide times and weather conditions"
            />
            <FeatureItem 
              icon="notifications"
              title="Daily Updates"
              description="Fresh reports every morning at 5 AM"
            />
          </View>

          {/* Pricing Plans */}
          <View style={styles.plansContainer}>
            <Text style={styles.plansTitle}>Choose Your Plan</Text>
            
            {/* Monthly Plan */}
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'monthly' && styles.planCardSelected
              ]}
              onPress={() => setSelectedPlan('monthly')}
            >
              <View style={styles.planHeader}>
                <View style={styles.planInfo}>
                  <Text style={styles.planName}>Monthly</Text>
                  <Text style={styles.planPrice}>$10.99/month</Text>
                </View>
                <View style={[
                  styles.radioButton,
                  selectedPlan === 'monthly' && styles.radioButtonSelected
                ]}>
                  {selectedPlan === 'monthly' && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
              </View>
              <Text style={styles.planDescription}>
                Perfect for trying out premium features
              </Text>
            </TouchableOpacity>

            {/* Annual Plan */}
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'annual' && styles.planCardSelected
              ]}
              onPress={() => setSelectedPlan('annual')}
            >
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>MOST POPULAR</Text>
              </View>
              <View style={styles.planHeader}>
                <View style={styles.planInfo}>
                  <Text style={styles.planName}>Annual</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.planPrice}>$99.99/year</Text>
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsText}>Save 24%</Text>
                    </View>
                  </View>
                </View>
                <View style={[
                  styles.radioButton,
                  selectedPlan === 'annual' && styles.radioButtonSelected
                ]}>
                  {selectedPlan === 'annual' && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
              </View>
              <Text style={styles.planDescription}>
                Best value - just $8.33/month
              </Text>
            </TouchableOpacity>
          </View>

          {/* Subscribe Button */}
          <TouchableOpacity 
            style={styles.subscribeButton}
            onPress={() => {
              // Demo mode - just show success message
              router.back();
            }}
          >
            <LinearGradient
              colors={[colors.primary, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.subscribeGradient}
            >
              <Text style={styles.subscribeButtonText}>
                Start Free Trial
              </Text>
              <Text style={styles.subscribeButtonSubtext}>
                7 days free, then {selectedPlan === 'monthly' ? '$10.99/month' : '$99.99/year'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.termsText}>
            Cancel anytime. Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period.
          </Text>

          {/* Restore Purchases */}
          <TouchableOpacity 
            style={styles.restoreButton}
            onPress={() => router.back()}
          >
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>

          {/* Demo Notice */}
          <View style={styles.demoNotice}>
            <IconSymbol
              ios_icon_name="info.circle.fill"
              android_material_icon_name="info"
              size={20}
              color={colors.accent}
            />
            <Text style={styles.demoNoticeText}>
              Demo Mode - For Screenshot Purposes Only
            </Text>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

function FeatureItem({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconContainer}>
        <IconSymbol
          ios_icon_name={icon}
          android_material_icon_name={icon}
          size={24}
          color={colors.primary}
        />
      </View>
      <View style={styles.featureTextContainer}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
      <IconSymbol
        ios_icon_name="checkmark.circle.fill"
        android_material_icon_name="check_circle"
        size={24}
        color={colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  plansContainer: {
    marginBottom: 24,
  },
  plansTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}08`,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  savingsBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: colors.primary,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  subscribeButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
    elevation: 4,
  },
  subscribeGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subscribeButtonSubtext: {
    color: '#FFFFFF',
    fontSize: 13,
    opacity: 0.9,
  },
  termsText: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  restoreText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${colors.accent}15`,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${colors.accent}30`,
  },
  demoNoticeText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },
});
