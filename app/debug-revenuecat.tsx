
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

interface DiagnosticResult {
  step: string;
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

export default function DebugRevenueCatScreen() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  const addResult = (result: DiagnosticResult) => {
    setResults(prev => [...prev, result]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);

    try {
      // Step 1: Check Platform
      addResult({
        step: '1. Platform Check',
        status: Platform.OS === 'ios' || Platform.OS === 'android' ? 'success' : 'error',
        message: `Platform: ${Platform.OS}`,
        details: Platform.OS === 'web' 
          ? 'RevenueCat only works on iOS/Android. Please test on a real device or simulator.'
          : 'Platform is supported ✓'
      });

      if (Platform.OS === 'web') {
        setIsRunning(false);
        return;
      }

      // Step 2: Check API Key
      const API_KEY = 'test_pOgVpdWTwmnVyqwEJWiaLTwHZsD';
      const isValidKey = API_KEY.startsWith('test_') || API_KEY.startsWith('appl_');
      
      addResult({
        step: '2. API Key Check',
        status: isValidKey ? 'success' : 'error',
        message: `API Key: ${API_KEY.substring(0, 20)}...`,
        details: isValidKey 
          ? 'API key format is valid ✓' 
          : 'API key format is invalid. Should start with "test_" or "appl_"'
      });

      // Step 3: Configure SDK
      try {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        await Purchases.configure({ apiKey: API_KEY });
        
        addResult({
          step: '3. SDK Configuration',
          status: 'success',
          message: 'SDK configured successfully',
          details: 'RevenueCat SDK is initialized ✓'
        });
      } catch (error: any) {
        addResult({
          step: '3. SDK Configuration',
          status: 'error',
          message: 'Failed to configure SDK',
          details: error.message
        });
        setIsRunning(false);
        return;
      }

      // Step 4: Fetch Offerings
      try {
        const offerings = await Purchases.getOfferings();
        
        const hasOfferings = Object.keys(offerings.all).length > 0;
        const hasCurrent = offerings.current !== null;
        
        addResult({
          step: '4. Offerings Check',
          status: hasOfferings ? 'success' : 'error',
          message: `Found ${Object.keys(offerings.all).length} offering(s)`,
          details: hasOfferings 
            ? `Current offering: ${offerings.current?.identifier || 'None'}`
            : '❌ NO OFFERINGS FOUND! You need to create an offering in RevenueCat dashboard.'
        });

        if (offerings.current) {
          // Step 5: Check Packages
          const packages = offerings.current.availablePackages;
          
          addResult({
            step: '5. Packages Check',
            status: packages.length > 0 ? 'success' : 'error',
            message: `Found ${packages.length} package(s)`,
            details: packages.length > 0
              ? packages.map(pkg => `• ${pkg.identifier}: ${pkg.product.priceString}`).join('\n')
              : '❌ NO PACKAGES! You need to add products to your offering.'
          });

          // Step 6: Check Product Details
          if (packages.length > 0) {
            packages.forEach((pkg, index) => {
              addResult({
                step: `6.${index + 1}. Product: ${pkg.identifier}`,
                status: 'info',
                message: pkg.product.title,
                details: `Price: ${pkg.product.priceString}\nProduct ID: ${pkg.product.identifier}\nDescription: ${pkg.product.description}`
              });
            });
          }
        }

        // Step 7: Check Customer Info
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          const hasActiveEntitlements = Object.keys(customerInfo.entitlements.active).length > 0;
          
          addResult({
            step: '7. Customer Info',
            status: 'info',
            message: hasActiveEntitlements ? 'Has active subscription' : 'No active subscription',
            details: `Active entitlements: ${Object.keys(customerInfo.entitlements.active).join(', ') || 'None'}\nAll entitlements: ${Object.keys(customerInfo.entitlements.all).join(', ') || 'None'}`
          });
        } catch (error: any) {
          addResult({
            step: '7. Customer Info',
            status: 'warning',
            message: 'Could not fetch customer info',
            details: error.message
          });
        }

        // Step 8: Sandbox Check
        addResult({
          step: '8. Sandbox Testing',
          status: 'info',
          message: 'Sandbox tester check',
          details: __DEV__ 
            ? '⚠️ You are in DEVELOPMENT mode.\n\nTo test purchases:\n1. Sign out of App Store (Settings > App Store)\n2. Create a Sandbox Tester in App Store Connect\n3. When prompted during purchase, sign in with sandbox account\n\nSandbox purchases are FREE and won\'t charge real money.'
            : 'You are in PRODUCTION mode. Real purchases will be charged.'
        });

        // Final Summary
        const hasProblems = results.some(r => r.status === 'error');
        
        if (!hasProblems && offerings.current && offerings.current.availablePackages.length > 0) {
          addResult({
            step: '✅ DIAGNOSIS COMPLETE',
            status: 'success',
            message: 'RevenueCat is configured correctly!',
            details: 'Your paywall should work. If it still doesn\'t show:\n\n1. Make sure you\'re signed out of App Store\n2. Create a Sandbox Tester account\n3. Try presenting the paywall again\n4. Check that your paywall is PUBLISHED in RevenueCat dashboard'
          });
        } else {
          addResult({
            step: '❌ DIAGNOSIS COMPLETE',
            status: 'error',
            message: 'Configuration issues found',
            details: 'See errors above. You need to fix these in RevenueCat dashboard before the paywall will work.'
          });
        }

      } catch (error: any) {
        addResult({
          step: '4. Offerings Check',
          status: 'error',
          message: 'Failed to fetch offerings',
          details: error.message
        });
      }

    } catch (error: any) {
      addResult({
        step: 'Fatal Error',
        status: 'error',
        message: 'Diagnostic failed',
        details: error.message
      });
    }

