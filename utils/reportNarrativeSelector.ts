
import { SurfReport } from '@/types';

/**
 * Shared utility to consistently select the narrative text for display
 * across all screens (home, report, etc.)
 * 
 * PRIORITY ORDER:
 * 1. report_text (admin-edited custom narrative) - ALWAYS prioritized
 * 2. conditions (auto-generated narrative)
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
  const narrativeText = report.report_text || report.conditions || null;
  
  console.log('[reportNarrativeSelector] Selected narrative:', {
    reportId: report.id,
    reportDate: report.date,
    reportLocation: report.location,
    hasReportText: !!report.report_text,
    hasConditions: !!report.conditions,
    reportTextLength: report.report_text?.length || 0,
    conditionsLength: report.conditions?.length || 0,
    selectedSource: report.report_text ? 'report_text (edited)' : report.conditions ? 'conditions (auto)' : 'none',
    narrativeLength: narrativeText?.length || 0
  });

  return narrativeText;
}

/**
 * Check if a report has a valid narrative (at least 50 characters)
 */
export function hasValidNarrative(report: SurfReport | null | undefined): boolean {
  const narrative = selectNarrativeText(report);
  return narrative !== null && narrative.length > 50;
}

/**
 * Determine if the narrative is custom (admin-edited) or auto-generated
 */
export function isCustomNarrative(report: SurfReport | null | undefined): boolean {
  if (!report) return false;
  return !!report.report_text;
}
