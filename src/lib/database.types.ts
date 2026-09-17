// Automatisch erzeugt — nicht von Hand bearbeiten.
// Neu erzeugen mit: npm run gen:types
//
// Quelle ist der Katalog der lokalen Datenbank (scripts/gen-types.mjs). Die Form
// entspricht dem, was supabase-js erwartet.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      absences: {
        Row: {
          id: string;
          profile_id: string;
          start_date: string;
          end_date: string;
          comment_private: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          start_date: string;
          end_date: string;
          comment_private?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          start_date?: string;
          end_date?: string;
          comment_private?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "absences_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      club_settings: {
        Row: {
          key: string;
          value: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      group_members: {
        Row: {
          group_id: string;
          profile_id: string;
          created_at: string;
        };
        Insert: {
          group_id: string;
          profile_id: string;
          created_at?: string;
        };
        Update: {
          group_id?: string;
          profile_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      match_changes: {
        Row: {
          id: string;
          match_id: string;
          change_type: string;
          old_value: Json | null;
          new_value: Json | null;
          actor: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          change_type: string;
          old_value?: Json | null;
          new_value?: Json | null;
          actor?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          change_type?: string;
          old_value?: Json | null;
          new_value?: Json | null;
          actor?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_changes_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_changes_actor_fkey";
            columns: ["actor"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      match_participations: {
        Row: {
          match_id: string;
          profile_id: string;
          response: Database["public"]["Enums"]["participation_response"];
          version_responded: number | null;
          lineup_position: number | null;
          removed: boolean;
          comment: string;
          source: Database["public"]["Enums"]["participation_source"];
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          match_id: string;
          profile_id: string;
          response?: Database["public"]["Enums"]["participation_response"];
          version_responded?: number | null;
          lineup_position?: number | null;
          removed?: boolean;
          comment?: string;
          source?: Database["public"]["Enums"]["participation_source"];
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          match_id?: string;
          profile_id?: string;
          response?: Database["public"]["Enums"]["participation_response"];
          version_responded?: number | null;
          lineup_position?: number | null;
          removed?: boolean;
          comment?: string;
          source?: Database["public"]["Enums"]["participation_source"];
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_participations_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_participations_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_participations_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      match_volunteers: {
        Row: {
          match_id: string;
          profile_id: string;
          kind: Database["public"]["Enums"]["volunteer_kind"];
          note: string;
          created_at: string;
        };
        Insert: {
          match_id: string;
          profile_id: string;
          kind: Database["public"]["Enums"]["volunteer_kind"];
          note?: string;
          created_at?: string;
        };
        Update: {
          match_id?: string;
          profile_id?: string;
          kind?: Database["public"]["Enums"]["volunteer_kind"];
          note?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_volunteers_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_volunteers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          id: string;
          team_id: string;
          source: Database["public"]["Enums"]["match_source"];
          external_uid: string | null;
          summary: string;
          opponent: string;
          league: string;
          description: string;
          location_text: string;
          venue_id: string | null;
          is_home: boolean;
          dtstart_external: string;
          dtend_external: string;
          dtstart_override: string | null;
          dtend_override: string | null;
          dtstart: string | null;
          dtend: string | null;
          required_players: number;
          supervisor_id: string | null;
          comment: string;
          nuscore_code: string | null;
          nuscore_pin: string | null;
          matchday: number | null;
          version: number;
          active: boolean;
          cancel_reason: string | null;
          lineup_locked: boolean;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          source?: Database["public"]["Enums"]["match_source"];
          external_uid?: string | null;
          summary?: string;
          opponent?: string;
          league?: string;
          description?: string;
          location_text?: string;
          venue_id?: string | null;
          is_home?: boolean;
          dtstart_external: string;
          dtend_external: string;
          dtstart_override?: string | null;
          dtend_override?: string | null;
          required_players: number;
          supervisor_id?: string | null;
          comment?: string;
          nuscore_code?: string | null;
          nuscore_pin?: string | null;
          matchday?: number | null;
          version?: number;
          active?: boolean;
          cancel_reason?: string | null;
          lineup_locked?: boolean;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          source?: Database["public"]["Enums"]["match_source"];
          external_uid?: string | null;
          summary?: string;
          opponent?: string;
          league?: string;
          description?: string;
          location_text?: string;
          venue_id?: string | null;
          is_home?: boolean;
          dtstart_external?: string;
          dtend_external?: string;
          dtstart_override?: string | null;
          dtend_override?: string | null;
          required_players?: number;
          supervisor_id?: string | null;
          comment?: string;
          nuscore_code?: string | null;
          nuscore_pin?: string | null;
          matchday?: number | null;
          version?: number;
          active?: boolean;
          cancel_reason?: string | null;
          lineup_locked?: boolean;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matches_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_supervisor_id_fkey";
            columns: ["supervisor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      member_rankings: {
        Row: {
          profile_id: string;
          ranking_type: Database["public"]["Enums"]["ranking_type"];
          team_number: number;
          position_number: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          ranking_type: Database["public"]["Enums"]["ranking_type"];
          team_number: number;
          position_number: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          profile_id?: string;
          ranking_type?: Database["public"]["Enums"]["ranking_type"];
          team_number?: number;
          position_number?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_rankings_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          mobile_phone: string | null;
          gender: Database["public"]["Enums"]["gender"];
          birthday: string | null;
          member_number: string | null;
          role: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["member_status"];
          no_games: boolean;
          qttr: number | null;
          contact_visible: boolean;
          hide_birthday: boolean;
          emails_copies: string[];
          reminder_games_hours: number;
          auth_linked_at: string | null;
          last_login_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          mobile_phone?: string | null;
          gender?: Database["public"]["Enums"]["gender"];
          birthday?: string | null;
          member_number?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["member_status"];
          no_games?: boolean;
          qttr?: number | null;
          contact_visible?: boolean;
          hide_birthday?: boolean;
          emails_copies?: string[];
          reminder_games_hours?: number;
          auth_linked_at?: string | null;
          last_login_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          mobile_phone?: string | null;
          gender?: Database["public"]["Enums"]["gender"];
          birthday?: string | null;
          member_number?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["member_status"];
          no_games?: boolean;
          qttr?: number | null;
          contact_visible?: boolean;
          hide_birthday?: boolean;
          emails_copies?: string[];
          reminder_games_hours?: number;
          auth_linked_at?: string | null;
          last_login_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sync_runs: {
        Row: {
          id: string;
          started_at: string;
          completed_at: string | null;
          status: Database["public"]["Enums"]["sync_status"];
          summary: Json;
        };
        Insert: {
          id?: string;
          started_at?: string;
          completed_at?: string | null;
          status?: Database["public"]["Enums"]["sync_status"];
          summary?: Json;
        };
        Update: {
          id?: string;
          started_at?: string;
          completed_at?: string | null;
          status?: Database["public"]["Enums"]["sync_status"];
          summary?: Json;
        };
        Relationships: [];
      };
      team_leaders: {
        Row: {
          team_id: string;
          profile_id: string;
          created_at: string;
        };
        Insert: {
          team_id: string;
          profile_id: string;
          created_at?: string;
        };
        Update: {
          team_id?: string;
          profile_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_leaders_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_leaders_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      team_members: {
        Row: {
          team_id: string;
          profile_id: string;
          kind: Database["public"]["Enums"]["team_member_kind"];
          rank: number | null;
          created_at: string;
        };
        Insert: {
          team_id: string;
          profile_id: string;
          kind?: Database["public"]["Enums"]["team_member_kind"];
          rank?: number | null;
          created_at?: string;
        };
        Update: {
          team_id?: string;
          profile_id?: string;
          kind?: Database["public"]["Enums"]["team_member_kind"];
          rank?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          id: string;
          name: string;
          color: string;
          size: number;
          ranking_type: Database["public"]["Enums"]["ranking_type"];
          ranking: number | null;
          leagues: string[];
          lineup_mode: Database["public"]["Enums"]["lineup_mode"];
          substitute_mode: Database["public"]["Enums"]["substitute_mode"];
          substitute_timeout_hours: number;
          hide_users_no_ranking: boolean;
          block_participants_after: string | null;
          comment_home_games: string;
          comment_away_games: string;
          arrival_minutes_home: number;
          arrival_minutes_away: number;
          manual_request_auto_add: boolean;
          hide_drivers_catering: boolean;
          is_braunschweiger: boolean;
          webcal_url: string | null;
          sync_enabled: boolean;
          active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          size: number;
          ranking_type?: Database["public"]["Enums"]["ranking_type"];
          ranking?: number | null;
          leagues?: string[];
          lineup_mode?: Database["public"]["Enums"]["lineup_mode"];
          substitute_mode?: Database["public"]["Enums"]["substitute_mode"];
          substitute_timeout_hours?: number;
          hide_users_no_ranking?: boolean;
          block_participants_after?: string | null;
          comment_home_games?: string;
          comment_away_games?: string;
          arrival_minutes_home?: number;
          arrival_minutes_away?: number;
          manual_request_auto_add?: boolean;
          hide_drivers_catering?: boolean;
          is_braunschweiger?: boolean;
          webcal_url?: string | null;
          sync_enabled?: boolean;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          size?: number;
          ranking_type?: Database["public"]["Enums"]["ranking_type"];
          ranking?: number | null;
          leagues?: string[];
          lineup_mode?: Database["public"]["Enums"]["lineup_mode"];
          substitute_mode?: Database["public"]["Enums"]["substitute_mode"];
          substitute_timeout_hours?: number;
          hide_users_no_ranking?: boolean;
          block_participants_after?: string | null;
          comment_home_games?: string;
          comment_away_games?: string;
          arrival_minutes_home?: number;
          arrival_minutes_away?: number;
          manual_request_auto_add?: boolean;
          hide_drivers_catering?: boolean;
          is_braunschweiger?: boolean;
          webcal_url?: string | null;
          sync_enabled?: boolean;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          id: string;
          name: string;
          address: string;
          postal_code: string | null;
          city: string;
          max_games: number | null;
          allow_training_at_max_games: boolean;
          training_only: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string;
          postal_code?: string | null;
          city?: string;
          max_games?: number | null;
          allow_training_at_max_games?: boolean;
          training_only?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          postal_code?: string | null;
          city?: string;
          max_games?: number | null;
          allow_training_at_max_games?: boolean;
          training_only?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_absences: {
        Row: {
          id: string | null;
          profile_id: string | null;
          start_date: string | null;
          end_date: string | null;
          comment_private: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      v_match_lineup_status: {
        Row: {
          match_id: string | null;
          profile_id: string | null;
          status: string | null;
        };
        Relationships: [];
      };
      v_members_directory: {
        Row: {
          id: string | null;
          first_name: string | null;
          last_name: string | null;
          full_name: string | null;
          role: Database["public"]["Enums"]["user_role"] | null;
          status: Database["public"]["Enums"]["member_status"] | null;
          no_games: boolean | null;
          qttr: number | null;
          email: string | null;
          phone: string | null;
          mobile_phone: string | null;
          birthday: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      can_see_absences: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      current_member_role: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      get_public_club_info: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      is_active_member: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      is_organizer_or_admin: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      leads_match: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      leads_team: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      recompute_lineup: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_activate_member: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_delete_my_account: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      rpc_manage_player: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_set_lineup: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_set_match_response: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_unlock_lineup: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_update_qttr_bulk: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_validate_registration_code: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
    };
    CompositeTypes: Record<string, never>;
    Enums: {
      gender: "male" | "female" | "unspecified";
      lineup_mode: "fixed" | "open";
      match_source: "ics" | "manual";
      member_status: "active" | "pending_approval" | "unconfirmed";
      participation_response: "none" | "yes" | "no" | "unclear";
      participation_source: "auto" | "self" | "leader" | "request" | "link";
      ranking_type: "men" | "women" | "seniors_40" | "seniors_50" | "seniors_60" | "seniors_70" | "seniors_75" | "youth_19" | "youth_15" | "youth_13" | "youth_11" | "girls_19" | "girls_15" | "girls_13" | "girls_11";
      substitute_mode: "sequential" | "parallel" | "manual";
      sync_status: "pending" | "success" | "warning" | "failed";
      team_member_kind: "regular" | "substitute";
      user_role: "admin" | "team_leader" | "trainer" | "organizer" | "member" | "guest";
      volunteer_kind: "driver" | "catering";
    };
  };
}

// Kurzformen für den Alltag
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertDto<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateDto<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type ViewRow<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
