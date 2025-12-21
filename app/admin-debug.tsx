
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/app/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminDebugScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [testingFunction, setTestingFunction] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    const info: any = {
      timestamp: new Date().toISOString(),
      estDate: '',
      tables: {},
      edgeFunctions: {},
      errors: [],
    };

    try {
      // Get current EST date
      const now = new Date();
      const estDateString = now.toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const [month, day, year] = estDateString.split('/');
      const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      info.estDate = today;

      // Check surf_conditions table
      try {
        const { data, error, count } = await supabase
          .from('surf_conditions')
          .select('*', { count: 'exact' })
          .eq('date', today);
        
        info.tables.surf_conditions = {
          exists: !error,
          error: error?.message,
          count: count || 0,
          todayData: data,
        };
      } catch (e) {
        info.tables.surf_conditions = {
          exists: false,
          error: e instanceof Error ? e.message : 'Unknown error',
        };
      }

      // Check weather_data table
      try {
        const { data, error, count } = await supabase
          .from('weather_data')
          .select('*', { count: 'exact' })
          .eq('date', today);
        
        info.tables.weather_data = {
          exists: !error,
          error: error?.message,
          count: count || 0,
          todayData: data,
        };
      } catch (e) {
        info.tables.weather_data = {
          exists: false,
          error: e instanceof Error ? e.message : 'Unknown error',
        };
      }

      // Check tide_data table
      try {
        const { data, error, count } = await supabase
          .from('tide_data')
          .select('*', { count: 'exact' })
          .eq('date', today);
        
        info.tables.tide_data = {
          exists: !error,
          error: error?.message,
          count: count || 0,
          todayData: data,
        };
      } catch (e) {
        info.tables.tide_data = {
          exists: false,
          error: e instanceof Error ? e.message : 'Unknown error',
        };
      }

      // Check surf_reports table
      try {
        const { data, error, count } = await supabase
          .from('surf_reports')
          .select('*', { count: 'exact' })
          .eq('date', today);
        
        info.tables.surf_reports = {
          exists: !error,
          error: error?.message,
          count: count || 0,
          todayData: data,
        };
      } catch (e) {
        info.tables.surf_reports = {
          exists: false,
          error: e instanceof Error ? e.message : 'Unknown error',
        };
      }

      setDebugInfo(info);
    } catch (error) {
      console.error('Diagnostics error:', error);
      info.errors.push(error instanceof Error ? error.message : 'Unknown error');
      setDebugInfo(info);
    } finally {
      setLoading(false);
    }
  };

  const testEdgeFunction = async (functionName: string) => {
    setTestingFunction(functionName);
    try {
      console.log(`Testing ${functionName}...`);
      const response = await supabase.functions.invoke(functionName);
      
      console.log(`${functionName} response:`, response);
      
      const result = {
        success: !response.error && response.data?.success !== false,
        error: response.error?.message || (response.data?.success === false ? response.data.error : null),
        response: response.data,
        status: (response as any).status,
      };

      setDebugInfo((prev: any) => ({
        ...prev,
        edgeFunctions: {
          ...prev.edgeFunctions,
          [functionName]: result,
        },
      }));

      if (result.success) {
        Alert.alert('Success', `${functionName} executed successfully`);
      } else {
        Alert.alert('Error', `${functionName} failed: ${result.error || 'Unknown error'}`);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      console.error(`${functionName} error:`, e);
      
      setDebugInfo((prev: any) => ({
        ...prev,
        edgeFunctions: {
          ...prev.edgeFunctions,
          [functionName]: {
            success: false,
            error: errorMsg,
          },
        },
      }));

      Alert.alert('Error', `${functionName} failed: ${errorMsg}`);
    } finally {
      setTestingFunction(null);
    }
  };

  const testUpdateAllData = async () => {
    setTestingFunction('update-all-surf-data');
    try {
      console.log('Testing update-all-surf-data...');
      const response = await supabase.functions.invoke('update-all-surf-data');
      
      console.log('update-all-surf-data response:', response);
      
      const result = {
        success: !response.error && response.data?.success !== false,
        error: response.error?.message || (response.data?.success === false ? response.data.error : null),
        response: response.data,
        status: (response as any).status,
      };

      setDebugInfo((prev: any) => ({
        ...prev,
        edgeFunctions: {
          ...prev.edgeFunctions,
          'update-all-surf-data': result,
        },
      }));

      if (result.success) {
        Alert.alert('Success', 'All surf data updated successfully. Refreshing diagnostics...');
        // Refresh diagnostics after successful update
        setTimeout(() => runDiagnostics(), 2000);
      } else {
        Alert.alert('Error', `Update failed: ${result.error || 'Unknown error'}\n\nCheck the response details below.`);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      console.error('update-all-surf-data error:', e);
      
      setDebugInfo((prev: any) => ({
        ...prev,
        edgeFunctions: {
          ...prev.edgeFunctions,
          'update-all-surf-data': {
            success: false,
            error: errorMsg,
          },
        },
      }));

      Alert.alert('Error', `Update failed: ${errorMsg}`);
    } finally {
      setTestingFunction(null);
    }
  };

  useEffect(() => {
    if (profile?.is_admin) {
      runDiagnostics();
    }
  }, [profile]);

  if (!profile?.is_admin) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="lock.fill"
            android_material_icon_name="lock"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            Admin access required
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow_back"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Debug Diagnostics
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: colors.accent, flex: 1 }]}
            onPress={runDiagnostics}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <React.Fragment>
                <IconSymbol
                  ios_icon_name="arrow.clockwise"
                  android_material_icon_name="refresh"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>Refresh</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: colors.primary, flex: 1 }]}
            onPress={testUpdateAllData}
            disabled={testingFunction !== null}
          >
            {testingFunction === 'update-all-surf-data' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <React.Fragment>
                <IconSymbol
                  ios_icon_name="arrow.down.circle.fill"
                  android_material_icon_name="download"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>Update All</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>
        </View>

        {debugInfo && (
          <React.Fragment>
            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                System Info
              </Text>
              <Text style={[styles.debugText, { color: colors.textSecondary }]}>
                Timestamp: {debugInfo.timestamp}
              </Text>
              <Text style={[styles.debugText, { color: colors.textSecondary }]}>
                EST Date: {debugInfo.estDate}
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Database Tables
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                If surf_conditions is missing, run the SQL in docs/CREATE_SURF_CONDITIONS_TABLE.sql
              </Text>
              {Object.entries(debugInfo.tables).map(([tableName, tableInfo]: [string, any]) => (
                <View key={tableName} style={styles.tableInfo}>
                  <Text style={[styles.tableName, { color: theme.colors.text }]}>
                    {tableName}
                  </Text>
                  <Text style={[styles.debugText, { color: tableInfo.exists ? colors.success : colors.error }]}>
                    {tableInfo.exists ? '✓ Exists' : '✗ Missing/Error'}
                  </Text>
                  {tableInfo.error && (
                    <Text style={[styles.errorText, { color: colors.error }]}>
                      Error: {tableInfo.error}
                    </Text>
                  )}
                  <Text style={[styles.debugText, { color: colors.textSecondary }]}>
                    Records today: {tableInfo.count || 0}
                  </Text>
                  {tableInfo.todayData && tableInfo.todayData.length > 0 && (
                    <Text style={[styles.debugText, { color: colors.textSecondary, fontSize: 10 }]}>
                      {JSON.stringify(tableInfo.todayData[0], null, 2)}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Edge Functions
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Test individual functions to see detailed error messages
              </Text>
              
              <View style={styles.functionButtons}>
                <TouchableOpacity
                  style={[styles.functionButton, { backgroundColor: colors.accent }]}
                  onPress={() => testEdgeFunction('fetch-weather-data')}
                  disabled={testingFunction !== null}
                >
                  {testingFunction === 'fetch-weather-data' ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.functionButtonText}>Test Weather</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.functionButton, { backgroundColor: colors.accent }]}
                  onPress={() => testEdgeFunction('fetch-tide-data')}
                  disabled={testingFunction !== null}
                >
                  {testingFunction === 'fetch-tide-data' ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.functionButtonText}>Test Tide</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.functionButton, { backgroundColor: colors.accent }]}
                  onPress={() => testEdgeFunction('fetch-surf-reports')}
                  disabled={testingFunction !== null}
                >
                  {testingFunction === 'fetch-surf-reports' ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.functionButtonText}>Test Surf</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.functionButton, { backgroundColor: colors.accent }]}
                  onPress={() => testEdgeFunction('generate-daily-report')}
                  disabled={testingFunction !== null}
                >
                  {testingFunction === 'generate-daily-report' ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.functionButtonText}>Test Report</Text>
                  )}
                </TouchableOpacity>
              </View>

              {Object.entries(debugInfo.edgeFunctions).map(([funcName, funcInfo]: [string, any]) => (
                <View key={funcName} style={styles.tableInfo}>
                  <Text style={[styles.tableName, { color: theme.colors.text }]}>
                    {funcName}
                  </Text>
                  <Text style={[styles.debugText, { color: funcInfo.success ? colors.success : colors.error }]}>
                    {funcInfo.success ? '✓ Success' : '✗ Failed'}
                  </Text>
                  {funcInfo.status && (
                    <Text style={[styles.debugText, { color: colors.textSecondary }]}>
                      HTTP Status: {funcInfo.status}
                    </Text>
                  )}
                  {funcInfo.error && (
                    <Text style={[styles.errorText, { color: colors.error }]}>
                      Error: {funcInfo.error}
                    </Text>
                  )}
                  {funcInfo.response && (
                    <Text style={[styles.debugText, { color: colors.textSecondary, fontSize: 10 }]}>
                      {JSON.stringify(funcInfo.response, null, 2)}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            {debugInfo.errors.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.errorBackground }]}>
                <Text style={[styles.cardTitle, { color: '#FFFFFF' }]}>
                  Errors
                </Text>
                {debugInfo.errors.map((error: string, index: number) => (
                  <Text key={index} style={[styles.errorText, { color: '#FFFFFF' }]}>
                    {error}
                  </Text>
                ))}
              </View>
            )}

            <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Troubleshooting Tips
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                - If surf_conditions table is missing, run the SQL in docs/CREATE_SURF_CONDITIONS_TABLE.sql
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                - If functions fail, check Supabase Edge Function logs
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                - NOAA APIs may be temporarily unavailable
              </Text>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                - Redeploy edge functions after code changes
              </Text>
            </View>
          </React.Fragment>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  functionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  functionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  functionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tableInfo: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tableName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  infoText: {
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
});
