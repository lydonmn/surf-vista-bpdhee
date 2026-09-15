
/**
 * Shared surf scoring utilities — single source of truth for the live stoke score.
 */

/**
 * Parse a surf height string to a float.
 * Handles ranges like "2.0-3.0 ft" (returns midpoint), plain numbers, and "N/A".
 */
export function parseSurfHeight(str: string | null | undefined): number {
  if (!str) return 0;
  const s = String(str).trim();
  if (s === 'N/A' || s === 'null' || s === '') return 0;
  if (s.includes('-')) {
    const parts = s.split('-');
    const lo = parseFloat(parts[0].replace(/[^0-9.]/g, ''));
    const hi = parseFloat(parts[1].replace(/[^0-9.]/g, ''));
    return isNaN(lo) || isNaN(hi) ? 0 : (lo + hi) / 2;
  }
  const v = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(v) ? 0 : v;
}

/**
 * Compute a 1–11 stoke score from live surf conditions.
 * This is the SINGLE shared formula used by Home, LiveSurfScene, and Report.
 *
 * @param waveHeight  parsed float in feet (use surf_height range midpoint if available, else wave_height)
 * @param wavePeriod  parsed float in seconds (default 8 if unknown)
 * @param windSpeed   parsed float in mph
 * @param windDirection  raw direction string e.g. "NE (50°)" or "NE"
 * @returns float in [1, 11]
 */
export function computeStokeScore(
  waveHeight: number,
  wavePeriod: number,
  windSpeed: number,
  windDirection: string,
): number {
  const wd = String(windDirection).toUpperCase();
  const isOffshore = wd.includes('W') || wd.includes('N');

  const waveScore = waveHeight >= 6 ? 4 : waveHeight >= 4 ? 3 : waveHeight >= 2 ? 2 : waveHeight >= 1 ? 1 : 0;
  const periodBonus = wavePeriod >= 12 ? 1 : wavePeriod >= 9 ? 0.5 : 0;
  const windScore = isOffshore
    ? (windSpeed < 10 ? 3 : windSpeed < 15 ? 2 : 1)
    : (windSpeed < 8 ? 1 : 0);

  const raw = waveScore + periodBonus + windScore;
  return Math.max(1, Math.min(11, 1 + (raw / 8) * 10));
}

/**
 * Compute stoke score directly from a surfConditions row object.
 * Prefers surf_height (human range) over wave_height (raw buoy).
 */
export function computeStokeScoreFromConditions(surfConditions: {
  surf_height?: string | null;
  wave_height?: string | null;
  wave_period?: string | null;
  wind_speed?: string | null;
  wind_direction?: string | null;
} | null | undefined): number {
  if (!surfConditions) return 5;
  const wh = parseSurfHeight(surfConditions.surf_height ?? surfConditions.wave_height);
  const wp = parseSurfHeight(surfConditions.wave_period) || 8;
  const ws = parseSurfHeight(surfConditions.wind_speed);
  const wd = surfConditions.wind_direction ?? 'N';
  return computeStokeScore(wh, wp, ws, wd);
}
