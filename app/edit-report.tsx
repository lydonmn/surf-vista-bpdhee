
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/app/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Database } from '@/app/integrations/supabase/types';
import { ReportTextDisplay } from '@/components/ReportTextDisplay';
import { useLocation } from '@/contexts/LocationContext';
import { getESTDate, formatDateString } from '@/utils/surfDataFormatter';

type SurfReport = Database['public']['Tables']['surf_reports']['Row'];

export default function EditReportScreen() {
  const theme = useTheme();
  const { profile, user } = useAuth();
  const { currentLocation, locationData } = useLocation();
  const params = useLocalSearchParams();
  const reportId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<SurfReport | null>(null);
  const [reportText, setReportText] = useState('');
  const [rating, setRating] = useState('5');
  const [showPreview, setShowPreview] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[EditReportScreen] ===== LOADING FRESH REPORT =====');
      console.log('[EditReportScreen] Current location:', currentLocation, locationData.displayName);
      console.log('[EditReportScreen] Today\'s date (EST):', getESTDate());
      
      let reportToEdit: SurfReport | null = null;

      if (reportId) {
        console.log('[EditReportScreen] Loading specific report by ID:', reportId);
        
        const { data, error } = await supabase
          .from('surf_reports')
          .select('*')
          .eq('id', reportId)
          .single();

        if (error) {
          console.error('[EditReportScreen] Error loading report by ID:', error);
        } else {
          console.log('[EditReportScreen] Report loaded by ID:', {
            id: data.id,
            date: data.date,
            location: data.location,
            hasReportText: !!data.report_text,
            hasConditions: !!data.conditions,
          });
          reportToEdit = data;
        }
      }

      if (!reportToEdit) {
        console.log('[EditReportScreen] Loading today\'s report for current location:', currentLocation);
        
        const todayDate = getESTDate();
        const { data, error } = await supabase
          .from('surf_reports')
          .select('*')
          .eq('date', todayDate)
          .eq('location', currentLocation)
          .maybeSingle();

        if (error) {
          console.error('[EditReportScreen] Error loading today\'s report:', error);
          showErrorModal('Error', 'Failed to load report');
          router.back();
          return;
        }

        if (!data) {
          console.log('[EditReportScreen] No report found for today at', locationData.displayName);
          showErrorModal(
            'No Report Found',
            `No surf report exists for today at ${locationData.displayName}. Please generate a report first from the Admin Data screen.`
          );
          return;
        }

        console.log('[EditReportScreen] Today\'s report loaded:', {
          id: data.id,
          date: data.date,
          location: data.location,
          hasReportText: !!data.report_text,
          hasConditions: !!data.conditions,
        });
        reportToEdit = data;
      }

      if (reportToEdit.location !== currentLocation) {
        console.warn('[EditReportScreen] Report location mismatch:', {
          reportLocation: reportToEdit.location,
          currentLocation: currentLocation,
        });
        showErrorModal(
          'Location Mismatch',
          `This report is for a different location. Switching to today's report for ${locationData.displayName}.`
        );
        
        const todayDate = getESTDate();
        const { data, error } = await supabase
          .from('surf_reports')
          .select('*')
          .eq('date', todayDate)
          .eq('location', currentLocation)
          .maybeSingle();

        if (error || !data) {
          showErrorModal('Error', 'Failed to load report for current location');
          router.back();
          return;
        }

        reportToEdit = data;
      }

      console.log('[EditReportScreen] ===== REPORT LOADED =====');
      console.log('[EditReportScreen] Report ID:', reportToEdit.id);
      console.log('[EditReportScreen] Report date:', reportToEdit.date);
      console.log('[EditReportScreen] Report location:', reportToEdit.location, locationData.displayName);
      console.log('[EditReportScreen] Has report_text (edited):', !!reportToEdit.report_text);
      console.log('[EditReportScreen] Has conditions (auto):', !!reportToEdit.conditions);
      console.log('[EditReportScreen] report_text length:', reportToEdit.report_text?.length || 0);
      console.log('[EditReportScreen] conditions length:', reportToEdit.conditions?.length || 0);

      setReport(reportToEdit);
      
      const textToEdit = reportToEdit.report_text || reportToEdit.conditions || '';
      console.log('[EditReportScreen] Setting text to edit:', {
        length: textToEdit.length,
        source: reportToEdit.report_text ? 'report_text (custom)' : 'conditions (auto-generated)',
        preview: textToEdit.substring(0, 100) + '...'
      });
      setReportText(textToEdit);
      setRating(String(reportToEdit.rating || 5));
    } catch (error) {
      console.error('[EditReportScreen] Exception loading report:', error);
      showErrorModal('Error', 'Failed to load report');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [reportId, currentLocation, locationData.displayName]);

  useFocusEffect(
    useCallback(() => {
      console.log('[EditReportScreen] Screen focused - loading fresh report data');
      loadReport();
    }, [loadReport])
  );

  const showErrorModal = (title: string, message: string) => {
    console.error('[EditReportScreen]', title, ':', message);
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  };

  const handleSave = async () => {
    if (!report || !user) return;

    const ratingNum = parseInt(rating);
    const ratingValue = ratingNum;
    
    if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 10) {
      showErrorModal('Invalid Rating', 'Please enter a rating between 0 and 10');
      return;
    }

    const trimmedText = reportText.trim();
    
    if (!trimmedText) {
      showErrorModal('Empty Report', 'Please enter some text for the surf report');
      return;
    }

    console.log('[EditReportScreen] ===== SAVING REPORT =====');
    console.log('[EditReportScreen] Report ID:', report.id);
    console.log('[EditReportScreen] Report location:', report.location, locationData.displayName);
    console.log('[EditReportScreen] Text length:', trimmedText.length);
    console.log('[EditReportScreen] Rating:', ratingValue);
    console.log('[EditReportScreen] Text preview:', trimmedText.substring(0, 100) + '...');

    try {
      setSaving(true);

      const { data, error } = await supabase
        .from('surf_reports')
        .update({
          report_text: trimmedText,
          rating: ratingValue,
          edited_by: user.id,
          edited_at: new Date().toISOString(),
        })
        .eq('id', report.id)
        .select()
        .single();

      if (error) {
        console.error('[EditReportScreen] Error saving report:', error);
        showErrorModal('Save Failed', error.message || 'Failed to save report');
        return;
      }

      console.log('[EditReportScreen] ===== REPORT SAVED =====');
      console.log('[EditReportScreen] Saved report ID:', data.id);
      console.log('[EditReportScreen] Saved report_text length:', data.report_text?.length || 0);
      console.log('[EditReportScreen] Saved rating:', data.rating);
      console.log('[EditReportScreen] Saved text preview:', data.report_text ? data.report_text.substring(0, 100) + '...' : 'none');

      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: verifyData, error: verifyError } = await supabase
        .from('surf_reports')
        .select('report_text, rating, conditions')
        .eq('id', report.id)
        .single();

      if (verifyError) {
        console.error('[EditReportScreen] Error verifying save:', verifyError);
      } else {
        console.log('[EditReportScreen] ===== VERIFICATION READ =====');
        console.log('[EditReportScreen] report_text length:', verifyData.report_text?.length || 0);
        console.log('[EditReportScreen] conditions length:', verifyData.conditions?.length || 0);
        console.log('[EditReportScreen] rating:', verifyData.rating);
        console.log('[EditReportScreen] Verify text preview:', verifyData.report_text ? verifyData.report_text.substring(0, 100) + '...' : 'none');
      }

      setShowSuccessModal(true);
    } catch (error) {
      console.error('[EditReportScreen] Exception saving report:', error);
      showErrorModal('Error', 'An unexpected error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToAuto = () => {
    setShowResetModal(true);
  };

  const confirmReset = async () => {
    if (!report || !user) return;

    try {
      setSaving(true);
      setShowResetModal(false);

      console.log('[EditReportScreen] ===== RESETTING TO AUTO =====');
      console.log('[EditReportScreen] Report ID:', report.id);
      console.log('[EditReportScreen] Report location:', report.location, locationData.displayName);

      const { error } = await supabase
        .from('surf_reports')
        .update({
          report_text: null,
          rating: null,
          edited_by: null,
          edited_at: null,
        })
        .eq('id', report.id);

      if (error) {
        console.error('[EditReportScreen] Error resetting report:', error);
        showErrorModal('Reset Failed', error.message || 'Failed to reset report');
        return;
      }

      console.log('[EditReportScreen] ✅ Report reset to auto-generated successfully');

      await new Promise(resolve => setTimeout(resolve, 500));

      setShowSuccessModal(true);
    } catch (error) {
      console.error('[EditReportScreen] Exception resetting report:', error);
      showErrorModal('Error', 'An unexpected error occurred while resetting');
    } finally {
      setSaving(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    router.back();
  };

  const getRatingColor = (ratingValue: number): string => {
    if (ratingValue >= 8) return '#22C55E';
    if (ratingValue >= 6) return '#FFC107';
    if (ratingValue >= 4) return '#FF9800';
    return '#F44336';
  };

  const ratingNum = parseInt(rating) || 5;
  const ratingColor = getRatingColor(ratingNum);

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
            Loading latest report for {locationData.displayName}...
          </Text>
        </View>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="warning"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            No report found for today at {locationData.displayName}
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            Please generate a report first from the Admin Data screen.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/admin-data')}
          >
            <Text style={styles.buttonText}>Go to Admin Data</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 🚨 CRITICAL FIX: Use formatDateString utility to ensure correct year display
  const reportDateFormatted = formatDateString(report.date);

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
              android_material_icon_name="chevron-left"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Edit Surf Report
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {reportDateFormatted}
            </Text>
            <Text style={[styles.locationText, { color: colors.primary }]}>
              {locationData.displayName}
            </Text>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.primary + '20' }]}>
          <IconSymbol
            ios_icon_name="info.circle.fill"
            android_material_icon_name="info"
            size={20}
            color={colors.primary}
          />
          <Text style={[styles.infoText, { color: theme.colors.text }]}>
            Your edited narrative will appear on both the home page and report page for {locationData.displayName}.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            Report Data
          </Text>
          <View style={styles.dataGrid}>
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>
                Location:
              </Text>
              <Text style={[styles.dataValue, { color: theme.colors.text }]}>
                {locationData.displayName}
              </Text>
            </View>
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
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <View style={styles.ratingHeader}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Stoke Rating
            </Text>
            <View style={[styles.ratingBadge, { backgroundColor: ratingColor }]}>
              <Text style={styles.ratingBadgeText}>
                {rating}/10
              </Text>
            </View>
          </View>
          
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            Rate the surf conditions from 0 (flat) to 10 (epic). This helps surfers quickly assess if it&apos;s worth paddling out.
          </Text>

          <View style={styles.ratingInputContainer}>
            <TextInput
              style={[
                styles.ratingInput,
                {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  borderColor: ratingColor,
                }
              ]}
              value={rating}
              onChangeText={setRating}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="5"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.ratingScale}>
              <View style={styles.ratingScaleItem}>
                <Text style={[styles.ratingScaleValue, { color: colors.textSecondary }]}>
                  0
                </Text>
                <Text style={[styles.ratingScaleLabel, { color: colors.textSecondary }]}>
                  Flat
                </Text>
              </View>
              <View style={styles.ratingScaleItem}>
                <Text style={[styles.ratingScaleValue, { color: colors.textSecondary }]}>
                  3
                </Text>
                <Text style={[styles.ratingScaleLabel, { color: colors.textSecondary }]}>
                  Small
                </Text>
              </View>
              <View style={styles.ratingScaleItem}>
                <Text style={[styles.ratingScaleValue, { color: colors.textSecondary }]}>
                  5
                </Text>
                <Text style={[styles.ratingScaleLabel, { color: colors.textSecondary }]}>
                  Fair
                </Text>
              </View>
              <View style={styles.ratingScaleItem}>
                <Text style={[styles.ratingScaleValue, { color: colors.textSecondary }]}>
                  7
                </Text>
                <Text style={[styles.ratingScaleLabel, { color: colors.textSecondary }]}>
                  Good
                </Text>
              </View>
              <View style={styles.ratingScaleItem}>
                <Text style={[styles.ratingScaleValue, { color: colors.textSecondary }]}>
                  10
                </Text>
                <Text style={[styles.ratingScaleLabel, { color: colors.textSecondary }]}>
                  Epic
                </Text>
              </View>
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
            Write a detailed description of the surf conditions. This narrative will be displayed on both the home page and report page for {locationData.displayName}.
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
            <View style={styles.autoGeneratedHeader}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Auto-Generated Text
              </Text>
              <Text style={[styles.autoGeneratedNote, { color: colors.textSecondary }]}>
                (Reference only - not displayed if you save custom text)
              </Text>
            </View>
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
                  android_material_icon_name="check-circle"
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

      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleSuccessModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: colors.primary + '20' }]}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={48}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Success!
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Report updated successfully! The updated narrative will now appear on both the home page and report page.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={handleSuccessModalClose}
            >
              <Text style={styles.modalButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showResetModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#FF9800' + '20' }]}>
              <IconSymbol
                ios_icon_name="arrow.counterclockwise"
                android_material_icon_name="refresh"
                size={48}
                color="#FF9800"
              />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Reset to Auto-Generated?
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              This will remove your custom text and rating, and use the auto-generated report. The auto-generated narrative will then appear on both the home page and report page. Continue?
            </Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButtonHalf, { backgroundColor: colors.textSecondary }]}
                onPress={() => setShowResetModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonHalf, { backgroundColor: '#FF9800' }]}
                onPress={confirmReset}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonText}>Reset</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={errorModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: colors.errorBackground }]}>
              <IconSymbol
                ios_icon_name="exclamationmark.triangle.fill"
                android_material_icon_name="warning"
                size={48}
                color="#FFFFFF"
              />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {errorModalTitle}
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              {errorModalMessage}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  ratingBadgeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  ratingInputContainer: {
    gap: 16,
  },
  ratingInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  ratingScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  ratingScaleItem: {
    alignItems: 'center',
    gap: 4,
  },
  ratingScaleValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  ratingScaleLabel: {
    fontSize: 11,
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
  autoGeneratedHeader: {
    marginBottom: 8,
  },
  autoGeneratedNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.2)',
    elevation: 5,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalButtonHalf: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
});
