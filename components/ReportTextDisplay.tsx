

import { Text, StyleSheet, View } from 'react-native';
import { colors } from '@/styles/commonStyles';

interface ReportTextDisplayProps {
  text: string;
  style?: any;
  isCustom?: boolean;
  textColor?: string;
}

export function ReportTextDisplay({ text, style, textColor }: ReportTextDisplayProps) {
  // Split by double newlines to create paragraphs
  // The backend now generates narratives with actual \n\n characters
  const paragraphs = text
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  console.log('[ReportTextDisplay] Original text length:', text.length);
  console.log('[ReportTextDisplay] Contains actual newlines:', text.includes('\n\n'));
  console.log('[ReportTextDisplay] Total paragraphs after split:', paragraphs.length);
  console.log('[ReportTextDisplay] Paragraph lengths:', paragraphs.map(p => p.length));
  
  // If we still only have 1 paragraph, try splitting by sentences as a fallback
  if (paragraphs.length === 1 && paragraphs[0].length > 200) {
    console.log('[ReportTextDisplay] ⚠️ Only 1 paragraph detected, attempting sentence-based splitting...');
    
    // Split into logical sections based on common surf report patterns
    const singleParagraph = paragraphs[0];
    const sections: string[] = [];
    
    // 🚨 CRITICAL FIX: Use lookbehind to capture the period with the sentence
    // This prevents periods from being carried to the next paragraph
    const transitionPatterns = [
      /(?<=\.)\s+(?=Waist|Chest|Overhead|Knee|Ankle|Essentially)/,
      /(?<=\.)\s+(?=Long|Short|Quick|\d+-second)/,
      /(?<=\.)\s+(?=Light|Calm|Strong|Howling|\d+\s*mph)/,
      /(?<=\.)\s+(?=Mostly|Partly|Clear|Sunny|Cloudy)/,
      /(?<=\.)\s+(?=Worth|Get|Drop|Don't|Save|Decent|Small)/,
    ];
    
    let remainingText = singleParagraph;
    
    for (const pattern of transitionPatterns) {
      const match = remainingText.match(pattern);
      if (match && match.index !== undefined) {
        // Split at the match position (which is after the period)
        const section = remainingText.substring(0, match.index).trim();
        if (section.length > 0) {
          sections.push(section);
        }
        // Continue with the rest of the text (after the whitespace)
        remainingText = remainingText.substring(match.index + match[0].length).trim();
      }
    }
    
    // Add the remaining text as the last section
    if (remainingText.length > 0) {
      sections.push(remainingText);
    }
    
    if (sections.length > 1) {
      console.log('[ReportTextDisplay] ✅ Split into', sections.length, 'sections using pattern matching');
      console.log('[ReportTextDisplay] Section lengths:', sections.map(s => s.length));
      
      return (
        <View style={[styles.container, style]}>
          {sections.map((section, index) => (
            <Text key={index} style={[styles.paragraph, textColor ? { color: textColor } : undefined]}>
              {section}
            </Text>
          ))}
        </View>
      );
    }
  }

  return (
    <View style={[styles.container, style]}>
      {paragraphs.map((paragraph, index) => {
        return (
          <Text key={index} style={[styles.paragraph, textColor ? { color: textColor } : undefined]}>
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
    color: colors.reportText,
    marginBottom: 16,
  },
});
