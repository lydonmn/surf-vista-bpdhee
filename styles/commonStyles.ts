
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

export const colors = {
  background: '#F0F8FF',        // AliceBlue - a light, airy blue
  text: '#2F4F4F',              // DarkSlateGray - a deep, sophisticated gray
  textSecondary: '#696969',     // DimGray - a muted gray for less important text
  primary: '#4682B4',           // SteelBlue - a classic, reliable blue
  secondary: '#B0C4DE',         // LightSteelBlue - a softer shade of blue for accents
  accent: '#FFA07A',            // LightSalmon - a warm, inviting coral
  card: '#FFFFFF',              // White - clean and crisp for content cards
  highlight: '#ADD8E6',         // LightBlue - a subtle highlight color
  
  // Enhanced colors for report readability
  reportBackground: '#E8F4F8',  // Very light blue-gray for report text background
  reportText: '#1A3A4A',        // Darker blue-gray for better contrast
  reportBoldText: '#0D2838',    // Even darker for bold text emphasis
  errorBackground: '#FF6B6B',   // Bright red for errors
};

export const buttonStyles = StyleSheet.create({
  instructionsButton: {
    backgroundColor: colors.primary,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    backgroundColor: colors.secondary,
    alignSelf: 'center',
    width: '100%',
  },
});

export const commonStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 800,
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
    marginBottom: 10
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
    lineHeight: 24,
    textAlign: 'center',
  },
  section: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.secondary,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
    width: '100%',
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  icon: {
    width: 60,
    height: 60,
    tintColor: colors.primary,
  },
});
