
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { colors } from '@/styles/commonStyles';

interface ReportTextDisplayProps {
  text: string;
  isCustom?: boolean;
}

export function ReportTextDisplay({ text, isCustom = false }: ReportTextDisplayProps) {
  const theme = useTheme();

  // Split text into sentences for better readability
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  return (
    <View style={styles.container}>
      {sentences.map((sentence, index) => (
        <Text
          key={index}
          style={[
            styles.sentence,
            { color: theme.colors.text },
            isCustom && styles.customSentence
          ]}
        >
          {sentence.trim()}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  sentence: {
    fontSize: 14,
    lineHeight: 22,
  },
  customSentence: {
    fontWeight: '500',
  },
});
