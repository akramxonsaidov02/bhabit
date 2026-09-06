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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_admin_config: {
        Row: {
          id: number
          pin_hash: string
          updated_at: string
        }
        Insert: {
          id?: number
          pin_hash: string
          updated_at?: string
        }
        Update: {
          id?: number
          pin_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_devices: {
        Row: {
          active: boolean
          approved_by: string | null
          created_at: string
          id: string
          last_seen: string
          name: string | null
          permissions: Json
          role: string
          token_hash: string
          user_agent: string | null
        }
        Insert: {
          active?: boolean
          approved_by?: string | null
          created_at?: string
          id?: string
          last_seen?: string
          name?: string | null
          permissions?: Json
          role: string
          token_hash: string
          user_agent?: string | null
        }
        Update: {
          active?: boolean
          approved_by?: string | null
          created_at?: string
          id?: string
          last_seen?: string
          name?: string | null
          permissions?: Json
          role?: string
          token_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_devices_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "app_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      app_pending_approvals: {
        Row: {
          approved_permissions: Json | null
          approved_role: string | null
          approved_token_hash: string | null
          created_at: string
          device_fingerprint: string
          expires_at: string
          id: string
          qr_code: string
          status: string
          user_agent: string | null
        }
        Insert: {
          approved_permissions?: Json | null
          approved_role?: string | null
          approved_token_hash?: string | null
          created_at?: string
          device_fingerprint: string
          expires_at?: string
          id?: string
          qr_code: string
          status?: string
          user_agent?: string | null
        }
        Update: {
          approved_permissions?: Json | null
          approved_role?: string | null
          approved_token_hash?: string | null
          created_at?: string
          device_fingerprint?: string
          expires_at?: string
          id?: string
          qr_code?: string
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      device_inbox: {
        Row: {
          action: string
          consumed: boolean
          created_at: string
          device_id: string | null
          id: string
          source: string
          task_id: string
        }
        Insert: {
          action: string
          consumed?: boolean
          created_at?: string
          device_id?: string | null
          id?: string
          source?: string
          task_id: string
        }
        Update: {
          action?: string
          consumed?: boolean
          created_at?: string
          device_id?: string | null
          id?: string
          source?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_inbox_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "app_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_schedules: {
        Row: {
          day: string
          day_start: string
          device_id: string
          push_on: boolean
          sent: Json
          sleep_time: string
          tasks: Json
          telegram_on: boolean
          tz_offset: number
          updated_at: string
        }
        Insert: {
          day: string
          day_start?: string
          device_id: string
          push_on?: boolean
          sent?: Json
          sleep_time?: string
          tasks?: Json
          telegram_on?: boolean
          tz_offset?: number
          updated_at?: string
        }
        Update: {
          day?: string
          day_start?: string
          device_id?: string
          push_on?: boolean
          sent?: Json
          sleep_time?: string
          tasks?: Json
          telegram_on?: boolean
          tz_offset?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_schedules_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "app_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          device_name: string | null
          id: string
          is_master: boolean
          last_seen: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          id?: string
          is_master?: boolean
          last_seen?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          id?: string
          is_master?: boolean
          last_seen?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      location_events: {
        Row: {
          arrived_at: string
          device_id: string
          id: string
          lat: number | null
          lng: number | null
          place: string
          task_id: string | null
          task_name: string | null
        }
        Insert: {
          arrived_at?: string
          device_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          place: string
          task_id?: string | null
          task_name?: string | null
        }
        Update: {
          arrived_at?: string
          device_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          place?: string
          task_id?: string | null
          task_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "app_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          master_device_id: string | null
        }
        Insert: {
          created_at?: string
          id: string
          master_device_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          master_device_id?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_id: string
          endpoint: string
          id: string
          last_used: string | null
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_id: string
          endpoint: string
          id?: string
          last_used?: string | null
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_id?: string
          endpoint?: string
          id?: string
          last_used?: string | null
          p256dh?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "app_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          completed_at: string | null
          completion_date: string
          done: boolean
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_date: string
          done?: boolean
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completion_date?: string
          done?: boolean
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          auto_complete: boolean
          category: string
          created_at: string
          day_type: string | null
          end_time: string
          id: string
          name: string
          note: string | null
          priority: string
          sort_order: number
          start_time: string
          user_id: string
        }
        Insert: {
          auto_complete?: boolean
          category?: string
          created_at?: string
          day_type?: string | null
          end_time?: string
          id?: string
          name: string
          note?: string | null
          priority?: string
          sort_order?: number
          start_time?: string
          user_id: string
        }
        Update: {
          auto_complete?: boolean
          category?: string
          created_at?: string
          day_type?: string | null
          end_time?: string
          id?: string
          name?: string
          note?: string | null
          priority?: string
          sort_order?: number
          start_time?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_state: {
        Row: {
          asked_at: string | null
          chat_id: string
          last_device_id: string | null
          last_task_id: string | null
          last_task_name: string | null
          updated_at: string
        }
        Insert: {
          asked_at?: string | null
          chat_id: string
          last_device_id?: string | null
          last_task_id?: string | null
          last_task_name?: string | null
          updated_at?: string
        }
        Update: {
          asked_at?: string | null
          chat_id?: string
          last_device_id?: string | null
          last_task_id?: string | null
          last_task_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          ai_replan_on: boolean
          auto_shift_on_day_change: boolean
          auto_shift_on_prayer_change: boolean
          day_start: string
          extras: Json
          notif_on: boolean
          prayers: Json
          sleep_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_replan_on?: boolean
          auto_shift_on_day_change?: boolean
          auto_shift_on_prayer_change?: boolean
          day_start?: string
          extras?: Json
          notif_on?: boolean
          prayers?: Json
          sleep_time?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_replan_on?: boolean
          auto_shift_on_day_change?: boolean
          auto_shift_on_prayer_change?: boolean
          day_start?: string
          extras?: Json
          notif_on?: boolean
          prayers?: Json
          sleep_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
