// Automatisch erzeugt — nicht von Hand bearbeiten.
// Neu erzeugen mit: npm run gen:types
//
// Quelle ist der Katalog der lokalen Datenbank (scripts/gen-types.mjs). Die Form
// entspricht dem, was supabase-js erwartet.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
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
      rpc_validate_registration_code: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
    };
    CompositeTypes: Record<string, never>;
    Enums: {
      gender: "male" | "female" | "unspecified";
      member_status: "active" | "pending_approval" | "unconfirmed";
      ranking_type: "men" | "women" | "seniors_40" | "seniors_50" | "seniors_60" | "seniors_70" | "seniors_75" | "youth_19" | "youth_15" | "youth_13" | "youth_11" | "girls_19" | "girls_15" | "girls_13" | "girls_11";
      user_role: "admin" | "team_leader" | "trainer" | "organizer" | "member" | "guest";
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
