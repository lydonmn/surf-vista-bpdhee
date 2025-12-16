
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          is_admin: boolean
          is_subscribed: boolean
          subscription_end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          is_admin?: boolean
          is_subscribed?: boolean
          subscription_end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          is_admin?: boolean
          is_subscribed?: boolean
          subscription_end_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      videos: {
        Row: {
          id: string
          title: string
          description: string | null
          video_url: string
          thumbnail_url: string | null
          duration: string | null
          uploaded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          video_url: string
          thumbnail_url?: string | null
          duration?: string | null
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          video_url?: string
          thumbnail_url?: string | null
          duration?: string | null
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      surf_reports: {
        Row: {
          id: string
          date: string
          wave_height: string
          wind_speed: string
          wind_direction: string
          tide: string
          water_temp: string
          conditions: string
          rating: number | null
          created_by: string | null
          created_at: string
          updated_at: string
          wave_period: string | null
          swell_direction: string | null
          air_temp: string | null
          weather_conditions: string | null
          tide_times: Json | null
        }
        Insert: {
          id?: string
          date: string
          wave_height: string
          wind_speed: string
          wind_direction: string
          tide: string
          water_temp: string
          conditions: string
          rating?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          wave_period?: string | null
          swell_direction?: string | null
          air_temp?: string | null
          weather_conditions?: string | null
          tide_times?: Json | null
        }
        Update: {
          id?: string
          date?: string
          wave_height?: string
          wind_speed?: string
          wind_direction?: string
          tide?: string
          water_temp?: string
          conditions?: string
          rating?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          wave_period?: string | null
          swell_direction?: string | null
          air_temp?: string | null
          weather_conditions?: string | null
          tide_times?: Json | null
        }
      }
      weather_data: {
        Row: {
          id: string
          date: string
          temperature: number | null
          feels_like: number | null
          humidity: number | null
          wind_speed: number | null
          wind_direction: string | null
          wind_gust: number | null
          pressure: number | null
          visibility: number | null
          conditions: string | null
          forecast: string | null
          raw_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          temperature?: number | null
          feels_like?: number | null
          humidity?: number | null
          wind_speed?: number | null
          wind_direction?: string | null
          wind_gust?: number | null
          pressure?: number | null
          visibility?: number | null
          conditions?: string | null
          forecast?: string | null
          raw_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          temperature?: number | null
          feels_like?: number | null
          humidity?: number | null
          wind_speed?: number | null
          wind_direction?: string | null
          wind_gust?: number | null
          pressure?: number | null
          visibility?: number | null
          conditions?: string | null
          forecast?: string | null
          raw_data?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      tide_data: {
        Row: {
          id: string
          date: string
          time: string
          type: string
          height: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          time: string
          type: string
          height: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          time?: string
          type?: string
          height?: number
          created_at?: string
          updated_at?: string
        }
      }
      external_surf_reports: {
        Row: {
          id: string
          date: string
          source: string
          wave_height: string | null
          wave_period: string | null
          swell_direction: string | null
          conditions: string | null
          rating: number | null
          raw_data: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          source: string
          wave_height?: string | null
          wave_period?: string | null
          swell_direction?: string | null
          conditions?: string | null
          rating?: number | null
          raw_data?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          source?: string
          wave_height?: string | null
          wave_period?: string | null
          swell_direction?: string | null
          conditions?: string | null
          rating?: number | null
          raw_data?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
