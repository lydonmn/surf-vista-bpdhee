
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/styles/commonStyles';

interface ReportTextDisplayProps {
  text: string;
  isCustom?: boolean;
}

export function ReportTextDisplay({ text, isCustom = false }: ReportTextDisplayProps) {
  const parseTextWithBold = (inputText: string) => {
    const parts: { text: string; bold: boolean }[] = [];
    const regex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(inputText)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          text: inputText.substring(lastIndex, match.index),
          bold: false,
        });
      }
      parts.push({
        text: match[1],
        bold: true,
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < inputText.length) {
      parts.push({
        text: inputText.substring(lastIndex),
        bold: false,
      });
    }

    return parts.length > 0 ? parts : [{ text: inputText, bold: false }];
  };

  const getCondensedReport = (fullText: string): string => {
    if (isCustom) {
      return fullText;
    }

    const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
    
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

    if (relevantSentences.length === 0) {
      return sentences.slice(0, 3).join(' ').trim();
    }

    return relevantSentences.slice(0, 4).join(' ').trim();
  };

  const condensedText = getCondensedReport(text);
  const sentences = condensedText.match(/[^.!?]+[.!?]+/g) || [condensedText];

  return (
    <View style={styles.container}>
      {sentences.map((sentence, sentenceIndex) => {
        const parts = parseTextWithBold(sentence.trim());
        
        return (
          <View key={`sentence-${sentenceIndex}-${sentence.substring(0, 20)}`}>
            <Text
              style={[
                styles.sentence,
                { color: colors.reportText },
                isCustom && styles.customSentence
              ]}
            >
              {parts.map((part, partIndex) => (
                <Text
                  key={`part-${sentenceIndex}-${partIndex}-${part.text.substring(0, 10)}`}
                  style={[
                    part.bold && styles.boldText,
                    part.bold && { color: colors.reportBoldText }
                  ]}
                >
                  {part.text}
                </Text>
              ))}
            </Text>
          </View>
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
