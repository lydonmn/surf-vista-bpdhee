
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function PrivacyPolicyScreen() {
  const lastUpdated = 'January 15, 2025';

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
            Welcome to SurfVista. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the application.
          </Text>
          <Text style={styles.text}>
            We reserve the right to make changes to this Privacy Policy at any time and for any reason. We will alert you about any changes by updating the "Last Updated" date of this Privacy Policy. You are encouraged to periodically review this Privacy Policy to stay informed of updates.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Information We Collect</Text>
          <Text style={styles.text}>
            We may collect information about you in a variety of ways. The information we may collect via the Application includes:
          </Text>
          
          <Text style={styles.subheading}>Personal Data</Text>
          <Text style={styles.text}>
            Personally identifiable information, such as your name, email address, and demographic information that you voluntarily give to us when you register with the Application or when you choose to participate in various activities related to the Application, such as creating an account or subscribing to our services.
          </Text>

          <Text style={styles.subheading}>Derivative Data</Text>
          <Text style={styles.text}>
            Information our servers automatically collect when you access the Application, such as your device type, operating system, access times, and the pages you have viewed directly before and after accessing the Application.
          </Text>

          <Text style={styles.subheading}>Financial Data</Text>
          <Text style={styles.text}>
            Financial information, such as data related to your payment method (e.g., valid credit card number, card brand, expiration date) that we may collect when you purchase, order, return, exchange, or request information about our services from the Application. We store only very limited, if any, financial information that we collect. Otherwise, all financial information is stored by our payment processor, Apple Inc., and you are encouraged to review their privacy policy and contact them directly for responses to your questions.
          </Text>

          <Text style={styles.subheading}>Mobile Device Access</Text>
          <Text style={styles.text}>
            We may request access or permission to certain features from your mobile device, including your mobile device's camera, storage, and other features. If you wish to change our access or permissions, you may do so in your device's settings.
          </Text>

          <Text style={styles.subheading}>Push Notifications</Text>
          <Text style={styles.text}>
            We may request to send you push notifications regarding your account or the Application. If you wish to opt-out from receiving these types of communications, you may turn them off in your device's settings.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Use of Your Information</Text>
          <Text style={styles.text}>
            Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Application to:
          </Text>
          <Text style={styles.bulletText}>
            • Create and manage your account{'\n'}
            • Process your transactions and send you related information{'\n'}
            • Email you regarding your account or subscription{'\n'}
            • Enable user-to-user communications{'\n'}
            • Fulfill and manage purchases, orders, payments, and other transactions{'\n'}
            • Generate a personal profile about you to make future visits more personalized{'\n'}
            • Increase the efficiency and operation of the Application{'\n'}
            • Monitor and analyze usage and trends to improve your experience{'\n'}
            • Notify you of updates to the Application{'\n'}
            • Offer new products, services, and/or recommendations{'\n'}
            • Perform other business activities as needed{'\n'}
            • Prevent fraudulent transactions, monitor against theft{'\n'}
            • Process payments and refunds{'\n'}
            • Request feedback and contact you about your use of the Application{'\n'}
            • Resolve disputes and troubleshoot problems{'\n'}
            • Respond to product and customer service requests{'\n'}
            • Send you a newsletter{'\n'}
            • Solicit support for the Application
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Disclosure of Your Information</Text>
          <Text style={styles.text}>
            We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
          </Text>

          <Text style={styles.subheading}>By Law or to Protect Rights</Text>
          <Text style={styles.text}>
            If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.
          </Text>

          <Text style={styles.subheading}>Third-Party Service Providers</Text>
          <Text style={styles.text}>
            We may share your information with third parties that perform services for us or on our behalf, including payment processing, data analysis, email delivery, hosting services, customer service, and marketing assistance.
          </Text>

          <Text style={styles.subheading}>Business Transfers</Text>
          <Text style={styles.text}>
            We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.
          </Text>

          <Text style={styles.subheading}>Third-Party Advertisers</Text>
          <Text style={styles.text}>
            We may use third-party advertising companies to serve ads when you visit the Application. These companies may use information about your visits to the Application and other websites that are contained in web cookies in order to provide advertisements about goods and services of interest to you.
          </Text>

          <Text style={styles.subheading}>Other Third Parties</Text>
          <Text style={styles.text}>
            We may share your information with advertisers and investors for the purpose of conducting general business analysis. We may also share your information with such third parties for marketing purposes, as permitted by law.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Tracking Technologies</Text>
          
          <Text style={styles.subheading}>Cookies and Web Beacons</Text>
          <Text style={styles.text}>
            We may use cookies, web beacons, tracking pixels, and other tracking technologies on the Application to help customize the Application and improve your experience. When you access the Application, your personal information is not collected through the use of tracking technology. Most browsers are set to accept cookies by default. You can remove or reject cookies, but be aware that such action could affect the availability and functionality of the Application.
          </Text>

          <Text style={styles.subheading}>Internet-Based Advertising</Text>
          <Text style={styles.text}>
            Additionally, we may use third-party software to serve ads on the Application, implement email marketing campaigns, and manage other interactive marketing initiatives. This third-party software may use cookies or similar tracking technology to help manage and optimize your online experience with us.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Third-Party Websites</Text>
          <Text style={styles.text}>
            The Application may contain links to third-party websites and applications of interest, including advertisements and external services, that are not affiliated with us. Once you have used these links to leave the Application, any information you provide to these third parties is not covered by this Privacy Policy, and we cannot guarantee the safety and privacy of your information. Before visiting and providing any information to any third-party websites, you should inform yourself of the privacy policies and practices (if any) of the third party responsible for that website, and should take those steps necessary to, in your discretion, protect the privacy of your information.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Security of Your Information</Text>
          <Text style={styles.text}>
            We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse. Any information disclosed online is vulnerable to interception and misuse by unauthorized parties. Therefore, we cannot guarantee complete security if you provide personal information.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Policy for Children</Text>
          <Text style={styles.text}>
            We do not knowingly solicit information from or market to children under the age of 13. If you become aware of any data we have collected from children under age 13, please contact us using the contact information provided below.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Controls for Do-Not-Track Features</Text>
          <Text style={styles.text}>
            Most web browsers and some mobile operating systems include a Do-Not-Track ("DNT") feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. No uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Policy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Options Regarding Your Information</Text>
          
          <Text style={styles.subheading}>Account Information</Text>
          <Text style={styles.text}>
            You may at any time review or change the information in your account or terminate your account by:
          </Text>
          <Text style={styles.bulletText}>
            • Logging into your account settings and updating your account{'\n'}
            • Contacting us using the contact information provided below
          </Text>
          <Text style={styles.text}>
            Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. However, some information may be retained in our files to prevent fraud, troubleshoot problems, assist with any investigations, enforce our Terms of Use and/or comply with legal requirements.
          </Text>

          <Text style={styles.subheading}>Emails and Communications</Text>
          <Text style={styles.text}>
            If you no longer wish to receive correspondence, emails, or other communications from us, you may opt-out by:
          </Text>
          <Text style={styles.bulletText}>
            • Noting your preferences at the time you register your account with the Application{'\n'}
            • Logging into your account settings and updating your preferences{'\n'}
            • Contacting us using the contact information provided below
          </Text>
          <Text style={styles.text}>
            If you no longer wish to receive correspondence, emails, or other communications from third parties, you are responsible for contacting the third party directly.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. California Privacy Rights</Text>
          <Text style={styles.text}>
            California Civil Code Section 1798.83, also known as the "Shine The Light" law, permits our users who are California residents to request and obtain from us, once a year and free of charge, information about categories of personal information (if any) we disclosed to third parties for direct marketing purposes and the names and addresses of all third parties with which we shared personal information in the immediately preceding calendar year. If you are a California resident and would like to make such a request, please submit your request in writing to us using the contact information provided below.
          </Text>
          <Text style={styles.text}>
            If you are under 18 years of age, reside in California, and have a registered account with the Application, you have the right to request removal of unwanted data that you publicly post on the Application. To request removal of such data, please contact us using the contact information provided below, and include the email address associated with your account and a statement that you reside in California. We will make sure the data is not publicly displayed on the Application, but please be aware that the data may not be completely or comprehensively removed from our systems.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Contact Us</Text>
          <Text style={styles.text}>
            If you have questions or comments about this Privacy Policy, please contact us at:
          </Text>
          <Text style={styles.bulletText}>
            SurfVista{'\n'}
            Folly Beach, SC{'\n'}
            support@surfvista.com
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This privacy policy was created using FlyCricket's Privacy Policy Generator.
          </Text>
          <Text style={styles.footerText}>
            By using SurfVista, you acknowledge that you have read and understood this Privacy Policy and agree to its terms.
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
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
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
    marginBottom: 8,
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
    marginBottom: 8,
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
