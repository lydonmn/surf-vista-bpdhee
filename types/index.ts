
export interface SurfReport {
  id: string;
  date: string;
  location: string;
  wave_height: string;
  surf_height?: string;
  wave_period?: string;
  swell_direction?: string;
  wind_speed: string;
  wind_direction: string;
  tide: string;
  water_temp: string;
  conditions: string; // Auto-generated narrative
  rating?: number;
  created_at?: string;
  updated_at?: string;
  air_temp?: string;
  weather_conditions?: string;
  tide_times?: any;
  report_text?: string; // Custom edited narrative (takes priority over conditions)
  edited_by?: string;
  edited_at?: string;
}

export interface WeatherData {
  id: string;
  date: string;
  location: string;
  temperature: string;
  feels_like?: string;
  humidity?: number;
  wind_speed: string;
  wind_direction: string;
  wind_gust?: string;
  pressure?: string;
  visibility?: string;
  conditions: string;
  forecast?: string;
  raw_data?: any;
  created_at?: string;
  updated_at?: string;
}

export interface WeatherForecast {
  id: string;
  date: string;
  location: string;
  day_name?: string;
  temperature?: number;
  high_temp: number | null;
  low_temp: number | null;
  conditions?: string;
  short_forecast?: string;
  icon?: string;
  wind_speed?: number;
  wind_direction?: string;
  precipitation_chance?: number | null;
  humidity?: number;
  swell_height_min?: number;
  swell_height_max?: number;
  swell_height_range?: string | null;
  prediction_confidence?: number | null;
  prediction_source?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TideData {
  id: string;
  date: string;
  location: string;
  time: string;
  type: 'High' | 'Low';
  height: number;
  height_unit?: string;
  created_at?: string;
  updated_at?: string;
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
  created_at?: string;
  updated_at?: string;
}

export interface Video {
  id: string;
  title: string;
  location: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  duration?: string;
  duration_seconds?: number;
  resolution_width?: number;
  resolution_height?: number;
  file_size_bytes?: number;
  uploaded_by?: string;
  created_at?: string;
  updated_at?: string;
  mux_upload_id?: string;
  mux_asset_id?: string;
  status?: 'active' | 'processing' | 'errored'; // 🚨 NEW: Video processing status
}
