
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/styles/commonStyles';

interface ReportTextDisplayProps {
  text: string;
}

export function ReportTextDisplay({ text }: ReportTextDisplayProps) {
  // Split text by double newlines to create paragraphs
  const paragraphs = text.split('\n\n').filter(p => p.trim());

  return (
    <View style={styles.container}>
      {paragraphs.map((paragraph, index) => {
        const paragraphText = paragraph.trim();
        return (
          <Text key={index} style={styles.paragraph}>
            {paragraphText}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    marginBottom: 12,
  },
});
