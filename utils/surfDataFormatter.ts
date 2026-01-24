
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
  
  // Get the date in EST timezone using toLocaleDateString which is more reliable
  const estDateString = now.toLocaleDateString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse the date string (format: "MM/DD/YYYY")
  const [month, day, year] = estDateString.split('/');
  
  const estDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  
  console.log('[getESTDate] Raw EST date string:', estDateString);
  console.log('[getESTDate] Parsed components:', { month, day, year });
  console.log('[getESTDate] Current EST date for Charleston, SC:', estDate);
  
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
 * Format a date string (YYYY-MM-DD) to a readable format in EST timezone
 * This avoids timezone conversion issues by explicitly using EST timezone
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Formatted date string (e.g., "Thursday, January 23, 2026")
 */
export function formatDateString(dateStr: string): string {
  // Extract date components from YYYY-MM-DD format
  const datePart = dateStr.split('T')[0];
  const [year, month, day] = datePart.split('-');
  
  // Create an ISO string at noon EST to avoid any timezone boundary issues
  // Using noon (12:00) ensures we're solidly in the middle of the day
  const isoString = `${year}-${month}-${day}T12:00:00`;
  
  // Format the date in EST timezone
  const formatted = new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York'
  });
  
  console.log('[formatDateString] Input:', dateStr, '→ Output:', formatted);
  
  return formatted;
}

/**
 * Get date N days from now in EST timezone (YYYY-MM-DD format)
 * 
 * @param daysOffset - Number of days to offset (positive for future, negative for past)
 * @returns Date string in YYYY-MM-DD format
 */
export function getESTDateOffset(daysOffset: number): string {
  const now = new Date();
  
  // Get current EST date using toLocaleDateString
  const estDateString = now.toLocaleDateString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse the date string (format: "MM/DD/YYYY")
  const [month, day, year] = estDateString.split('/');
  
  // Create a date object and add days
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  date.setDate(date.getDate() + daysOffset);
  
  const resultYear = date.getFullYear();
  const resultMonth = String(date.getMonth() + 1).padStart(2, '0');
  const resultDay = String(date.getDate()).padStart(2, '0');
  
  return `${resultYear}-${resultMonth}-${resultDay}`;
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
