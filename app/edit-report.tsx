
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/app/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Database } from '@/app/integrations/supabase/types';
import { ReportTextDisplay } from '@/components/ReportTextDisplay';

type SurfReport = Database['public']['Tables']['surf_reports']['Row'];

export default function EditReportScreen() {
  const theme = useTheme();
  const { profile, user } = useAuth();
  const params = useLocalSearchParams();
  const reportId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<SurfReport | null>(null);
  const [reportText, setReportText] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('surf_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) {
        console.error('Error loading report:', error);
        Alert.alert('Error', 'Failed to load report');
        router.back();
        return;
      }

      setReport(data);
      setReportText(data.report_text || data.conditions || '');
    } catch (error) {
      console.error('Exception loading report:', error);
      Alert.alert('Error', 'Failed to load report');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleSave = async () => {
    if (!report || !user) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('surf_reports')
        .update({
          report_text: reportText,
          edited_by: user.id,
          edited_at: new Date().toISOString(),
        })
        .eq('id', report.id);

      if (error) {
        console.error('Error saving report:', error);
        Alert.alert('Error', 'Failed to save report');
        return;
      }

      Alert.alert('Success', 'Report updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Exception saving report:', error);
      Alert.alert('Error', 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToAuto = async () => {
    if (!report || !user) return;

    Alert.alert(
      'Reset to Auto-Generated',
      'This will remove your custom text and use the auto-generated report. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);

              const { error } = await supabase
                .from('surf_reports')
                .update({
                  report_text: null,
                  edited_by: null,
                  edited_at: null,
                })
                .eq('id', report.id);

              if (error) {
                console.error('Error resetting report:', error);
                Alert.alert('Error', 'Failed to reset report');
                return;
              }

              Alert.alert('Success', 'Report reset to auto-generated text!', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error) {
              console.error('Exception resetting report:', error);
              Alert.alert('Error', 'Failed to reset report');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

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

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading report...
          </Text>
        </View>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            Report not found
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
          <View style={styles.headerTextContainer}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Edit Surf Report
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {new Date(report.date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            Report Data
          </Text>
          <View style={styles.dataGrid}>
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>
                Wave Height:
              </Text>
              <Text style={[styles.dataValue, { color: theme.colors.text }]}>
                {report.wave_height}
              </Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>
                Wave Period:
              </Text>
              <Text style={[styles.dataValue, { color: theme.colors.text }]}>
                {report.wave_period || 'N/A'}
              </Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>
                Wind:
              </Text>
              <Text style={[styles.dataValue, { color: theme.colors.text }]}>
                {report.wind_speed} {report.wind_direction}
              </Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>
                Water Temp:
              </Text>
              <Text style={[styles.dataValue, { color: theme.colors.text }]}>
                {report.water_temp}
              </Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>
                Rating:
              </Text>
              <Text style={[styles.dataValue, { color: theme.colors.text }]}>
                {report.rating || 5}/10
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <View style={styles.editorHeader}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Report Text
            </Text>
            <View style={styles.editorActions}>
              {report.report_text && (
                <View style={[styles.editedBadge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.editedBadgeText}>Edited</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.previewButton, showPreview && { backgroundColor: colors.primary }]}
                onPress={() => setShowPreview(!showPreview)}
              >
                <IconSymbol
                  ios_icon_name={showPreview ? "pencil" : "eye"}
                  android_material_icon_name={showPreview ? "edit" : "visibility"}
                  size={16}
                  color={showPreview ? "#FFFFFF" : colors.primary}
                />
                <Text style={[
                  styles.previewButtonText,
                  { color: showPreview ? "#FFFFFF" : colors.primary }
                ]}>
                  {showPreview ? 'Edit' : 'Preview'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            Write a detailed description of the surf conditions. Include wave quality, 
            swell direction, wind conditions, and recommendations for surfers.
          </Text>

          {showPreview ? (
            <View style={[styles.previewContainer, { backgroundColor: theme.colors.background }]}>
              <ReportTextDisplay text={reportText || 'No text entered yet...'} isCustom={true} />
            </View>
          ) : (
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  borderColor: colors.textSecondary,
                }
              ]}
              value={reportText}
              onChangeText={setReportText}
              multiline
              numberOfLines={10}
              placeholder="Enter detailed surf report..."
              placeholderTextColor={colors.textSecondary}
              textAlignVertical="top"
            />
          )}

          <View style={styles.characterCount}>
            <Text style={[styles.characterCountText, { color: colors.textSecondary }]}>
              {reportText.length} characters
            </Text>
          </View>
        </View>

        {report.conditions && (
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Auto-Generated Text
            </Text>
            <Text style={[styles.autoGeneratedText, { color: colors.textSecondary }]}>
              {report.conditions}
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: colors.primary },
              saving && styles.buttonDisabled
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <React.Fragment>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check_circle"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>Save Changes</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>

          {report.report_text && (
            <TouchableOpacity
              style={[
                styles.resetButton,
                { backgroundColor: colors.textSecondary },
                saving && styles.buttonDisabled
              ]}
              onPress={handleResetToAuto}
              disabled={saving}
            >
              <IconSymbol
                ios_icon_name="arrow.counterclockwise"
                android_material_icon_name="refresh"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.buttonText}>Reset to Auto-Generated</Text>
            </TouchableOpacity>
          )}
        </View>
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
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
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
  dataGrid: {
    gap: 12,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  dataLabel: {
    fontSize: 14,
  },
  dataValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  editedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  previewButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 200,
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 200,
    lineHeight: 24,
  },
  characterCount: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  characterCountText: {
    fontSize: 12,
  },
  autoGeneratedText: {
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  buttonContainer: {
    gap: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
