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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_key_rate_limits: {
        Row: {
          api_key_id: string
          id: string
          request_count: number
          window_start: string
        }
        Insert: {
          api_key_id: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Update: {
          api_key_id?: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_key_rate_limits_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          env_id: string
          id: string
          key_hash: string
          key_prefix: string
          name: string
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          env_id: string
          id?: string
          key_hash: string
          key_prefix: string
          name: string
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          env_id?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          name?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_env_id_fkey"
            columns: ["env_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
        ]
      }
      environments: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "environments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_sessions: {
        Row: {
          agent_id: string
          counters: Json | null
          created_at: string
          current_state: string | null
          env_id: string
          id: string
          initial_state: string | null
          last_tool_call_times: Json | null
          metadata: Json | null
          policy_id: string | null
          policy_version_locked: number | null
          session_id: string
          tool_call_counts: Json | null
          tool_calls_history: string[] | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          counters?: Json | null
          created_at?: string
          current_state?: string | null
          env_id: string
          id?: string
          initial_state?: string | null
          last_tool_call_times?: Json | null
          metadata?: Json | null
          policy_id?: string | null
          policy_version_locked?: number | null
          session_id: string
          tool_call_counts?: Json | null
          tool_calls_history?: string[] | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          counters?: Json | null
          created_at?: string
          current_state?: string | null
          env_id?: string
          id?: string
          initial_state?: string | null
          last_tool_call_times?: Json | null
          metadata?: Json | null
          policy_id?: string | null
          policy_version_locked?: number | null
          session_id?: string
          tool_call_counts?: Json | null
          tool_calls_history?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_sessions_env_id_fkey"
            columns: ["env_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_sessions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      policies: {
        Row: {
          created_at: string
          env_id: string
          id: string
          name: string
          policy_hash: string | null
          policy_spec: Json
          published_at: string | null
          status: Database["public"]["Enums"]["policy_status"]
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          env_id: string
          id?: string
          name: string
          policy_hash?: string | null
          policy_spec?: Json
          published_at?: string | null
          status?: Database["public"]["Enums"]["policy_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          env_id?: string
          id?: string
          name?: string
          policy_hash?: string | null
          policy_spec?: Json
          published_at?: string | null
          status?: Database["public"]["Enums"]["policy_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "policies_env_id_fkey"
            columns: ["env_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_versions: {
        Row: {
          id: string
          policy_hash: string
          policy_id: string
          policy_spec: Json
          published_at: string
          published_by: string | null
          version: number
        }
        Insert: {
          id?: string
          policy_hash: string
          policy_id: string
          policy_spec: Json
          published_at?: string
          published_by?: string | null
          version: number
        }
        Update: {
          id?: string
          policy_hash?: string
          policy_id?: string
          policy_spec?: Json
          published_at?: string
          published_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_versions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          org_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          org_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          org_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_call_logs: {
        Row: {
          action_type: string | null
          counters_after: Json | null
          counters_before: Json | null
          decision: Database["public"]["Enums"]["decision_type"]
          decision_reasons: string[]
          error_code: string | null
          execution_duration_ms: number | null
          execution_session_id: string
          id: string
          payload_redacted: Json | null
          policy_hash: string | null
          policy_version_used: number | null
          state_after: string | null
          state_before: string | null
          timestamp: string
          tool_name: string
        }
        Insert: {
          action_type?: string | null
          counters_after?: Json | null
          counters_before?: Json | null
          decision: Database["public"]["Enums"]["decision_type"]
          decision_reasons?: string[]
          error_code?: string | null
          execution_duration_ms?: number | null
          execution_session_id: string
          id?: string
          payload_redacted?: Json | null
          policy_hash?: string | null
          policy_version_used?: number | null
          state_after?: string | null
          state_before?: string | null
          timestamp?: string
          tool_name: string
        }
        Update: {
          action_type?: string | null
          counters_after?: Json | null
          counters_before?: Json | null
          decision?: Database["public"]["Enums"]["decision_type"]
          decision_reasons?: string[]
          error_code?: string | null
          execution_duration_ms?: number | null
          execution_session_id?: string
          id?: string
          payload_redacted?: Json | null
          policy_hash?: string | null
          policy_version_used?: number | null
          state_after?: string | null
          state_before?: string | null
          timestamp?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_call_logs_execution_session_id_fkey"
            columns: ["execution_session_id"]
            isOneToOne: false
            referencedRelation: "execution_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member"
      decision_type: "allowed" | "blocked"
      policy_status: "draft" | "published" | "archived"
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
    Enums: {
      app_role: ["admin", "member"],
      decision_type: ["allowed", "blocked"],
      policy_status: ["draft", "published", "archived"],
    },
  },
} as const
