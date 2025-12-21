
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cron_job_logs: {
        Row: {
          error_message: string | null
          executed_at: string | null
          id: string
          job_name: string
          status: string | null
        }
        Insert: {
          error_message?: string | null
          executed_at?: string | null
          id?: string
          job_name: string
          status?: string | null
        }
        Update: {
          error_message?: string | null
          executed_at?: string | null
          id?: string
          job_name?: string
          status?: string | null
        }
        Relationships: []
      }
      external_surf_reports: {
        Row: {
          conditions: string | null
          created_at: string | null
          date: string
          id: string
          rating: number | null
          raw_data: Json | null
          source: string
          swell_direction: string | null
          updated_at: string | null
          wave_height: string | null
          wave_period: string | null
        }
        Insert: {
          conditions?: string | null
          created_at?: string | null
          date: string
          id?: string
          rating?: number | null
          raw_data?: Json | null
          source: string
          swell_direction?: string | null
          updated_at?: string | null
          wave_height?: string | null
          wave_period?: string | null
        }
        Update: {
          conditions?: string | null
          created_at?: string | null
          date?: string
          id?: string
          rating?: number | null
          raw_data?: Json | null
          source?: string
          swell_direction?: string | null
          updated_at?: string | null
          wave_height?: string | null
          wave_period?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_admin: boolean | null
          is_subscribed: boolean | null
          subscription_end_date: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          is_admin?: boolean | null
          is_subscribed?: boolean | null
          subscription_end_date?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_admin?: boolean | null
          is_subscribed?: boolean | null
          subscription_end_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      surf_conditions: {
        Row: {
          buoy_id: string | null
          created_at: string | null
          date: string
          id: string
          swell_direction: string | null
          updated_at: string | null
          water_temp: string | null
          wave_height: string | null
          wave_period: string | null
          wind_direction: string | null
          wind_speed: string | null
        }
        Insert: {
          buoy_id?: string | null
          created_at?: string | null
          date: string
          id?: string
          swell_direction?: string | null
          updated_at?: string | null
          water_temp?: string | null
          wave_height?: string | null
          wave_period?: string | null
          wind_direction?: string | null
          wind_speed?: string | null
        }
        Update: {
          buoy_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          swell_direction?: string | null
          updated_at?: string | null
          water_temp?: string | null
          wave_height?: string | null
          wave_period?: string | null
          wind_direction?: string | null
          wind_speed?: string | null
        }
        Relationships: []
      }
      surf_reports: {
        Row: {
          air_temp: string | null
          conditions: string
          created_at: string | null
          created_by: string | null
          date: string
          edited_at: string | null
          edited_by: string | null
          id: string
          rating: number | null
          report_text: string | null
          swell_direction: string | null
          tide: string
          tide_times: Json | null
          updated_at: string | null
          water_temp: string
          wave_height: string
          wave_period: string | null
          weather_conditions: string | null
          wind_direction: string
          wind_speed: string
        }
        Insert: {
          air_temp?: string | null
          conditions: string
          created_at?: string | null
          created_by?: string | null
          date: string
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          rating?: number | null
          report_text?: string | null
          swell_direction?: string | null
          tide: string
          tide_times?: Json | null
          updated_at?: string | null
          water_temp: string
          wave_height: string
          wave_period?: string | null
          weather_conditions?: string | null
          wind_direction: string
          wind_speed: string
        }
        Update: {
          air_temp?: string | null
          conditions?: string
          created_at?: string | null
          created_by?: string | null
          date?: string
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          rating?: number | null
          report_text?: string | null
          swell_direction?: string | null
          tide?: string
          tide_times?: Json | null
          updated_at?: string | null
          water_temp?: string
          wave_height?: string
          wave_period?: string | null
          weather_conditions?: string | null
          wind_direction?: string
          wind_speed?: string
        }
        Relationships: []
      }
      tide_data: {
        Row: {
          created_at: string | null
          date: string
          height: number
          id: string
          time: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          height: number
          id?: string
          time: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          height?: number
          id?: string
          time?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string | null
          description: string | null
          duration: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          resolution_height: number | null
          resolution_width: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          uploaded_by: string | null
          video_url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          resolution_height?: number | null
          resolution_width?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
          video_url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          resolution_height?: number | null
          resolution_width?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
          video_url?: string
        }
        Relationships: []
      }
      weather_data: {
        Row: {
          conditions: string | null
          created_at: string | null
          date: string
          feels_like: number | null
          forecast: string | null
          humidity: number | null
          id: string
          pressure: number | null
          raw_data: Json | null
          temperature: number | null
          updated_at: string | null
          visibility: number | null
          wind_direction: string | null
          wind_gust: number | null
          wind_speed: number | null
        }
        Insert: {
          conditions?: string | null
          created_at?: string | null
          date: string
          feels_like?: number | null
          forecast?: string | null
          humidity?: number | null
          id?: string
          pressure?: number | null
          raw_data?: Json | null
          temperature?: number | null
          updated_at?: string | null
          visibility?: number | null
          wind_direction?: string | null
          wind_gust?: number | null
          wind_speed?: number | null
        }
        Update: {
          conditions?: string | null
          created_at?: string | null
          date?: string
          feels_like?: number | null
          forecast?: string | null
          humidity?: number | null
          id?: string
          pressure?: number | null
          raw_data?: Json | null
          temperature?: number | null
          updated_at?: string | null
          visibility?: number | null
          wind_direction?: string | null
          wind_gust?: number | null
          wind_speed?: number | null
        }
        Relationships: []
      }
      weather_forecast: {
        Row: {
          conditions: string | null
          created_at: string | null
          date: string
          day_name: string | null
          high_temp: number | null
          humidity: number | null
          icon: string | null
          id: string
          low_temp: number | null
          precipitation_chance: number | null
          swell_height_max: number | null
          swell_height_min: number | null
          swell_height_range: string | null
          updated_at: string | null
          wind_direction: string | null
          wind_speed: number | null
        }
        Insert: {
          conditions?: string | null
          created_at?: string | null
          date: string
          day_name?: string | null
          high_temp?: number | null
          humidity?: number | null
          icon?: string | null
          id?: string
          low_temp?: number | null
          precipitation_chance?: number | null
          swell_height_max?: number | null
          swell_height_min?: number | null
          swell_height_range?: string | null
          updated_at?: string | null
          wind_direction?: string | null
          wind_speed?: number | null
        }
        Update: {
          conditions?: string | null
          created_at?: string | null
          date?: string
          day_name?: string | null
          high_temp?: number | null
          humidity?: number | null
          icon?: string | null
          id?: string
          low_temp?: number | null
          precipitation_chance?: number | null
          swell_height_max?: number | null
          swell_height_min?: number | null
          swell_height_range?: string | null
          updated_at?: string | null
          wind_direction?: string | null
          wind_speed?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      trigger_daily_update: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
