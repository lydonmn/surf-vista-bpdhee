
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

  // Parse text to handle markdown-style bold (**text**)
  const parseTextWithBold = (inputText: string) => {
    const parts: Array<{ text: string; bold: boolean }> = [];
    const regex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(inputText)) !== null) {
      // Add text before the bold part
      if (match.index > lastIndex) {
        parts.push({
          text: inputText.substring(lastIndex, match.index),
          bold: false,
        });
      }
      // Add the bold part
      parts.push({
        text: match[1],
        bold: true,
      });
      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < inputText.length) {
      parts.push({
        text: inputText.substring(lastIndex),
        bold: false,
      });
    }

    return parts.length > 0 ? parts : [{ text: inputText, bold: false }];
  };

  // Split text into sentences for better readability
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  return (
    <View style={styles.container}>
      {sentences.map((sentence, index) => {
        const parts = parseTextWithBold(sentence.trim());
        return (
          <Text
            key={index}
            style={[
              styles.sentence,
              { color: theme.colors.text },
              isCustom && styles.customSentence
            ]}
          >
            {parts.map((part, partIndex) => (
              <Text
                key={partIndex}
                style={part.bold ? styles.boldText : undefined}
              >
                {part.text}
              </Text>
            ))}
          </Text>
        );
      })}
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
  boldText: {
    fontWeight: '700',
  },
});
