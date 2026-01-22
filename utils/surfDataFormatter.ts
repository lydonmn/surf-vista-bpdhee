
/**
 * Utility functions for formatting surf data
 */

/**
 * Convert meters to feet
 * @param meters - Height in meters
 * @returns Height in feet
 */
export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

/**
 * Parse surf height string and convert to feet
 * Handles formats like "1.5m", "1.5 m", "1.5 meters", or just "1.5"
 * @param heightStr - Height string (e.g., "1.5m" or "1.5")
 * @returns Formatted height in feet (e.g., "4.9 ft")
 */
export function parseSurfHeightToFeet(heightStr: string | null | undefined): string {
  if (!heightStr) return 'N/A';
  
  // Remove any non-numeric characters except decimal point and negative sign
  const numericStr = heightStr.replace(/[^\d.-]/g, '');
  const meters = parseFloat(numericStr);
  
  if (isNaN(meters)) return heightStr; // Return original if can't parse
  
  const feet = metersToFeet(meters);
  return `${feet.toFixed(1)} ft`;
}

/**
 * Format water temperature
 * Handles formats like "20°C", "20 C", "68°F", or just "20"
 * @param tempStr - Temperature string
 * @returns Formatted temperature (e.g., "68°F")
 */
export function formatWaterTemp(tempStr: string | null | undefined): string {
  if (!tempStr) return 'N/A';
  
  // Check if already in Fahrenheit
  if (tempStr.includes('°F') || tempStr.includes('F')) {
    return tempStr;
  }
  
  // If in Celsius, convert to Fahrenheit
  if (tempStr.includes('°C') || tempStr.includes('C')) {
    const numericStr = tempStr.replace(/[^\d.-]/g, '');
    const celsius = parseFloat(numericStr);
    if (!isNaN(celsius)) {
      const fahrenheit = (celsius * 9/5) + 32;
      return `${Math.round(fahrenheit)}°F`;
    }
  }
  
  // If just a number, assume it's Fahrenheit
  const temp = parseFloat(tempStr);
  if (!isNaN(temp)) {
    return `${Math.round(temp)}°F`;
  }
  
  return tempStr;
}

/**
 * Format timestamp for display
 * @param timestamp - ISO timestamp string or Date object
 * @returns Formatted time string (e.g., "Updated 2:30 PM")
 */
export function formatLastUpdated(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return 'Never';
  
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  if (isNaN(date.getTime())) return 'Never';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
