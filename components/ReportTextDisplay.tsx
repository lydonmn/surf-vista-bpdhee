
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

  // Split text into paragraphs (separated by double newlines)
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);

  return (
    <View style={styles.container}>
      {paragraphs.map((paragraph, paragraphIndex) => {
        const trimmedParagraph = paragraph.trim();
        const parts = parseTextWithBold(trimmedParagraph);
        
        return (
          <View key={`paragraph-${paragraphIndex}`} style={styles.paragraphContainer}>
            <Text
              style={[
                styles.paragraphText,
                { color: colors.reportText },
                isCustom && styles.customText
              ]}
            >
              {parts.map((part, partIndex) => (
                <Text
                  key={`part-${paragraphIndex}-${partIndex}`}
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
    gap: 12,
  },
  paragraphContainer: {
    marginBottom: 4,
  },
  paragraphText: {
    fontSize: 15,
    lineHeight: 24,
  },
  customText: {
    fontWeight: '500',
  },
  boldText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
