
import { Database } from '@/app/integrations/supabase/types';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Video = Database['public']['Tables']['videos']['Row'];
export type SurfReport = Database['public']['Tables']['surf_reports']['Row'];
export type WeatherData = Database['public']['Tables']['weather_data']['Row'];
export type WeatherForecast = Database['public']['Tables']['weather_forecast']['Row'];
export type TideData = Database['public']['Tables']['tide_data']['Row'];
export type ExternalSurfReport = Database['public']['Tables']['external_surf_reports']['Row'];

// Legacy types for backward compatibility
export interface User {
  id: string;
  email: string;
  isSubscribed: boolean;
  isAdmin: boolean;
  subscriptionEndDate?: string;
}

export interface VideoItem {
  id: string;
  title: string;
  date: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: string;
}

export interface SurfReportLegacy {
  id: string;
  date: string;
  waveHeight: string;
  windSpeed: string;
  windDirection: string;
  tide: string;
  waterTemp: string;
  conditions: string;
  rating: number;
}
