
import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { colors } from '@/styles/commonStyles';

interface ReportTextDisplayProps {
  text: string;
  style?: any;
}

export function ReportTextDisplay({ text, style }: ReportTextDisplayProps) {
  // Split the narrative by double newlines to create paragraphs
  // Also handle single newlines and normalize whitespace
  const paragraphs = text
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  console.log('[ReportTextDisplay] Total paragraphs:', paragraphs.length);
  console.log('[ReportTextDisplay] Paragraph lengths:', paragraphs.map(p => p.length));

  return (
    <View style={[styles.container, style]}>
      {paragraphs.map((paragraph, index) => {
        return (
          <Text key={index} style={styles.paragraph}>
            {paragraph}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginBottom: 16,
  },
});
