
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useEffect, useState } from 'react';

/**
 * 🚨 CRITICAL FIX: Simplified root index with immediate redirect
 * No waiting, no complex logic - just redirect to tabs immediately
 */
export default function Index() {
  console.log('[Index] ===== ROOT INDEX SCREEN RENDERING =====');
  
  // 🚨 FIX: Redirect immediately without any delays
  // The tabs layout and contexts will handle their own initialization
  console.log('[Index] Redirecting to /(tabs) immediately');
  return <Redirect href="/(tabs)" />;
}
