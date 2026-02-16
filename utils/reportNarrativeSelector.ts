
import { SurfReport } from '@/types';

/**
 * Shared utility to consistently select the narrative text for display
 * across all screens (home, report, etc.)
 * 
 * PRIORITY ORDER:
 * 1. report_text (admin-edited custom narrative) - ALWAYS prioritized
 * 2. conditions (auto-generated narrative from 5 AM function)
 * 3. null if neither exists
 * 
 * This ensures identical presentation of narratives across the app.
 * 
 * CRITICAL LOGIC:
 * - If admin has edited the report (report_text exists), use that
 * - Otherwise, use the auto-generated narrative (conditions)
 * - This ensures consistency between home page and report page
 * - ALWAYS ensures units are present in numeric values
 */
export function selectNarrativeText(report: SurfReport | null | undefined): string | null {
  if (!report) {
    console.log('[reportNarrativeSelector] No report provided');
    return null;
  }

  // ALWAYS prioritize report_text (admin-edited) over conditions (auto-generated)
  let narrativeText = report.report_text || report.conditions || null;
  
  console.log('[reportNarrativeSelector] ===== NARRATIVE SELECTION =====');
  console.log('[reportNarrativeSelector] Report ID:', report.id);
  console.log('[reportNarrativeSelector] Report date:', report.date);
  console.log('[reportNarrativeSelector] Report location:', report.location);
  console.log('[reportNarrativeSelector] Has report_text (edited):', !!report.report_text);
  console.log('[reportNarrativeSelector] Has conditions (auto):', !!report.conditions);
  console.log('[reportNarrativeSelector] report_text length:', report.report_text?.length || 0);
  console.log('[reportNarrativeSelector] conditions length:', report.conditions?.length || 0);
  console.log('[reportNarrativeSelector] Selected source:', report.report_text ? 'report_text (EDITED)' : report.conditions ? 'conditions (AUTO)' : 'NONE');
  console.log('[reportNarrativeSelector] Selected narrative length:', narrativeText?.length || 0);
  
  // ✅ CRITICAL FIX: Clean up any erroneous "feet" that appears before degree symbols
  // This fixes the issue where "20°" becomes "20 feet°"
  if (narrativeText) {
    // Remove "feet" that appears right before degree symbols (the main bug)
    narrativeText = narrativeText.replace(/\s*feet\s*°/gi, '°');
    narrativeText = narrativeText.replace(/\s*ft\s*°/gi, '°');
    
    // Remove "feet" from parenthetical degree notations like "(20 feet°)"
    narrativeText = narrativeText.replace(/\((\d+)\s*feet\s*°\)/gi, '($1°)');
    narrativeText = narrativeText.replace(/\((\d+)\s*ft\s*°\)/gi, '($1°)');
    
    // Clean up any double spaces that might have been created
    narrativeText = narrativeText.replace(/\s+/g, ' ');
    
    console.log('[reportNarrativeSelector] ✅ Cleaned narrative - removed erroneous "feet" before degree symbols');
  }
  
  // ✅ CRITICAL FIX: Ensure all numeric values have units (but NOT for degrees!)
  if (narrativeText) {
    // Fix "surf is 2" -> "surf is 2 feet"
    // BUT: Exclude numbers followed by ° (degree symbol) or inside parentheses with °
    narrativeText = narrativeText.replace(/\b(\d+(\.\d+)?)\s*(ft|foot|feet)?\b(?!\s*(ft|foot|feet|mph|seconds|°F|°C|%|°|\)))/gi, (match, num, decimal, unit) => {
      // If unit is already present, keep it
      if (unit) return match;
      
      // Check if this number is part of a degree notation (e.g., "20°" or "(20°)")
      const fullText = narrativeText!;
      const matchIndex = fullText.indexOf(match);
      const afterMatch = fullText.substring(matchIndex + match.length, matchIndex + match.length + 5);
      
      // Skip if followed by degree symbol or closing parenthesis + degree
      if (afterMatch.match(/^\s*°/) || afterMatch.match(/^\s*\)/) || afterMatch.match(/^\s*\)°/)) {
        console.log('[reportNarrativeSelector] Skipping unit addition for degree notation:', match);
        return match;
      }
      
      // Check context to determine appropriate unit
      const beforeMatch = fullText.substring(Math.max(0, matchIndex - 50), matchIndex).toLowerCase();
      
      // Wave/surf height context
      if (beforeMatch.includes('wave') || beforeMatch.includes('surf') || beforeMatch.includes('swell') || 
          beforeMatch.includes('face') || beforeMatch.includes('rideable') || beforeMatch.includes('height')) {
        return `${num} feet`;
      }
      
      // Wind speed context
      if (beforeMatch.includes('wind') || beforeMatch.includes('gust')) {
        return `${num} mph`;
      }
      
      // Period context
      if (beforeMatch.includes('period') || beforeMatch.includes('interval')) {
        return `${num} seconds`;
      }
      
      // Temperature context
      if (beforeMatch.includes('temp') || beforeMatch.includes('water') || beforeMatch.includes('air')) {
        return `${num}°F`;
      }
      
      // Default to feet for surf reports
      return `${num} feet`;
    });
    
    // Additional specific fixes for common patterns
    narrativeText = narrativeText.replace(/rideable faces? at (\d+(\.\d+)?)\b(?!\s*(ft|foot|feet))/gi, 'rideable face at $1 feet');
    narrativeText = narrativeText.replace(/rideable faces? measuring (\d+(\.\d+)?)\b(?!\s*(ft|foot|feet))/gi, 'rideable face measuring $1 feet');
    narrativeText = narrativeText.replace(/rideable wave faces? at (\d+(\.\d+)?)\b(?!\s*(ft|foot|feet))/gi, 'rideable wave face at $1 feet');
    narrativeText = narrativeText.replace(/surf is (\d+(\.\d+)?)\b(?!\s*(ft|foot|feet))/gi, 'surf is $1 feet');
    narrativeText = narrativeText.replace(/waves? at (\d+(\.\d+)?)\b(?!\s*(ft|foot|feet))/gi, 'wave at $1 feet');
    narrativeText = narrativeText.replace(/swell at (\d+(\.\d+)?)\b(?!\s*(ft|foot|feet))/gi, 'swell at $1 feet');
    
    // Final cleanup: Remove any remaining "feet" before degree symbols that might have slipped through
    narrativeText = narrativeText.replace(/\s*feet\s*°/gi, '°');
    narrativeText = narrativeText.replace(/\s*ft\s*°/gi, '°');
    narrativeText = narrativeText.replace(/\((\d+)\s*feet\s*°\)/gi, '($1°)');
    narrativeText = narrativeText.replace(/\((\d+)\s*ft\s*°\)/gi, '($1°)');
    
    // Clean up any double spaces
    narrativeText = narrativeText.replace(/\s+/g, ' ');
  }
  
  console.log('[reportNarrativeSelector] Narrative preview:', narrativeText ? narrativeText.substring(0, 150) + '...' : 'none');
  console.log('[reportNarrativeSelector] =====================================');

  return narrativeText;
}

/**
 * Check if a report has a valid narrative (at least 50 characters)
 */
export function hasValidNarrative(report: SurfReport | null | undefined): boolean {
  const narrative = selectNarrativeText(report);
  const isValid = narrative !== null && narrative.length > 50;
  
  console.log('[reportNarrativeSelector] hasValidNarrative:', isValid, 'length:', narrative?.length || 0);
  
  return isValid;
}

/**
 * Determine if the narrative is custom (admin-edited) or auto-generated
 * 
 * Returns true if the report has been edited by an admin (report_text exists)
 * Returns false if using auto-generated narrative (conditions only)
 */
export function isCustomNarrative(report: SurfReport | null | undefined): boolean {
  if (!report) return false;
  
  const isCustom = !!report.report_text;
  
  console.log('[reportNarrativeSelector] isCustomNarrative:', isCustom, 'for report:', report.id);
  
  return isCustom;
}
