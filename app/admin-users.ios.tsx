
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from './integrations/supabase/client';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';

interface RegionalAdmin {
  id: string;
  email: string;
  is_regional_admin: boolean;
  managed_locations: string[];
  created_at: string;
  created_by: string | null;
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { locations } = useLocation();
  const [regionalAdmins, setRegionalAdmins] = useState<RegionalAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  
  // Form state
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

  const loadRegionalAdmins = useCallback(async () => {
    try {
      console.log('[AdminUsersScreen] Loading regional admins...');
      setIsLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, is_regional_admin, managed_locations, created_at, created_by')
        .eq('is_regional_admin', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[AdminUsersScreen] Error loading regional admins:', error);
        showErrorModal('Error', `Failed to load regional admins: ${error.message}`);
        return;
      }

      console.log('[AdminUsersScreen] Loaded', data?.length || 0, 'regional admins');
      setRegionalAdmins(data || []);
    } catch (error) {
      console.error('[AdminUsersScreen] Exception loading regional admins:', error);
      showErrorModal('Error', 'Failed to load regional admins');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile && !profile.is_admin) {
      console.log('[AdminUsersScreen] User is not admin, redirecting...');
      showErrorModal('Access Denied', 'You do not have admin privileges');
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        }
      }, 100);
      return;
    }

    loadRegionalAdmins();
  }, [profile, loadRegionalAdmins, router]);

  const showErrorModal = (title: string, message: string) => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
    setConfirmAction(null);
  };

  const toggleLocationSelection = (locationId: string) => {
    setSelectedLocations(prev => {
      if (prev.includes(locationId)) {
        return prev.filter(id => id !== locationId);
      } else {
        return [...prev, locationId];
      }
    });
  };

  const resetForm = () => {
    setNewAdminEmail('');
    setNewAdminPassword('');
    setSelectedLocations([]);
  };

  const handleCreateRegionalAdmin = async () => {
    if (!newAdminEmail.trim() || !newAdminPassword.trim()) {
      showErrorModal('Missing Information', 'Please enter both email and password');
      return;
    }

    if (selectedLocations.length === 0) {
      showErrorModal('Missing Information', 'Please select at least one location for this regional admin');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newAdminEmail.trim())) {
      showErrorModal('Invalid Email', 'Please enter a valid email address');
      return;
    }

    // Validate password strength
    if (newAdminPassword.length < 8) {
      showErrorModal('Weak Password', 'Password must be at least 8 characters long');
      return;
    }

    try {
      console.log('[AdminUsersScreen] Creating regional admin:', newAdminEmail);
      setIsSaving(true);

      // Create the user account via Supabase Auth Admin API
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newAdminEmail.trim(),
        password: newAdminPassword,
        email_confirm: true, // Auto-confirm email
      });

      if (authError) {
        console.error('[AdminUsersScreen] Error creating auth user:', authError);
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      console.log('[AdminUsersScreen] Auth user created:', authData.user.id);

      // Update the profile to set regional admin status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_regional_admin: true,
          managed_locations: selectedLocations,
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('[AdminUsersScreen] Error updating profile:', profileError);
        throw new Error(profileError.message);
      }

      console.log('[AdminUsersScreen] ✅ Regional admin created successfully');

      const locationNames = selectedLocations
        .map(id => locations.find(loc => loc.id === id)?.displayName || id)
        .join(', ');

      showErrorModal(
        'Success!',
        `Regional admin created successfully!\n\nEmail: ${newAdminEmail}\nLocations: ${locationNames}\n\nThey can now log in with the password you set.`
      );

      resetForm();
      setModalVisible(false);
      await loadRegionalAdmins();
    } catch (error) {
      console.error('[AdminUsersScreen] Error creating regional admin:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showErrorModal('Error', `Failed to create regional admin: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRegionalAdmin = async (adminId: string, adminEmail: string) => {
    try {
      console.log('[AdminUsersScreen] Deleting regional admin:', adminEmail);

      // Update profile to remove regional admin status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_regional_admin: false,
          managed_locations: [],
        })
        .eq('id', adminId);

      if (profileError) {
        console.error('[AdminUsersScreen] Error updating profile:', profileError);
        throw new Error(profileError.message);
      }

      console.log('[AdminUsersScreen] ✅ Regional admin removed successfully');
      showErrorModal('Success', `Regional admin access removed for ${adminEmail}`);
      await loadRegionalAdmins();
    } catch (error) {
      console.error('[AdminUsersScreen] Error deleting regional admin:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showErrorModal('Error', `Failed to remove regional admin: ${errorMsg}`);
    }
  };

  const confirmDelete = (adminId: string, adminEmail: string) => {
    setErrorModalTitle('Confirm Removal');
    setErrorModalMessage(`Are you sure you want to remove regional admin access for ${adminEmail}?\n\nThey will still have their user account but will no longer have admin privileges.`);
    setConfirmAction(() => () => handleDeleteRegionalAdmin(adminId, adminEmail));
    setErrorModalVisible(true);
  };

  const handleModalAction = () => {
    if (confirmAction) {
      confirmAction();
      setConfirmAction(null);
    }
    setErrorModalVisible(false);
  };

  const handleGoBack = () => {
    console.log('[AdminUsersScreen] Navigating back...');
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/admin');
    }
  };

  if (!profile?.is_admin) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Checking permissions...</Text>
        </View>
      </View>
    );
  }

  const backIconName = 'chevron.left';
  const backMaterialIconName = 'chevron-left';
  const backButtonText = 'Back';
  const headerTitleText = 'Manage Regional Admins';
  const addButtonText = 'Add Regional Admin';
  const sectionTitleText = 'Regional Admins';
  const emptyStateText = 'No regional admins yet';
  const emptyStateSubtext = 'Add regional admins to help manage specific locations';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <IconSymbol
            ios_icon_name={backIconName}
            android_material_icon_name={backMaterialIconName}
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.backButtonText, { color: colors.primary }]}>
            {backButtonText}
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitleText}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add_circle"
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.addButtonText}>{addButtonText}</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{sectionTitleText}</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : regionalAdmins.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="person.2"
                android_material_icon_name="group"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyStateText}>{emptyStateText}</Text>
              <Text style={styles.emptyStateSubtext}>{emptyStateSubtext}</Text>
            </View>
          ) : (
            <>
              {regionalAdmins.map((admin) => {
                const locationNames = admin.managed_locations
                  .map(id => locations.find(loc => loc.id === id)?.displayName || id)
                  .join(', ');
                const createdDate = new Date(admin.created_at).toLocaleDateString();

                return (
                  <View style={styles.adminCard} key={admin.id}>
                    <View style={styles.adminHeader}>
                      <View style={styles.adminInfo}>
                        <Text style={styles.adminEmail}>{admin.email}</Text>
                        <Text style={styles.adminLocations}>
                          Locations: {locationNames || 'None'}
                        </Text>
                        <Text style={styles.adminDate}>Created: {createdDate}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => confirmDelete(admin.id, admin.email)}
                      >
                        <IconSymbol
                          ios_icon_name="trash.fill"
                          android_material_icon_name="delete"
                          size={20}
                          color="#FF3B30"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>

      {/* Add Regional Admin Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => !isSaving && setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Regional Admin</Text>
              <TouchableOpacity
                onPress={() => {
                  if (!isSaving) {
                    resetForm();
                    setModalVisible(false);
                  }
                }}
                disabled={isSaving}
              >
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={28}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="admin@example.com"
                placeholderTextColor={colors.textSecondary}
                value={newAdminEmail}
                onChangeText={setNewAdminEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSaving}
              />

              <Text style={styles.label}>Initial Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Minimum 8 characters"
                placeholderTextColor={colors.textSecondary}
                value={newAdminPassword}
                onChangeText={setNewAdminPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSaving}
              />

              <Text style={styles.label}>Managed Locations</Text>
              <Text style={styles.helperText}>
                Select which locations this admin can manage
              </Text>

              <View style={styles.locationCheckboxes}>
                {locations.map((location) => {
                  const isSelected = selectedLocations.includes(location.id);
                  return (
                    <TouchableOpacity
                      key={location.id}
                      style={[
                        styles.locationCheckbox,
                        isSelected && styles.locationCheckboxSelected,
                      ]}
                      onPress={() => toggleLocationSelection(location.id)}
                      disabled={isSaving}
                    >
                      <View style={[
                        styles.checkbox,
                        isSelected && styles.checkboxSelected,
                      ]}>
                        {isSelected && (
                          <IconSymbol
                            ios_icon_name="checkmark"
                            android_material_icon_name="check"
                            size={16}
                            color="#FFFFFF"
                          />
                        )}
                      </View>
                      <Text style={[
                        styles.locationCheckboxText,
                        isSelected && styles.locationCheckboxTextSelected,
                      ]}>
                        {location.displayName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  if (!isSaving) {
                    resetForm();
                    setModalVisible(false);
                  }
                }}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  isSaving && styles.buttonDisabled,
                ]}
                onPress={handleCreateRegionalAdmin}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Create Admin</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Error/Success/Confirm Modal */}
      <Modal
        visible={errorModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.errorModalOverlay}>
          <View style={styles.errorModalContent}>
            <Text style={styles.errorModalTitle}>{errorModalTitle}</Text>
            <ScrollView style={styles.errorModalScroll}>
              <Text style={styles.errorModalMessage}>{errorModalMessage}</Text>
            </ScrollView>
            <View style={styles.errorModalActions}>
              {confirmAction ? (
                <>
                  <TouchableOpacity
                    style={[styles.errorModalButton, styles.errorModalCancelButton]}
                    onPress={() => {
                      setConfirmAction(null);
                      setErrorModalVisible(false);
                    }}
                  >
                    <Text style={styles.errorModalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.errorModalButton, styles.errorModalConfirmButton]}
                    onPress={handleModalAction}
                  >
                    <Text style={styles.errorModalButtonText}>Confirm</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.errorModalButton}
                  onPress={() => setErrorModalVisible(false)}
                >
                  <Text style={styles.errorModalButtonText}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingRight: 8,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerSpacer: {
    width: 70,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    marginLeft: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  adminCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  adminHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  adminInfo: {
    flex: 1,
    gap: 6,
  },
  adminEmail: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  adminLocations: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  adminDate: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  deleteButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalScroll: {
    maxHeight: 400,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 8,
  },
  helperText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  locationCheckboxes: {
    gap: 10,
    marginTop: 8,
  },
  locationCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  locationCheckboxSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  locationCheckboxText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  locationCheckboxTextSelected: {
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorModalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  errorModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  errorModalScroll: {
    maxHeight: 300,
    marginBottom: 20,
  },
  errorModalMessage: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  errorModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  errorModalButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorModalCancelButton: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  errorModalConfirmButton: {
    backgroundColor: '#FF3B30',
  },
  errorModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorModalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});
