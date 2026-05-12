
export interface SurfReport {
  id: string;
  date: string;
  location: string;
  wave_height: string;
  surf_height?: string | null;
  wave_period?: string | null;
  swell_direction?: string | null;
  wind_speed: string;
  wind_direction: string;
  tide: string;
  water_temp: string;
  conditions: string;
  rating?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  air_temp?: string | null;
  weather_conditions?: string | null;
  tide_times?: any;
  report_text?: string | null;
  edited_by?: string | null;
  edited_at?: string | null;
  created_by?: string | null;
  detailed_forecast?: string | null;
  conditions_summary?: string | null;
  weather?: string | null;
  min_wave_height?: number | null;
}

export interface WeatherData {
  id: string;
  date: string;
  location: string;
  temperature: string;
  feels_like?: string | null;
  humidity?: number | null;
  wind_speed: string;
  wind_direction: string;
  wind_gust?: string | null;
  pressure?: string | null;
  visibility?: string | null;
  conditions: string;
  forecast?: string | null;
  raw_data?: any;
  created_at?: string | null;
  updated_at?: string | null;
  short_forecast?: string | null;
}

export interface WeatherForecast {
  id: string;
  date: string;
  location: string;
  day_name?: string | null;
  temperature?: number | null;
  high_temp: number | null;
  low_temp: number | null;
  conditions?: string | null;
  short_forecast?: string | null;
  icon?: string | null;
  wind_speed?: number | null;
  wind_direction?: string | null;
  precipitation_chance?: number | null;
  humidity?: number | null;
  swell_height_min?: number | null;
  swell_height_max?: number | null;
  swell_height_range?: string | null;
  prediction_confidence?: number | null;
  prediction_source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TideData {
  id: string;
  date: string;
  location: string;
  time: string;
  type: 'High' | 'Low' | string;
  height: number;
  height_unit?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SurfPrediction {
  id: string;
  date: string;
  predicted_surf_min: number;
  predicted_surf_max: number;
  confidence: number;
  prediction_factors: {
    trend: number;
    movingAvg3Day: number;
    movingAvg7Day: number;
    volatility: number;
    currentWaveHeight: number;
    currentPeriod: number;
    avgWaveHeight: number;
    avgPeriod: number;
    seasonalFactor: number;
    uncertaintyFactor: number;
  };
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Video {
  id: string;
  title: string;
  location: string;
  description?: string | null;
  video_url: string;
  thumbnail_url?: string | null;
  duration?: string | null;
  duration_seconds?: number | null;
  resolution_width?: number | null;
  resolution_height?: number | null;
  file_size_bytes?: number | null;
  uploaded_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  mux_upload_id?: string | null;
  mux_asset_id?: string | null;
  status?: 'active' | 'processing' | 'errored' | null;
}
