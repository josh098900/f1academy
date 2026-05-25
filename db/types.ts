export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      coach_insights: {
        Row: {
          content: string
          created_at: string
          id: number
          kind: string
          model: string | null
          round_id: number
          target_id: number | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: number
          kind: string
          model?: string | null
          round_id: number
          target_id?: number | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: number
          kind?: string
          model?: string | null
          round_id?: number
          target_id?: number | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_insights_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_prices: {
        Row: {
          created_at: string
          driver_id: number
          id: number
          price_millions: number
          round_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_id: number
          id?: number
          price_millions: number
          round_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_id?: number
          id?: number
          price_millions?: number
          round_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_prices_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_prices_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          avatar_url: string | null
          country_code: string | null
          created_at: string
          date_of_birth: string | null
          external_id: number | null
          full_name: string
          id: number
          short_name: string
          updated_at: string
          wikidata_qid: string | null
          wikipedia_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          external_id?: number | null
          full_name: string
          id?: number
          short_name: string
          updated_at?: string
          wikidata_qid?: string | null
          wikipedia_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          external_id?: number | null
          full_name?: string
          id?: number
          short_name?: string
          updated_at?: string
          wikidata_qid?: string | null
          wikipedia_url?: string | null
        }
        Relationships: []
      }
      league_members: {
        Row: {
          joined_at: string
          league_id: number
          user_id: string
        }
        Insert: {
          joined_at?: string
          league_id: number
          user_id: string
        }
        Update: {
          joined_at?: string
          league_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          id: number
          invite_code: string
          name: string
          owner_id: string
          season_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          invite_code: string
          name: string
          owner_id: string
          season_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          invite_code?: string
          name?: string
          owner_id?: string
          season_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leagues_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          circuit_name: string | null
          country: string | null
          created_at: string
          date_end: string | null
          date_start: string | null
          id: number
          lock_time: string | null
          round_number: number
          season_id: number
          status: string
          updated_at: string
        }
        Insert: {
          circuit_name?: string | null
          country?: string | null
          created_at?: string
          date_end?: string | null
          date_start?: string | null
          id?: number
          lock_time?: string | null
          round_number: number
          season_id: number
          status?: string
          updated_at?: string
        }
        Update: {
          circuit_name?: string | null
          country?: string | null
          created_at?: string
          date_end?: string | null
          date_start?: string | null
          id?: number
          lock_time?: string | null
          round_number?: number
          season_id?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rounds_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_entries: {
        Row: {
          car_number: number | null
          created_at: string
          driver_id: number
          f1_partner_team: string | null
          id: number
          is_wildcard: boolean
          rounds: number[] | null
          season_id: number
          team_id: number
          updated_at: string
        }
        Insert: {
          car_number?: number | null
          created_at?: string
          driver_id: number
          f1_partner_team?: string | null
          id?: number
          is_wildcard?: boolean
          rounds?: number[] | null
          season_id: number
          team_id: number
          updated_at?: string
        }
        Update: {
          car_number?: number | null
          created_at?: string
          driver_id?: number
          f1_partner_team?: string | null
          id?: number
          is_wildcard?: boolean
          rounds?: number[] | null
          season_id?: number
          team_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_entries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          id: number
          is_current: boolean
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: number
          is_current?: boolean
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: number
          is_current?: boolean
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      session_results: {
        Row: {
          created_at: string
          data_source: string
          driver_id: number
          fastest_lap: boolean
          grid_position: number | null
          id: number
          position: number | null
          session_id: number
          status: string
          updated_at: string
          verified_against: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          data_source: string
          driver_id: number
          fastest_lap?: boolean
          grid_position?: number | null
          id?: number
          position?: number | null
          session_id: number
          status?: string
          updated_at?: string
          verified_against?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          data_source?: string
          driver_id?: number
          fastest_lap?: boolean
          grid_position?: number | null
          id?: number
          position?: number | null
          session_id?: number
          status?: string
          updated_at?: string
          verified_against?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_results_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          id: number
          round_id: number
          session_start: string | null
          session_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          round_id: number
          session_start?: string | null
          session_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          round_id?: number
          session_start?: string | null
          session_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          country_code: string | null
          created_at: string
          external_id: number | null
          id: number
          name: string
          short_name: string | null
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          external_id?: number | null
          id?: number
          name: string
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          external_id?: number | null
          id?: number
          name?: string
          short_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_scores: {
        Row: {
          boost_points_added: number | null
          breakdown: Json | null
          created_at: string
          cumulative_points: number
          id: number
          round_id: number
          round_points: number
          transfer_penalty: number
          updated_at: string
          user_id: string
        }
        Insert: {
          boost_points_added?: number | null
          breakdown?: Json | null
          created_at?: string
          cumulative_points: number
          id?: number
          round_id: number
          round_points: number
          transfer_penalty?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          boost_points_added?: number | null
          breakdown?: Json | null
          created_at?: string
          cumulative_points?: number
          id?: number
          round_id?: number
          round_points?: number
          transfer_penalty?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_scores_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_teams: {
        Row: {
          boost_driver_id: number
          created_at: string
          driver_ids: number[]
          id: number
          locked_at: string | null
          round_id: number
          transfers_used: number
          updated_at: string
          user_id: string
          wildcard_used: boolean
        }
        Insert: {
          boost_driver_id: number
          created_at?: string
          driver_ids: number[]
          id?: number
          locked_at?: string | null
          round_id: number
          transfers_used?: number
          updated_at?: string
          user_id: string
          wildcard_used?: boolean
        }
        Update: {
          boost_driver_id?: number
          created_at?: string
          driver_ids?: number[]
          id?: number
          locked_at?: string | null
          round_id?: number
          transfers_used?: number
          updated_at?: string
          user_id?: string
          wildcard_used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_teams_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_teams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          display_name: string
          favourite_team_id: number | null
          id: string
          is_admin: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          favourite_team_id?: number | null
          id: string
          is_admin?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          favourite_team_id?: number | null
          id?: string
          is_admin?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_favourite_team_id_fkey"
            columns: ["favourite_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      global_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          display_name: string
          rank: number
          rounds_played: number
          total: number
          user_id: string
        }[]
      }
      is_league_member: { Args: { league: number }; Returns: boolean }
      join_league: {
        Args: { p_code: string }
        Returns: {
          id: number
          name: string
        }[]
      }
      league_standings: {
        Args: { p_league: number }
        Returns: {
          display_name: string
          rank: number
          total: number
          user_id: string
        }[]
      }
      shares_league_with: { Args: { target: string }; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

