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
      action_tokens: {
        Row: {
          token: string;
          profile_id: string;
          action: Database["public"]["Enums"]["action_token_kind"];
          target_id: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          token?: string;
          profile_id: string;
          action: Database["public"]["Enums"]["action_token_kind"];
          target_id: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          token?: string;
          profile_id?: string;
          action?: Database["public"]["Enums"]["action_token_kind"];
          target_id?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "action_tokens_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_tokens: {
        Row: {
          profile_id: string;
          token: string;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          token?: string;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          token?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_tokens_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      club_events: {
        Row: {
          id: string;
          name: string;
          full_day: boolean;
          starts_at: string;
          ends_at: string | null;
          participate_until: string | null;
          max_participants: number | null;
          address: string;
          description_html: string;
          hide_in_my_club: boolean;
          exclude_calendar: boolean;
          created_by: string | null;
          reminder_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          full_day?: boolean;
          starts_at: string;
          ends_at?: string | null;
          participate_until?: string | null;
          max_participants?: number | null;
          address?: string;
          description_html?: string;
          hide_in_my_club?: boolean;
          exclude_calendar?: boolean;
          created_by?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          full_day?: boolean;
          starts_at?: string;
          ends_at?: string | null;
          participate_until?: string | null;
          max_participants?: number | null;
          address?: string;
          description_html?: string;
          hide_in_my_club?: boolean;
          exclude_calendar?: boolean;
          created_by?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      club_role_members: {
        Row: {
          role_id: string;
          profile_id: string;
          created_at: string;
        };
        Insert: {
          role_id: string;
          profile_id: string;
          created_at?: string;
        };
        Update: {
          role_id?: string;
          profile_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_role_members_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "club_roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_role_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      club_roles: {
        Row: {
          id: string;
          name: string;
          description: string;
          duties: string[];
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          duties?: string[];
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          duties?: string[];
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
      event_participations: {
        Row: {
          event_id: string;
          profile_id: string;
          status: Database["public"]["Enums"]["event_status"];
          guests: number;
          source: Database["public"]["Enums"]["attendance_source"];
          updated_at: string;
        };
        Insert: {
          event_id: string;
          profile_id: string;
          status: Database["public"]["Enums"]["event_status"];
          guests?: number;
          source?: Database["public"]["Enums"]["attendance_source"];
          updated_at?: string;
        };
        Update: {
          event_id?: string;
          profile_id?: string;
          status?: Database["public"]["Enums"]["event_status"];
          guests?: number;
          source?: Database["public"]["Enums"]["attendance_source"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_participations_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "club_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_participations_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      holidays: {
        Row: {
          id: string;
          bundesland: string;
          kind: Database["public"]["Enums"]["holiday_kind"];
          name: string;
          start_date: string;
          end_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          bundesland: string;
          kind: Database["public"]["Enums"]["holiday_kind"];
          name: string;
          start_date: string;
          end_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          bundesland?: string;
          kind?: Database["public"]["Enums"]["holiday_kind"];
          name?: string;
          start_date?: string;
          end_date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      key_handovers: {
        Row: {
          id: string;
          key_id: string;
          from_profile_id: string | null;
          to_profile_id: string | null;
          recorded_by: string | null;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          key_id: string;
          from_profile_id?: string | null;
          to_profile_id?: string | null;
          recorded_by?: string | null;
          note?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          key_id?: string;
          from_profile_id?: string | null;
          to_profile_id?: string | null;
          recorded_by?: string | null;
          note?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "key_handovers_key_id_fkey";
            columns: ["key_id"];
            isOneToOne: false;
            referencedRelation: "keys";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "key_handovers_from_profile_id_fkey";
            columns: ["from_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "key_handovers_to_profile_id_fkey";
            columns: ["to_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "key_handovers_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      keys: {
        Row: {
          id: string;
          name: string;
          venue_id: string | null;
          responsible_id: string;
          holder_id: string | null;
          no_forwarding: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          venue_id?: string | null;
          responsible_id: string;
          holder_id?: string | null;
          no_forwarding?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          venue_id?: string | null;
          responsible_id?: string;
          holder_id?: string | null;
          no_forwarding?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "keys_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "keys_responsible_id_fkey";
            columns: ["responsible_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "keys_holder_id_fkey";
            columns: ["holder_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      match_reminders: {
        Row: {
          match_id: string;
          profile_id: string;
          match_version: number;
          sent_at: string;
        };
        Insert: {
          match_id: string;
          profile_id: string;
          match_version: number;
          sent_at?: string;
        };
        Update: {
          match_id?: string;
          profile_id?: string;
          match_version?: number;
          sent_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_reminders_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_reminders_profile_id_fkey";
            columns: ["profile_id"];
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
      news: {
        Row: {
          id: string;
          title: string;
          body_html: string;
          published_at: string;
          pinned: boolean;
          author_id: string | null;
          created_at: string;
          updated_at: string;
          announced_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          body_html?: string;
          published_at?: string;
          pinned?: boolean;
          author_id?: string | null;
          created_at?: string;
          updated_at?: string;
          announced_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          body_html?: string;
          published_at?: string;
          pinned?: boolean;
          author_id?: string | null;
          created_at?: string;
          updated_at?: string;
          announced_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "news_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          profile_id: string;
          type: string;
          email: boolean;
          push: boolean;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          type: string;
          email?: boolean;
          push?: boolean;
          updated_at?: string;
        };
        Update: {
          profile_id?: string;
          type?: string;
          email?: boolean;
          push?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_preferences_type_fkey";
            columns: ["type"];
            isOneToOne: false;
            referencedRelation: "notification_templates";
            referencedColumns: ["type"];
          },
        ];
      };
      notification_templates: {
        Row: {
          type: string;
          label: string;
          subject_tpl: string;
          body_tpl: string;
          sort_order: number;
          in_matrix: boolean;
          updated_at: string;
        };
        Insert: {
          type: string;
          label: string;
          subject_tpl: string;
          body_tpl: string;
          sort_order?: number;
          in_matrix?: boolean;
          updated_at?: string;
        };
        Update: {
          type?: string;
          label?: string;
          subject_tpl?: string;
          body_tpl?: string;
          sort_order?: number;
          in_matrix?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          profile_id: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          type: string;
          subject: string;
          body_text: string;
          payload: Json;
          status: Database["public"]["Enums"]["notification_status"];
          scheduled_for: string;
          sent_at: string | null;
          attempts: number;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          type: string;
          subject: string;
          body_text: string;
          payload?: Json;
          status?: Database["public"]["Enums"]["notification_status"];
          scheduled_for?: string;
          sent_at?: string | null;
          attempts?: number;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          channel?: Database["public"]["Enums"]["notification_channel"];
          type?: string;
          subject?: string;
          body_text?: string;
          payload?: Json;
          status?: Database["public"]["Enums"]["notification_status"];
          scheduled_for?: string;
          sent_at?: string | null;
          attempts?: number;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      object_messages: {
        Row: {
          id: string;
          object_type: Database["public"]["Enums"]["message_object"];
          object_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          object_type: Database["public"]["Enums"]["message_object"];
          object_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          object_type?: Database["public"]["Enums"]["message_object"];
          object_id?: string;
          author_id?: string | null;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "object_messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      open_reminder_log: {
        Row: {
          profile_id: string;
          sent_on: string;
        };
        Insert: {
          profile_id: string;
          sent_on: string;
        };
        Update: {
          profile_id?: string;
          sent_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "open_reminder_log_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      poll_options: {
        Row: {
          id: string;
          poll_id: string;
          text: string;
          position: number;
        };
        Insert: {
          id?: string;
          poll_id: string;
          text: string;
          position?: number;
        };
        Update: {
          id?: string;
          poll_id?: string;
          text?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
        ];
      };
      poll_targets: {
        Row: {
          poll_id: string;
          team_id: string | null;
          group_id: string | null;
        };
        Insert: {
          poll_id: string;
          team_id?: string | null;
          group_id?: string | null;
        };
        Update: {
          poll_id?: string;
          team_id?: string | null;
          group_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "poll_targets_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "polls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poll_targets_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poll_targets_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      poll_votes: {
        Row: {
          option_id: string;
          profile_id: string;
          created_at: string;
        };
        Insert: {
          option_id: string;
          profile_id: string;
          created_at?: string;
        };
        Update: {
          option_id?: string;
          profile_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "poll_options";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poll_votes_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      polls: {
        Row: {
          id: string;
          title: string;
          details_html: string;
          type: Database["public"]["Enums"]["poll_type"];
          max_answers: number;
          expires_at: string | null;
          hide_results: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          announced_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          details_html?: string;
          type?: Database["public"]["Enums"]["poll_type"];
          max_answers?: number;
          expires_at?: string | null;
          hide_results?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          announced_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          details_html?: string;
          type?: Database["public"]["Enums"]["poll_type"];
          max_answers?: number;
          expires_at?: string | null;
          hide_results?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          announced_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "polls_created_by_fkey";
            columns: ["created_by"];
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
      push_subscriptions: {
        Row: {
          id: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          failures: number;
          last_success_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          failures?: number;
          last_success_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          failures?: number;
          last_success_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reschedule_polls: {
        Row: {
          id: string;
          match_id: string;
          initiated_by: string | null;
          options: string[];
          status: Database["public"]["Enums"]["poll_status"];
          chosen_index: number | null;
          created_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          match_id: string;
          initiated_by?: string | null;
          options: string[];
          status?: Database["public"]["Enums"]["poll_status"];
          chosen_index?: number | null;
          created_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          match_id?: string;
          initiated_by?: string | null;
          options?: string[];
          status?: Database["public"]["Enums"]["poll_status"];
          chosen_index?: number | null;
          created_at?: string;
          closed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reschedule_polls_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reschedule_polls_initiated_by_fkey";
            columns: ["initiated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reschedule_votes: {
        Row: {
          poll_id: string;
          profile_id: string;
          option_index: number;
          available: boolean;
          created_at: string;
        };
        Insert: {
          poll_id: string;
          profile_id: string;
          option_index: number;
          available: boolean;
          created_at?: string;
        };
        Update: {
          poll_id?: string;
          profile_id?: string;
          option_index?: number;
          available?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reschedule_votes_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "reschedule_polls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reschedule_votes_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      substitute_requests: {
        Row: {
          id: string;
          match_id: string;
          match_version: number;
          profile_id: string;
          rank: number | null;
          status: Database["public"]["Enums"]["substitute_status"];
          created_by: Database["public"]["Enums"]["request_origin"];
          requested_at: string;
          expires_at: string;
          answered_at: string | null;
        };
        Insert: {
          id?: string;
          match_id: string;
          match_version: number;
          profile_id: string;
          rank?: number | null;
          status?: Database["public"]["Enums"]["substitute_status"];
          created_by?: Database["public"]["Enums"]["request_origin"];
          requested_at?: string;
          expires_at: string;
          answered_at?: string | null;
        };
        Update: {
          id?: string;
          match_id?: string;
          match_version?: number;
          profile_id?: string;
          rank?: number | null;
          status?: Database["public"]["Enums"]["substitute_status"];
          created_by?: Database["public"]["Enums"]["request_origin"];
          requested_at?: string;
          expires_at?: string;
          answered_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "substitute_requests_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "substitute_requests_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      training_attendance: {
        Row: {
          session_id: string;
          profile_id: string;
          status: Database["public"]["Enums"]["attendance_status"];
          guests: number;
          source: Database["public"]["Enums"]["attendance_source"];
          updated_by: string | null;
          updated_at: string;
          comment: string;
        };
        Insert: {
          session_id: string;
          profile_id: string;
          status: Database["public"]["Enums"]["attendance_status"];
          guests?: number;
          source?: Database["public"]["Enums"]["attendance_source"];
          updated_by?: string | null;
          updated_at?: string;
          comment?: string;
        };
        Update: {
          session_id?: string;
          profile_id?: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          guests?: number;
          source?: Database["public"]["Enums"]["attendance_source"];
          updated_by?: string | null;
          updated_at?: string;
          comment?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_attendance_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "training_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_attendance_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_attendance_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_auto_attendance: {
        Row: {
          profile_id: string;
          training_id: string;
          until_date: string;
          late: boolean;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          training_id: string;
          until_date: string;
          late?: boolean;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          training_id?: string;
          until_date?: string;
          late?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_auto_attendance_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_auto_attendance_training_id_fkey";
            columns: ["training_id"];
            isOneToOne: false;
            referencedRelation: "trainings";
            referencedColumns: ["id"];
          },
        ];
      };
      training_cancellations: {
        Row: {
          id: string;
          training_id: string | null;
          venue_id: string | null;
          from_date: string;
          to_date: string;
          reason: string;
          notify_email: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          training_id?: string | null;
          venue_id?: string | null;
          from_date: string;
          to_date: string;
          reason?: string;
          notify_email?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          training_id?: string | null;
          venue_id?: string | null;
          from_date?: string;
          to_date?: string;
          reason?: string;
          notify_email?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_cancellations_training_id_fkey";
            columns: ["training_id"];
            isOneToOne: false;
            referencedRelation: "trainings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_cancellations_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_cancellations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_members: {
        Row: {
          training_id: string;
          profile_id: string;
          created_at: string;
        };
        Insert: {
          training_id: string;
          profile_id: string;
          created_at?: string;
        };
        Update: {
          training_id?: string;
          profile_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_members_training_id_fkey";
            columns: ["training_id"];
            isOneToOne: false;
            referencedRelation: "trainings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_reminder_filter: {
        Row: {
          profile_id: string;
          training_id: string;
        };
        Insert: {
          profile_id: string;
          training_id: string;
        };
        Update: {
          profile_id?: string;
          training_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_reminder_filter_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_reminder_filter_training_id_fkey";
            columns: ["training_id"];
            isOneToOne: false;
            referencedRelation: "trainings";
            referencedColumns: ["id"];
          },
        ];
      };
      training_sessions: {
        Row: {
          id: string;
          training_id: string;
          session_date: string;
          starts_at: string;
          ends_at: string | null;
          cancelled: boolean;
          cancel_reason: string;
          cancellation_id: string | null;
          reminder_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          training_id: string;
          session_date: string;
          starts_at: string;
          ends_at?: string | null;
          cancelled?: boolean;
          cancel_reason?: string;
          cancellation_id?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          training_id?: string;
          session_date?: string;
          starts_at?: string;
          ends_at?: string | null;
          cancelled?: boolean;
          cancel_reason?: string;
          cancellation_id?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_sessions_training_id_fkey";
            columns: ["training_id"];
            isOneToOne: false;
            referencedRelation: "trainings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_sessions_cancellation_id_fkey";
            columns: ["cancellation_id"];
            isOneToOne: false;
            referencedRelation: "training_cancellations";
            referencedColumns: ["id"];
          },
        ];
      };
      training_statistics_groups: {
        Row: {
          training_id: string;
          group_id: string;
        };
        Insert: {
          training_id: string;
          group_id: string;
        };
        Update: {
          training_id?: string;
          group_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_statistics_groups_training_id_fkey";
            columns: ["training_id"];
            isOneToOne: false;
            referencedRelation: "trainings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_statistics_groups_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      training_trainers: {
        Row: {
          training_id: string;
          profile_id: string;
          created_at: string;
        };
        Insert: {
          training_id: string;
          profile_id: string;
          created_at?: string;
        };
        Update: {
          training_id?: string;
          profile_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_trainers_training_id_fkey";
            columns: ["training_id"];
            isOneToOne: false;
            referencedRelation: "trainings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_trainers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      trainings: {
        Row: {
          id: string;
          name: string;
          type: Database["public"]["Enums"]["training_type"];
          weekday: number;
          time_start: string;
          time_end: string | null;
          venue_id: string | null;
          rhythm: Database["public"]["Enums"]["training_rhythm"];
          start_date: string;
          reminder_hours: number;
          details: string;
          max_participants: number | null;
          is_open: boolean;
          trainer_invites_only: boolean;
          is_incognito: boolean;
          requires_key_owner: boolean;
          skip_public_holidays: boolean;
          skip_school_holidays: boolean;
          hide_in_calendar: boolean;
          auto_cancel_no_trainers: boolean;
          statistics_visibility: Database["public"]["Enums"]["statistics_visibility"];
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type?: Database["public"]["Enums"]["training_type"];
          weekday: number;
          time_start: string;
          time_end?: string | null;
          venue_id?: string | null;
          rhythm?: Database["public"]["Enums"]["training_rhythm"];
          start_date?: string;
          reminder_hours?: number;
          details?: string;
          max_participants?: number | null;
          is_open?: boolean;
          trainer_invites_only?: boolean;
          is_incognito?: boolean;
          requires_key_owner?: boolean;
          skip_public_holidays?: boolean;
          skip_school_holidays?: boolean;
          hide_in_calendar?: boolean;
          auto_cancel_no_trainers?: boolean;
          statistics_visibility?: Database["public"]["Enums"]["statistics_visibility"];
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: Database["public"]["Enums"]["training_type"];
          weekday?: number;
          time_start?: string;
          time_end?: string | null;
          venue_id?: string | null;
          rhythm?: Database["public"]["Enums"]["training_rhythm"];
          start_date?: string;
          reminder_hours?: number;
          details?: string;
          max_participants?: number | null;
          is_open?: boolean;
          trainer_invites_only?: boolean;
          is_incognito?: boolean;
          requires_key_owner?: boolean;
          skip_public_holidays?: boolean;
          skip_school_holidays?: boolean;
          hide_in_calendar?: boolean;
          auto_cancel_no_trainers?: boolean;
          statistics_visibility?: Database["public"]["Enums"]["statistics_visibility"];
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trainings_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
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
      v_birthdays: {
        Row: {
          id: string | null;
          full_name: string | null;
          birthday: string | null;
        };
        Relationships: [];
      };
      v_calendar_items: {
        Row: {
          kind: string | null;
          id: string | null;
          title: string | null;
          starts_at: string | null;
          ends_at: string | null;
          all_day: boolean | null;
          color: string | null;
          venue_id: string | null;
          is_home: boolean | null;
          cancelled: boolean | null;
        };
        Relationships: [];
      };
      v_club_role_members: {
        Row: {
          role_id: string | null;
          profile_id: string | null;
          full_name: string | null;
          user_role: Database["public"]["Enums"]["user_role"] | null;
        };
        Relationships: [];
      };
      v_cron_status: {
        Row: {
          jobid: number | null;
          jobname: string | null;
          schedule: string | null;
          active: boolean | null;
          last_start: string | null;
          last_end: string | null;
          last_status: string | null;
          last_message: string | null;
        };
        Relationships: [];
      };
      v_event_participants: {
        Row: {
          event_id: string | null;
          profile_id: string | null;
          full_name: string | null;
          status: Database["public"]["Enums"]["event_status"] | null;
          guests: number | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      v_keys: {
        Row: {
          id: string | null;
          name: string | null;
          venue_id: string | null;
          venue_name: string | null;
          responsible_id: string | null;
          responsible_name: string | null;
          holder_id: string | null;
          holder_name: string | null;
          no_forwarding: boolean | null;
          active: boolean | null;
          may_hand_over: boolean | null;
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
      v_my_notification_preferences: {
        Row: {
          type: string | null;
          label: string | null;
          sort_order: number | null;
          profile_id: string | null;
          email: boolean | null;
          push: boolean | null;
        };
        Relationships: [];
      };
      v_my_open_polls: {
        Row: {
          id: string | null;
          title: string | null;
          type: Database["public"]["Enums"]["poll_type"] | null;
          expires_at: string | null;
          created_at: string | null;
        };
        Relationships: [];
      };
      v_my_upcoming: {
        Row: {
          profile_id: string | null;
          kind: string | null;
          id: string | null;
          starts_at: string | null;
          ends_at: string | null;
          title: string | null;
          location: string | null;
          my_status: string | null;
          active: boolean | null;
        };
        Relationships: [];
      };
      v_news: {
        Row: {
          id: string | null;
          title: string | null;
          body_html: string | null;
          published_at: string | null;
          pinned: boolean | null;
          author_id: string | null;
          author_name: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      v_object_message_counts: {
        Row: {
          object_type: Database["public"]["Enums"]["message_object"] | null;
          object_id: string | null;
          message_count: number | null;
        };
        Relationships: [];
      };
      v_object_messages: {
        Row: {
          id: string | null;
          object_type: Database["public"]["Enums"]["message_object"] | null;
          object_id: string | null;
          author_id: string | null;
          author_name: string | null;
          body: string | null;
          created_at: string | null;
          updated_at: string | null;
          edited: boolean | null;
        };
        Relationships: [];
      };
      v_open_participations: {
        Row: {
          profile_id: string | null;
          kind: string | null;
          id: string | null;
          starts_at: string | null;
          title: string | null;
        };
        Relationships: [];
      };
      v_poll_results: {
        Row: {
          poll_id: string | null;
          option_id: string | null;
          text: string | null;
          position: number | null;
          votes: number | null;
        };
        Relationships: [];
      };
      v_poll_voters: {
        Row: {
          poll_id: string | null;
          option_id: string | null;
          profile_id: string | null;
          full_name: string | null;
        };
        Relationships: [];
      };
      v_reschedule_results: {
        Row: {
          poll_id: string | null;
          match_id: string | null;
          status: Database["public"]["Enums"]["poll_status"] | null;
          chosen_index: number | null;
          option_index: number | null;
          option_at: string | null;
          available_count: number | null;
          unavailable_count: number | null;
        };
        Relationships: [];
      };
      v_session_counts: {
        Row: {
          session_id: string | null;
          training_id: string | null;
          yes_count: number | null;
          late_count: number | null;
          no_count: number | null;
          guest_count: number | null;
        };
        Relationships: [];
      };
      v_session_keys: {
        Row: {
          session_id: string | null;
          has_key_holder: boolean | null;
          holder_name: string | null;
        };
        Relationships: [];
      };
      v_session_participants: {
        Row: {
          session_id: string | null;
          training_id: string | null;
          profile_id: string | null;
          full_name: string | null;
          status: Database["public"]["Enums"]["attendance_status"] | null;
          guests: number | null;
          source: Database["public"]["Enums"]["attendance_source"] | null;
          updated_at: string | null;
          comment: string | null;
        };
        Relationships: [];
      };
      v_substitute_requests: {
        Row: {
          id: string | null;
          match_id: string | null;
          match_version: number | null;
          profile_id: string | null;
          rank: number | null;
          status: Database["public"]["Enums"]["substitute_status"] | null;
          created_by: Database["public"]["Enums"]["request_origin"] | null;
          requested_at: string | null;
          expires_at: string | null;
          answered_at: string | null;
          full_name: string | null;
          current_version: boolean | null;
        };
        Relationships: [];
      };
      v_training_statistics: {
        Row: {
          training_id: string | null;
          training_name: string | null;
          profile_id: string | null;
          full_name: string | null;
          session_date: string | null;
          status: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      berlin_today: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      can_see_absences: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      can_see_message_object: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      can_see_training: {
        Args: { [key: string]: unknown };
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
      is_playing_member: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      is_poll_target: {
        Args: { [key: string]: unknown };
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
      may_hand_over_key: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      may_join_training: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      may_see_poll_results: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      may_see_session_roster: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      may_see_training_roster: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      may_see_training_statistics: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_activate_member: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_admin_members: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      rpc_announce_news: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_announce_poll: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_answer_action_token: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_answer_substitute_request: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_apply_reschedule: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_cancel_substitute_request: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_close_reschedule_poll: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_create_substitute_request: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_delete_my_account: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      rpc_describe_action_token: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_hand_over_key: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_manage_player: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_my_calendar_token: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      rpc_my_profile: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      rpc_reset_calendar_token: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      rpc_retract_poll_vote: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_retry_notification: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_run_retention: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      rpc_set_event_participation: {
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
      rpc_set_training_attendance: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_share_lineup: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_start_reschedule_poll: {
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
      rpc_vote_poll: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      rpc_vote_reschedule: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      trains: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      trains_session: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
      valid_email_list: {
        Args: { [key: string]: unknown };
        Returns: unknown;
      };
    };
    CompositeTypes: Record<string, never>;
    Enums: {
      action_token_kind: "match_response" | "substitute_answer" | "event_response" | "poll_vote" | "training_response";
      attendance_source: "auto" | "self" | "trainer" | "link";
      attendance_status: "yes" | "late" | "no";
      event_status: "yes" | "no";
      gender: "male" | "female" | "unspecified";
      holiday_kind: "public" | "school";
      lineup_mode: "fixed" | "open";
      match_source: "ics" | "manual";
      member_status: "active" | "pending_approval" | "unconfirmed";
      message_object: "match" | "session" | "event";
      notification_channel: "email" | "push";
      notification_status: "pending" | "sending" | "sent" | "failed" | "skipped";
      participation_response: "none" | "yes" | "no" | "unclear";
      participation_source: "auto" | "self" | "leader" | "request" | "link";
      poll_status: "open" | "closed" | "applied";
      poll_type: "vote" | "persons";
      ranking_type: "men" | "women" | "seniors_40" | "seniors_50" | "seniors_60" | "seniors_70" | "seniors_75" | "youth_19" | "youth_15" | "youth_13" | "youth_11" | "girls_19" | "girls_15" | "girls_13" | "girls_11";
      request_origin: "system" | "leader";
      statistics_visibility: "all" | "admins" | "groups";
      substitute_mode: "sequential" | "parallel" | "manual";
      substitute_status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
      sync_status: "pending" | "success" | "warning" | "failed";
      team_member_kind: "regular" | "substitute";
      training_rhythm: "weekly" | "biweekly" | "monthly";
      training_type: "adults" | "youth";
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
