
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
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

      // Test edge functions
      console.log('Testing fetch-weather-data...');
      try {
        const { data, error } = await supabase.functions.invoke('fetch-weather-data');
        info.edgeFunctions.fetch_weather_data = {
          success: !error,
          error: error?.message,
          response: data,
        };
      } catch (e) {
        info.edgeFunctions.fetch_weather_data = {
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error',
        };
      }

      console.log('Testing fetch-tide-data...');
      try {
        const { data, error } = await supabase.functions.invoke('fetch-tide-data');
        info.edgeFunctions.fetch_tide_data = {
          success: !error,
          error: error?.message,
          response: data,
        };
      } catch (e) {
        info.edgeFunctions.fetch_tide_data = {
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error',
        };
      }

      console.log('Testing fetch-surf-reports...');
      try {
        const { data, error } = await supabase.functions.invoke('fetch-surf-reports');
        info.edgeFunctions.fetch_surf_reports = {
          success: !error,
          error: error?.message,
          response: data,
        };
      } catch (e) {
        info.edgeFunctions.fetch_surf_reports = {
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error',
        };
      }

      console.log('Testing generate-daily-report...');
      try {
        const { data, error } = await supabase.functions.invoke('generate-daily-report');
        info.edgeFunctions.generate_daily_report = {
          success: !error,
          error: error?.message,
          response: data,
        };
      } catch (e) {
        info.edgeFunctions.generate_daily_report = {
          success: false,
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

        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: colors.accent }]}
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
              <Text style={styles.buttonText}>Run Diagnostics</Text>
            </React.Fragment>
          )}
        </TouchableOpacity>

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
              {Object.entries(debugInfo.edgeFunctions).map(([funcName, funcInfo]: [string, any]) => (
                <View key={funcName} style={styles.tableInfo}>
                  <Text style={[styles.tableName, { color: theme.colors.text }]}>
                    {funcName}
                  </Text>
                  <Text style={[styles.debugText, { color: funcInfo.success ? colors.success : colors.error }]}>
                    {funcInfo.success ? '✓ Success' : '✗ Failed'}
                  </Text>
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
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
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
});
