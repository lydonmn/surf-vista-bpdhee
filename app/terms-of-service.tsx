
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function TermsOfServiceScreen() {
  const lastUpdated = 'January 2025';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Terms of Service',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.lastUpdated}>Last Updated: {lastUpdated}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.text}>
            By accessing and using SurfVista, you accept and agree to be bound by these Terms of Service. 
            If you do not agree to these terms, please do not use the app.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Description of Service</Text>
          <Text style={styles.text}>
            SurfVista provides exclusive surf reports, 6K drone videos, and automated surf forecasts for 
            Folly Beach, South Carolina. Access to premium content requires an active subscription.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Subscription and Payment</Text>
          <Text style={styles.text}>
            • Monthly subscription fee: $5.00 (subject to change){'\n'}
            • Subscriptions automatically renew unless cancelled{'\n'}
            • Payment is processed through Apple App Store{'\n'}
            • Refunds are subject to Apple's refund policy{'\n'}
            • You can cancel anytime through your Apple ID settings
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. User Accounts</Text>
          <Text style={styles.text}>
            You are responsible for:{'\n'}
            • Maintaining the confidentiality of your account credentials{'\n'}
            • All activities that occur under your account{'\n'}
            • Notifying us immediately of any unauthorized use{'\n'}
            • Providing accurate and current information
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Content and Intellectual Property</Text>
          <Text style={styles.text}>
            All content, including videos, reports, and forecasts, is owned by SurfVista and protected by 
            copyright laws. You may not:{'\n'}
            • Copy, distribute, or share premium content{'\n'}
            • Use content for commercial purposes{'\n'}
            • Reverse engineer or modify the app{'\n'}
            • Share your account credentials with others
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Disclaimer of Warranties</Text>
          <Text style={styles.text}>
            SurfVista provides surf reports and forecasts for informational purposes only. We do not 
            guarantee accuracy and are not responsible for decisions made based on our content. 
            Always exercise caution and good judgment when surfing.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
          <Text style={styles.text}>
            SurfVista and its operators shall not be liable for any injuries, damages, or losses resulting 
            from use of the app or reliance on surf reports. Surfing is an inherently dangerous activity.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Termination</Text>
          <Text style={styles.text}>
            We reserve the right to terminate or suspend your account at any time for violations of these 
            terms. You may cancel your subscription at any time through your Apple ID settings.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Changes to Terms</Text>
          <Text style={styles.text}>
            We may modify these terms at any time. Continued use of the app after changes constitutes 
            acceptance of the new terms. We will notify users of significant changes.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Governing Law</Text>
          <Text style={styles.text}>
            These terms are governed by the laws of South Carolina, United States. Any disputes shall be 
            resolved in the courts of South Carolina.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Contact Information</Text>
          <Text style={styles.text}>
            For questions about these terms, please contact:{'\n'}
            lydon@droningcharleston.com
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol 
            ios_icon_name="arrow.left" 
            android_material_icon_name="arrow-back" 
            size={20} 
            color="#fff" 
          />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  text: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
