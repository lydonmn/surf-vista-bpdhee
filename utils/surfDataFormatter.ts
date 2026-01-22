
/**
 * Utility functions for formatting surf data and handling dates
 */

/**
 * Get the current date in EST timezone (Charleston, SC) in YYYY-MM-DD format
 * This is the SINGLE SOURCE OF TRUTH for date calculations in the app
 * 
 * IMPORTANT: Always use this function instead of new Date() to ensure
 * consistent date handling across the entire application.
 * 
 * @returns Current date in EST timezone (YYYY-MM-DD format)
 */
export function getESTDate(): string {
  const now = new Date();
  
  // Get the date in EST timezone (America/New_York = Charleston, SC timezone)
  const estDateString = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse the date string (format: "MM/DD/YYYY, HH:MM:SS AM/PM")
  // Split by comma to get just the date part
  const datePart = estDateString.split(',')[0].trim();
  const [month, day, year] = datePart.split('/');
  
  const estDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  
  console.log('[getESTDate] Current EST date for Charleston, SC:', estDate, 'from:', estDateString);
  
  return estDate;
}

/**
 * Get the current date and time in EST timezone
 * Returns a Date object representing the current EST time
 * 
 * @returns Date object in EST timezone
 */
export function getESTDateTime(): Date {
  const now = new Date();
  
  // Get the full date/time string in EST timezone
  const estDateTimeString = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Parse and create a Date object
  const [datePart, timePart] = estDateTimeString.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hour, minute, second] = timePart.split(':');
  
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );
}

/**
 * Parse a date string (YYYY-MM-DD) as a local date, not UTC
 * This prevents timezone-related date shifting issues
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object (local time, not UTC)
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get date N days from now in EST timezone (YYYY-MM-DD format)
 * 
 * @param daysOffset - Number of days to offset (positive for future, negative for past)
 * @returns Date string in YYYY-MM-DD format
 */
export function getESTDateOffset(daysOffset: number): string {
  const now = new Date();
  
  // Get current EST date
  const estDateString = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse the date string
  const datePart = estDateString.split(',')[0].trim();
  const [month, day, year] = datePart.split('/');
  
  // Create a date object and add days
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  date.setDate(date.getDate() + daysOffset);
  
  const resultYear = date.getFullYear();
  const resultMonth = String(date.getMonth() + 1).padStart(2, '0');
  const resultDay = String(date.getDate()).padStart(2, '0');
  
  return `${resultYear}-${resultMonth}-${resultDay}`;
}

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
 * Handles formats like "1.5m", "1.5 m", "1.5 meters", "4.9 ft", or just "1.5"
 * @param heightStr - Height string (e.g., "1.5m", "4.9 ft", or "1.5")
 * @returns Formatted height in feet (e.g., "4.9 ft")
 */
export function parseSurfHeightToFeet(heightStr: string | null | undefined): string {
  console.log('[parseSurfHeightToFeet] Input:', heightStr);
  
  if (!heightStr) {
    console.log('[parseSurfHeightToFeet] No input, returning N/A');
    return 'N/A';
  }
  
  // If it's already in feet format (contains "ft"), return as-is
  if (heightStr.includes('ft') || heightStr.includes('feet')) {
    console.log('[parseSurfHeightToFeet] Already in feet format:', heightStr);
    return heightStr;
  }
  
  // If it says "N/A" or similar, return as-is
  if (heightStr.toUpperCase().includes('N/A') || heightStr.toUpperCase().includes('UNAVAILABLE')) {
    console.log('[parseSurfHeightToFeet] Unavailable data:', heightStr);
    return 'N/A';
  }
  
  // Check if it's in meters (contains "m" but not "mph")
  const isMeters = (heightStr.includes('m') || heightStr.includes('meter')) && !heightStr.includes('mph');
  
  // Remove any non-numeric characters except decimal point and negative sign
  const numericStr = heightStr.replace(/[^\d.-]/g, '');
  const numericValue = parseFloat(numericStr);
  
  if (isNaN(numericValue)) {
    console.log('[parseSurfHeightToFeet] Could not parse numeric value from:', heightStr);
    return heightStr; // Return original if can't parse
  }
  
  if (isMeters) {
    // Convert meters to feet
    const feet = metersToFeet(numericValue);
    const result = `${feet.toFixed(1)} ft`;
    console.log('[parseSurfHeightToFeet] Converted from meters:', numericValue, 'm →', result);
    return result;
  } else {
    // Assume it's already in feet (just a number)
    const result = `${numericValue.toFixed(1)} ft`;
    console.log('[parseSurfHeightToFeet] Assumed feet:', numericValue, '→', result);
    return result;
  }
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
 * Uses EST timezone for consistency with the rest of the app
 * 
 * @param timestamp - ISO timestamp string or Date object
 * @returns Formatted time string (e.g., "2m ago", "3h ago", "Jan 22")
 */
export function formatLastUpdated(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return 'Never';
  
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  if (isNaN(date.getTime())) return 'Never';
  
  // Use EST time for consistency
  const now = getESTDateTime();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
