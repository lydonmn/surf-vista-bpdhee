
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