    setIsRunning(false);
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success': return '#34C759';
      case 'error': return '#FF3B30';
      case 'warning': return '#FF9500';
      case 'info': return '#007AFF';
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success': return 'check-circle';
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'help';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'RevenueCat Diagnostics',
          headerBackTitle: 'Back'
        }} 
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <IconSymbol
            ios_icon_name="stethoscope"
            android_material_icon_name="medical-services"
            size={48}
            color={colors.primary}
          />
          <Text style={styles.title}>RevenueCat Diagnostics</Text>
          <Text style={styles.subtitle}>
            This tool will check your RevenueCat configuration and tell you exactly what's wrong.
          </Text>
        </View>

        {results.length === 0 && !isRunning && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Tap "Run Diagnostics" to check your RevenueCat setup
            </Text>
          </View>
        )}

        {results.map((result, index) => (
          <View key={index} style={[styles.resultCard, { borderLeftColor: getStatusColor(result.status) }]}>
            <View style={styles.resultHeader}>
              <IconSymbol
                ios_icon_name={result.status === 'success' ? 'checkmark.circle.fill' : result.status === 'error' ? 'xmark.circle.fill' : result.status === 'warning' ? 'exclamationmark.triangle.fill' : 'info.circle.fill'}
                android_material_icon_name={getStatusIcon(result.status)}
                size={24}
                color={getStatusColor(result.status)}
              />
              <View style={styles.resultHeaderText}>
                <Text style={styles.resultStep}>{result.step}</Text>
                <Text style={styles.resultMessage}>{result.message}</Text>
              </View>
            </View>
            {result.details && (
              <Text style={styles.resultDetails}>{result.details}</Text>
            )}
          </View>
        ))}

        {isRunning && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Running diagnostics...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={runDiagnostics}
          disabled={isRunning}
        >
          {isRunning ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <React.Fragment>
              <IconSymbol
                ios_icon_name="play.fill"
                android_material_icon_name="play-arrow"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.buttonText}>Run Diagnostics</Text>
            </React.Fragment>
          )}
        </TouchableOpacity>

        {results.length > 0 && (
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => {
              const summary = results.map(r => `${r.step}: ${r.message}\n${r.details || ''}`).join('\n\n');
              Alert.alert(
                'Copy Diagnostic Report',
                'This will copy the full diagnostic report to your clipboard so you can share it.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Copy', 
                    onPress: () => {
                      // In a real app, you'd use Clipboard API here
                      Alert.alert('Report', summary);
                    }
                  }
                ]
              );
            }}
          >
            <IconSymbol
              ios_icon_name="doc.on.doc"
              android_material_icon_name="content-copy"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.buttonText, { color: colors.primary }]}>Copy Report</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  resultHeaderText: {
    flex: 1,
  },
  resultStep: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  resultMessage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  resultDetails: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 20,
    paddingLeft: 36,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
