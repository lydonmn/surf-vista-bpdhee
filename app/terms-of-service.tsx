
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/styles/commonStyles';

export default function TermsOfServiceScreen() {
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Terms of Service (EULA)',
          headerShown: true,
        }} 
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>End User License Agreement (EULA)</Text>
        <Text style={styles.subtitle}>SurfVista - Terms of Service</Text>
        <Text style={styles.date}>Last Updated: February 3, 2026</Text>

        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>
          By downloading, installing, or using SurfVista ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the App.
        </Text>

        <Text style={styles.sectionTitle}>2. Subscription Terms</Text>
        <Text style={styles.paragraph}>
          SurfVista offers auto-renewable subscriptions:
        </Text>
        <Text style={styles.bulletPoint}>• Monthly Subscription: $12.99/month</Text>
        <Text style={styles.bulletPoint}>• Annual Subscription: $99.99/year</Text>
        
        <Text style={styles.paragraph}>
          Payment will be charged to your Apple ID account at confirmation of purchase. Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period.
        </Text>

        <Text style={styles.paragraph}>
          You can manage and cancel your subscriptions by going to your App Store account settings after purchase.
        </Text>

        <Text style={styles.sectionTitle}>3. Free Trial</Text>
        <Text style={styles.paragraph}>
          New subscribers may be eligible for a free trial period. If you do not cancel before the trial ends, you will be automatically charged the subscription fee.
        </Text>

        <Text style={styles.sectionTitle}>4. Cancellation Policy</Text>
        <Text style={styles.paragraph}>
          You may cancel your subscription at any time through your Apple ID account settings. Cancellation takes effect at the end of the current billing period. No refunds will be provided for partial subscription periods.
        </Text>

        <Text style={styles.sectionTitle}>5. Content and Services</Text>
        <Text style={styles.paragraph}>
          SurfVista provides surf reports, forecasts, and video content for Folly Beach, South Carolina. We strive for accuracy but do not guarantee the completeness or reliability of surf conditions data.
        </Text>

        <Text style={styles.sectionTitle}>6. User Conduct</Text>
        <Text style={styles.paragraph}>
          You agree not to:
        </Text>
        <Text style={styles.bulletPoint}>• Share your account credentials with others</Text>
        <Text style={styles.bulletPoint}>• Download or redistribute content without permission</Text>
        <Text style={styles.bulletPoint}>• Use the App for any illegal purposes</Text>
        <Text style={styles.bulletPoint}>• Attempt to reverse engineer or hack the App</Text>

        <Text style={styles.sectionTitle}>7. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          All content, including videos, reports, and forecasts, is owned by SurfVista or its licensors. You may not copy, distribute, or create derivative works without written permission.
        </Text>

        <Text style={styles.sectionTitle}>8. Disclaimer of Warranties</Text>
        <Text style={styles.paragraph}>
          THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE UNINTERRUPTED OR ERROR-FREE SERVICE. SURF CONDITIONS CAN BE DANGEROUS - USE YOUR OWN JUDGMENT.
        </Text>

        <Text style={styles.sectionTitle}>9. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          SurfVista shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the App. Our total liability shall not exceed the amount you paid for your subscription.
        </Text>

        <Text style={styles.sectionTitle}>10. Privacy</Text>
        <Text style={styles.paragraph}>
          Your use of the App is also governed by our Privacy Policy. By using the App, you consent to our collection and use of personal data as outlined in the Privacy Policy.
        </Text>

        <Text style={styles.sectionTitle}>11. Changes to Terms</Text>
        <Text style={styles.paragraph}>
          We reserve the right to modify these terms at any time. Continued use of the App after changes constitutes acceptance of the new terms.
        </Text>

        <Text style={styles.sectionTitle}>12. Termination</Text>
        <Text style={styles.paragraph}>
          We may terminate or suspend your access to the App at any time for violation of these terms or for any other reason.
        </Text>

        <Text style={styles.sectionTitle}>13. Governing Law</Text>
        <Text style={styles.paragraph}>
          These terms are governed by the laws of South Carolina, United States, without regard to conflict of law principles.
        </Text>

        <Text style={styles.sectionTitle}>14. Contact Information</Text>
        <Text style={styles.paragraph}>
          For questions about these terms, please contact us at:
        </Text>
        <Text style={styles.bulletPoint}>Email: lydon@entropyfinancialgroup.com</Text>
        <Text style={styles.bulletPoint}>Address: Folly Beach, SC</Text>

        <Text style={styles.sectionTitle}>15. Apple-Specific Terms</Text>
        <Text style={styles.paragraph}>
          These terms are between you and SurfVista, not Apple. Apple is not responsible for the App or its content. Apple has no obligation to provide maintenance or support services.
        </Text>

        <Text style={styles.paragraph}>
          In the event of any failure of the App to conform to any applicable warranty, you may notify Apple, and Apple will refund the purchase price (if any). To the maximum extent permitted by law, Apple will have no other warranty obligation.
        </Text>

        <Text style={styles.footer}>
          By using SurfVista, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    marginLeft: 16,
    marginBottom: 8,
  },
  footer: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    marginTop: 24,
    fontStyle: 'italic',
  },
});
