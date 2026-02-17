
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
  
  // 🚨 CRITICAL FIX: DO NOT add units to numbers - the backend already includes them
  // The issue was that this function was trying to add "feet" to numbers that were already
  // properly formatted, causing errors like "20 feet°F" instead of "20°F"
  // 
  // The backend narrative generator (generateWittyNarrative) already includes all necessary units:
  // - Wave heights: "2.5 feet to 3.5 feet"
  // - Wind speed: "10 mph"
  // - Period: "12-second period"
  // - Temperature: "68°F"
  //
  // This function should ONLY clean up any erroneous formatting, not add units.
  
  if (narrativeText) {
    // ✅ ONLY clean up erroneous "feet" that appears before degree symbols
    // This is the ONLY formatting fix needed - everything else comes correct from backend
    narrativeText = narrativeText.replace(/\s*feet\s*°/gi, '°');
    narrativeText = narrativeText.replace(/\s*ft\s*°/gi, '°');
    
    // Remove "feet" from parenthetical degree notations like "(20 feet°)"
    narrativeText = narrativeText.replace(/\((\d+)\s*feet\s*°\)/gi, '($1°)');
    narrativeText = narrativeText.replace(/\((\d+)\s*ft\s*°\)/gi, '($1°)');
    
    // Clean up any double spaces that might have been created
    narrativeText = narrativeText.replace(/\s+/g, ' ');
    
    console.log('[reportNarrativeSelector] ✅ Cleaned narrative - removed erroneous "feet" before degree symbols');
    console.log('[reportNarrativeSelector] ✅ NO OTHER FORMATTING APPLIED - backend provides complete text');
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
