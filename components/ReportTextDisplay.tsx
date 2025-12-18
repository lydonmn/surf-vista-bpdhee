
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
    const parts: { text: string; bold: boolean }[] = [];
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

  // Make the report more concise by focusing on key rideability information
  const getCondensedReport = (fullText: string): string => {
    // If it's a custom report (edited by admin), don't condense it
    if (isCustom) {
      return fullText;
    }

    // Extract key sentences about wave rideability
    const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
    
    // Filter to keep only the most relevant sentences about rideability
    const relevantKeywords = [
      'rideable', 'ride', 'surfable', 'surf',
      'wave', 'swell', 'conditions',
      'good', 'fair', 'poor', 'excellent',
      'clean', 'choppy', 'glassy',
      'beginner', 'intermediate', 'advanced',
      'recommend', 'best', 'ideal'
    ];

    const relevantSentences = sentences.filter(sentence => {
      const lowerSentence = sentence.toLowerCase();
      return relevantKeywords.some(keyword => lowerSentence.includes(keyword));
    });

    // If we filtered out too much, keep the first 3 sentences
    if (relevantSentences.length === 0) {
      return sentences.slice(0, 3).join(' ').trim();
    }

    // Return the most relevant sentences (max 4)
    return relevantSentences.slice(0, 4).join(' ').trim();
  };

  const condensedText = getCondensedReport(text);
  const sentences = condensedText.match(/[^.!?]+[.!?]+/g) || [condensedText];

  return (
    <View style={styles.container}>
      {sentences.map((sentence, index) => {
        const parts = parseTextWithBold(sentence.trim());
        // Create a unique key using a combination of index and a hash of the sentence
        const sentenceKey = `sentence-${index}-${sentence.trim().substring(0, 20).replace(/\s/g, '-')}`;
        
        return (
          <Text
            key={sentenceKey}
            style={[
              styles.sentence,
              { color: colors.reportText },
              isCustom && styles.customSentence
            ]}
          >
            {parts.map((part, partIndex) => (
              <Text
                key={`${sentenceKey}-part-${partIndex}`}
                style={[
                  part.bold && styles.boldText,
                  part.bold && { color: colors.reportBoldText }
                ]}
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
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 2,
  },
  customSentence: {
    fontWeight: '500',
  },
  boldText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
