
import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { colors } from '@/styles/commonStyles';

interface ReportTextDisplayProps {
  text: string;
  style?: any;
}

export function ReportTextDisplay({ text, style }: ReportTextDisplayProps) {
  // Split the narrative by double newlines to create paragraphs
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);

  return (
    <View style={[styles.container, style]}>
      {paragraphs.map((paragraph, index) => {
        const trimmedParagraph = paragraph.trim();
        return (
          <Text key={index} style={styles.paragraph}>
            {trimmedParagraph}
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
