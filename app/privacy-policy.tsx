
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function PrivacyPolicyScreen() {
  const lastUpdated = 'February 3, 2026';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Privacy Policy',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.subtitle}>SurfVista</Text>
        <Text style={styles.lastUpdated}>Last Updated: {lastUpdated}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Introduction</Text>
          <Text style={styles.text}>
            SurfVista ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Information We Collect</Text>
          <Text style={styles.text}>We collect the following types of information:</Text>
          <Text style={styles.bulletText}>
            • Account Information: Email address, username, and password when you create an account{'\n'}
            • Subscription Information: Subscription status, payment history (processed by Apple){'\n'}
            • Usage Data: App features you use, videos you watch, reports you view{'\n'}
            • Device Information: Device type, operating system, unique device identifiers{'\n'}
            • Location Data: General location (Folly Beach area) to provide relevant surf reports
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
          <Text style={styles.text}>We use your information to:</Text>
          <Text style={styles.bulletText}>
            • Provide and maintain the App{'\n'}
            • Process your subscription and payments{'\n'}
            • Send you surf reports and notifications{'\n'}
            • Improve our services and develop new features{'\n'}
            • Communicate with you about updates and support{'\n'}
            • Prevent fraud and ensure security
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Information Sharing</Text>
          <Text style={styles.text}>
            We do not sell your personal information. We may share your information with:
          </Text>
          <Text style={styles.bulletText}>
            • Apple: For payment processing and subscription management{'\n'}
            • RevenueCat: For subscription analytics and management{'\n'}
            • Supabase: For secure data storage and authentication{'\n'}
            • Service Providers: Third-party services that help us operate the App{'\n'}
            • Legal Requirements: When required by law or to protect our rights
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Data Security</Text>
          <Text style={styles.text}>
            We implement industry-standard security measures to protect your information, including:
          </Text>
          <Text style={styles.bulletText}>
            • Encryption of data in transit and at rest{'\n'}
            • Secure authentication systems{'\n'}
            • Regular security audits{'\n'}
            • Limited access to personal data
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Your Rights</Text>
          <Text style={styles.text}>You have the right to:</Text>
          <Text style={styles.bulletText}>
            • Access your personal information{'\n'}
            • Correct inaccurate data{'\n'}
            • Delete your account and data{'\n'}
            • Opt-out of marketing communications{'\n'}
            • Export your data
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Data Retention</Text>
          <Text style={styles.text}>
            We retain your information for as long as your account is active or as needed to provide services. When you delete your account, we will delete your personal information within 30 days, except where required by law.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Children's Privacy</Text>
          <Text style={styles.text}>
            SurfVista is not intended for children under 13. We do not knowingly collect information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. California Privacy Rights</Text>
          <Text style={styles.text}>
            California residents have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect and the right to request deletion of your information.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. International Users</Text>
          <Text style={styles.text}>
            Your information may be transferred to and processed in the United States. By using the App, you consent to the transfer of your information to the United States.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Changes to This Policy</Text>
          <Text style={styles.text}>
            We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy in the App and updating the "Last Updated" date.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Contact Us</Text>
          <Text style={styles.text}>
            If you have questions about this Privacy Policy, please contact us at:
          </Text>
          <Text style={styles.bulletText}>
            • Email: privacy@surfvista.com{'\n'}
            • Address: Folly Beach, SC
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using SurfVista, you acknowledge that you have read and understood this Privacy Policy.
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 4,
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
    marginBottom: 8,
  },
  bulletText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginLeft: 8,
  },
  footer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#eee',
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
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
