
import { View, Text, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

interface NotificationIntegrationStatusProps {
  isVisible?: boolean;
}

export function NotificationIntegrationStatus({ isVisible = true }: NotificationIntegrationStatusProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconSymbol
          ios_icon_name="link.circle.fill"
          android_material_icon_name="link"
          size={24}
          color={colors.primary}
        />
        <Text style={styles.title}>Push Notification Integration</Text>
      </View>
      
      <View style={styles.statusRow}>
        <IconSymbol
          ios_icon_name="checkmark.circle.fill"
          android_material_icon_name="check-circle"
          size={20}
          color="#34C759"
        />
        <Text style={styles.statusText}>
          6AM reports are linked to push notifications
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>How It Works:</Text>
        <Text style={styles.infoText}>
          1. 4:45 AM EST - Background data collection starts
        </Text>
        <Text style={styles.infoText}>
          2. 6:00 AM EST - Daily reports are generated
        </Text>
        <Text style={styles.infoText}>
          3. Immediately after - Push notifications sent to opted-in users
        </Text>
        <Text style={styles.infoText}>
          4. Users receive notification with wave height, rating, and summary
        </Text>
      </View>

      <View style={styles.noteBox}>
        <IconSymbol
          ios_icon_name="info.circle.fill"
          android_material_icon_name="info"
          size={16}
          color={colors.textSecondary}
        />
        <Text style={styles.noteText}>
          Users can enable notifications in their Profile tab and select which locations they want to receive reports for.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  infoBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 18,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
