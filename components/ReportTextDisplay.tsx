
import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { colors } from '@/styles/commonStyles';

interface ReportTextDisplayProps {
  text: string;
  style?: any;
}

export function ReportTextDisplay({ text, style }: ReportTextDisplayProps) {
  // 🚨 CRITICAL FIX: Handle both literal \n\n and actual newlines
  // The backend inserts \n\n but they might be stored as literal strings
  // We need to handle both cases to ensure paragraph breaks work
  
  // First, normalize the text by replacing literal \n with actual newlines
  const normalizedText = text.replace(/\\n/g, '\n');
  
  // Split by double newlines (actual newlines, not escaped)
  const paragraphs = normalizedText
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  console.log('[ReportTextDisplay] Original text length:', text.length);
  console.log('[ReportTextDisplay] Contains literal \\n\\n:', text.includes('\\n\\n'));
  console.log('[ReportTextDisplay] Contains actual newlines:', text.includes('\n\n'));
  console.log('[ReportTextDisplay] Total paragraphs after split:', paragraphs.length);
  console.log('[ReportTextDisplay] Paragraph lengths:', paragraphs.map(p => p.length));
  
  // If we still only have 1 paragraph, try splitting by sentences as a fallback
  if (paragraphs.length === 1 && paragraphs[0].length > 200) {
    console.log('[ReportTextDisplay] ⚠️ Only 1 paragraph detected, attempting sentence-based splitting...');
    
    // Split into logical sections based on common surf report patterns
    const singleParagraph = paragraphs[0];
    const sections: string[] = [];
    
    // Try to split by common transition phrases
    const transitionPatterns = [
      /\.\s+(?=Waist|Chest|Overhead|Knee|Ankle|Essentially)/,
      /\.\s+(?=Long|Short|Quick|\d+-second)/,
      /\.\s+(?=Light|Calm|Strong|Howling|\d+\s*mph)/,
      /\.\s+(?=Mostly|Partly|Clear|Sunny|Cloudy)/,
      /\.\s+(?=Worth|Get|Drop|Don't|Save|Decent|Small)/,
    ];
    
    let remainingText = singleParagraph;
    let lastSplit = 0;
    
    for (const pattern of transitionPatterns) {
      const match = remainingText.match(pattern);
      if (match && match.index !== undefined) {
        const splitPoint = match.index + match[0].length - match[0].trimStart().length;
        const section = remainingText.substring(0, splitPoint).trim();
        if (section.length > 0) {
          sections.push(section);
        }
        remainingText = remainingText.substring(splitPoint).trim();
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
            <Text key={index} style={styles.paragraph}>
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
