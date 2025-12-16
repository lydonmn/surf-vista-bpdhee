
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/styles/commonStyles';

interface SurfVistaLogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function SurfVistaLogo({ size = 'medium', showText = true }: SurfVistaLogoProps) {
  const dimensions = {
    small: { icon: 32, text: 18 },
    medium: { icon: 48, text: 28 },
    large: { icon: 64, text: 36 },
  };

  const { icon, text } = dimensions[size];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primary, colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.iconContainer, { width: icon, height: icon, borderRadius: icon / 2 }]}
      >
        <Text style={[styles.waveIcon, { fontSize: icon * 0.6 }]}>🌊</Text>
      </LinearGradient>
      {showText && (
        <Text style={[styles.logoText, { fontSize: text }]}>SurfVista</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
    elevation: 4,
  },
  waveIcon: {
    textAlign: 'center',
  },
  logoText: {
    fontWeight: 'bold',
    color: colors.primary,
    letterSpacing: 0.5,
  },
});
