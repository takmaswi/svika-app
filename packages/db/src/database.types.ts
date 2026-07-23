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
      anomaly_flags: {
        Row: {
          created_at: string
          detail: Json
          id: string
          kind: string
          owner_id: string | null
          route_id: string | null
          severity: string
          ticket_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          kind: string
          owner_id?: string | null
          route_id?: string | null
          severity?: string
          ticket_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          owner_id?: string | null
          route_id?: string | null
          severity?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_flags_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomaly_flags_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomaly_flags_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_status"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "anomaly_flags_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      board_codes: {
        Row: {
          code: string
          created_at: string
          direction: Database["public"]["Enums"]["route_direction"]
          id: string
          purpose: string
          route_id: string
          ticket_id: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          code: string
          created_at?: string
          direction: Database["public"]["Enums"]["route_direction"]
          id?: string
          purpose?: string
          route_id: string
          ticket_id: string
          valid_from?: string
          valid_until: string
        }
        Update: {
          code?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["route_direction"]
          id?: string
          purpose?: string
          route_id?: string
          ticket_id?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_codes_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_codes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_status"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "board_codes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      cache_pulls: {
        Row: {
          conductor_id: string
          direction: Database["public"]["Enums"]["route_direction"]
          id: number
          outcome: string
          pulled_at: string
          route_id: string
          row_count: number
        }
        Insert: {
          conductor_id: string
          direction: Database["public"]["Enums"]["route_direction"]
          id?: never
          outcome?: string
          pulled_at?: string
          route_id: string
          row_count: number
        }
        Update: {
          conductor_id?: string
          direction?: Database["public"]["Enums"]["route_direction"]
          id?: never
          outcome?: string
          pulled_at?: string
          route_id?: string
          row_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "cache_pulls_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cache_pulls_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      code_redemption_attempts: {
        Row: {
          attempted_at: string
          client_attempt_id: string | null
          code_entered: string
          conductor_id: string
          direction: Database["public"]["Enums"]["route_direction"] | null
          id: number
          outcome: string
          route_id: string | null
          ticket_id: string | null
        }
        Insert: {
          attempted_at?: string
          client_attempt_id?: string | null
          code_entered: string
          conductor_id: string
          direction?: Database["public"]["Enums"]["route_direction"] | null
          id?: never
          outcome: string
          route_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          attempted_at?: string
          client_attempt_id?: string | null
          code_entered?: string
          conductor_id?: string
          direction?: Database["public"]["Enums"]["route_direction"] | null
          id?: never
          outcome?: string
          route_id?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "code_redemption_attempts_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_redemption_attempts_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_redemption_attempts_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_status"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "code_redemption_attempts_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      conductor_route_assignments: {
        Row: {
          active: boolean
          conductor_id: string
          created_at: string
          id: string
          route_id: string
        }
        Insert: {
          active?: boolean
          conductor_id: string
          created_at?: string
          id?: string
          route_id: string
        }
        Update: {
          active?: boolean
          conductor_id?: string
          created_at?: string
          id?: string
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conductor_route_assignments_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conductor_route_assignments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      conductors: {
        Row: {
          active: boolean
          commission_rate_bps: number
          created_at: string
          id: string
          owner_id: string
          profile_id: string
        }
        Insert: {
          active?: boolean
          commission_rate_bps?: number
          created_at?: string
          id?: string
          owner_id: string
          profile_id: string
        }
        Update: {
          active?: boolean
          commission_rate_bps?: number
          created_at?: string
          id?: string
          owner_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conductors_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conductors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          action: string
          created_at: string
          id: string
          user_id: string
          version: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          user_id: string
          version: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transfers: {
        Row: {
          amount_cents: number
          claim_code: string
          created_at: string
          expires_at: string
          id: string
          sender_id: string
        }
        Insert: {
          amount_cents: number
          claim_code: string
          created_at?: string
          expires_at: string
          id?: string
          sender_id: string
        }
        Update: {
          amount_cents?: number
          claim_code?: string
          created_at?: string
          expires_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_door_attempts: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: never
        }
        Update: {
          created_at?: string
          id?: never
        }
        Relationships: []
      }
      demo_pool: {
        Row: {
          claimed_at: string | null
          created_at: string
          email: string
          persona: string
          profile_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          email: string
          persona: string
          profile_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          email?: string
          persona?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_pool_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_details: {
        Row: {
          medical_aid_name: string | null
          medical_aid_number: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          rider_id: string
          updated_at: string
        }
        Insert: {
          medical_aid_name?: string | null
          medical_aid_number?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          rider_id: string
          updated_at?: string
        }
        Update: {
          medical_aid_name?: string | null
          medical_aid_number?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          rider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_details_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fare_segments: {
        Row: {
          created_at: string
          currency: string
          effective_from: string
          fare_cents: number
          from_stop_id: string
          id: string
          route_id: string
          to_stop_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          effective_from?: string
          fare_cents: number
          from_stop_id: string
          id?: string
          route_id: string
          to_stop_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          effective_from?: string
          fare_cents?: number
          from_stop_id?: string
          id?: string
          route_id?: string
          to_stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fare_segments_from_stop_id_fkey"
            columns: ["from_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fare_segments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fare_segments_to_stop_id_fkey"
            columns: ["to_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_pings: {
        Row: {
          accuracy_m: number | null
          altitude_m: number | null
          heading_deg: number | null
          id: number
          journey_id: string
          lat: number
          leg_index: number
          lng: number
          mode: string
          recorded_at: string
          seq: number
          source: string
          speed_mps: number | null
        }
        Insert: {
          accuracy_m?: number | null
          altitude_m?: number | null
          heading_deg?: number | null
          id?: never
          journey_id: string
          lat: number
          leg_index: number
          lng: number
          mode: string
          recorded_at: string
          seq: number
          source: string
          speed_mps?: number | null
        }
        Update: {
          accuracy_m?: number | null
          altitude_m?: number | null
          heading_deg?: number | null
          id?: never
          journey_id?: string
          lat?: number
          leg_index?: number
          lng?: number
          mode?: string
          recorded_at?: string
          seq?: number
          source?: string
          speed_mps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gps_pings_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journeys: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["route_direction"]
          ended_at: string | null
          id: string
          label: string
          route_id: string
          source: string
          source_ref: string
          started_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          direction: Database["public"]["Enums"]["route_direction"]
          ended_at?: string | null
          id?: string
          label?: string
          route_id: string
          source: string
          source_ref: string
          started_at: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["route_direction"]
          ended_at?: string | null
          id?: string
          label?: string
          route_id?: string
          source?: string
          source_ref?: string
          started_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "journeys_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_accounts: {
        Row: {
          created_at: string
          currency: string
          id: string
          kind: Database["public"]["Enums"]["ledger_account_kind"]
          profile_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          kind: Database["public"]["Enums"]["ledger_account_kind"]
          profile_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          kind?: Database["public"]["Enums"]["ledger_account_kind"]
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_postings: {
        Row: {
          account_id: string
          amount_cents: number
          created_at: string
          id: number
          transaction_id: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          created_at?: string
          id?: never
          transaction_id: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          created_at?: string
          id?: never
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_postings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "ledger_postings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_postings_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["ledger_txn_kind"]
          memo: string | null
          ticket_id: string | null
          transfer_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["ledger_txn_kind"]
          memo?: string | null
          ticket_id?: string | null
          transfer_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ledger_txn_kind"]
          memo?: string | null
          ticket_id?: string | null
          transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_ticket_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_status"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "ledger_transactions_ticket_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "credit_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      offline_sync_receipts: {
        Row: {
          client_event_id: string
          conductor_id: string
          created_at: string
          detail: Json
          event_kind: string
          outcome: string
          ticket_id: string | null
        }
        Insert: {
          client_event_id: string
          conductor_id: string
          created_at?: string
          detail?: Json
          event_kind: string
          outcome: string
          ticket_id?: string | null
        }
        Update: {
          client_event_id?: string
          conductor_id?: string
          created_at?: string
          detail?: Json
          event_kind?: string
          outcome?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offline_sync_receipts_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offline_sync_receipts_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_status"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "offline_sync_receipts_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          created_at: string
          display_name: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          anonymised_at: string | null
          created_at: string
          demo_sim: boolean
          full_name: string
          id: string
          phone: string | null
          preferred_language: Database["public"]["Enums"]["app_language"]
        }
        Insert: {
          anonymised_at?: string | null
          created_at?: string
          demo_sim?: boolean
          full_name?: string
          id: string
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["app_language"]
        }
        Update: {
          anonymised_at?: string | null
          created_at?: string
          demo_sim?: boolean
          full_name?: string
          id?: string
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["app_language"]
        }
        Relationships: []
      }
      ride_shares: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          revoked_at: string | null
          rider_id: string
          ticket_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          rider_id: string
          ticket_id: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          rider_id?: string
          ticket_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_shares_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_shares_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_status"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "ride_shares_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_journey_points: {
        Row: {
          accuracy_m: number | null
          journey_id: string
          lat: number
          lng: number
          recorded_at: string
          seq: number
        }
        Insert: {
          accuracy_m?: number | null
          journey_id: string
          lat: number
          lng: number
          recorded_at: string
          seq: number
        }
        Update: {
          accuracy_m?: number | null
          journey_id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "rider_journey_points_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "rider_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_journeys: {
        Row: {
          consent_version: string
          created_at: string
          distance_m: number | null
          ended_at: string | null
          id: string
          mode: Database["public"]["Enums"]["journey_mode"]
          name: string | null
          rider_id: string
          started_at: string
          status: Database["public"]["Enums"]["journey_status"]
        }
        Insert: {
          consent_version: string
          created_at?: string
          distance_m?: number | null
          ended_at?: string | null
          id: string
          mode?: Database["public"]["Enums"]["journey_mode"]
          name?: string | null
          rider_id: string
          started_at: string
          status?: Database["public"]["Enums"]["journey_status"]
        }
        Update: {
          consent_version?: string
          created_at?: string
          distance_m?: number | null
          ended_at?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["journey_mode"]
          name?: string | null
          rider_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["journey_status"]
        }
        Relationships: [
          {
            foreignKeyName: "rider_journeys_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_prefs: {
        Row: {
          commute_alerts: boolean
          rider_id: string
          updated_at: string
          voice_en: boolean
          voice_sn: boolean
        }
        Insert: {
          commute_alerts?: boolean
          rider_id: string
          updated_at?: string
          voice_en?: boolean
          voice_sn?: boolean
        }
        Update: {
          commute_alerts?: boolean
          rider_id?: string
          updated_at?: string
          voice_en?: boolean
          voice_sn?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rider_prefs_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_fares: {
        Row: {
          created_at: string
          currency: string
          effective_from: string
          fare_cents: number
          id: string
          route_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          effective_from?: string
          fare_cents: number
          id?: string
          route_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          effective_from?: string
          fare_cents?: number
          id?: string
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_fares_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          direction: Database["public"]["Enums"]["route_direction"]
          route_id: string
          seq: number
          stop_id: string
        }
        Insert: {
          direction: Database["public"]["Enums"]["route_direction"]
          route_id: string
          seq: number
          stop_id: string
        }
        Update: {
          direction?: Database["public"]["Enums"]["route_direction"]
          route_id?: string
          seq?: number
          stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          name_sn: string | null
          typical_duration_minutes: number | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          name_sn?: string | null
          typical_duration_minutes?: number | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          name_sn?: string | null
          typical_duration_minutes?: number | null
        }
        Relationships: []
      }
      saved_trips: {
        Row: {
          created_at: string
          from_stop_id: string
          id: string
          nickname: string
          rider_id: string
          to_stop_id: string
        }
        Insert: {
          created_at?: string
          from_stop_id: string
          id?: string
          nickname: string
          rider_id: string
          to_stop_id: string
        }
        Update: {
          created_at?: string
          from_stop_id?: string
          id?: string
          nickname?: string
          rider_id?: string
          to_stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_trips_from_stop_id_fkey"
            columns: ["from_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_trips_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_trips_to_stop_id_fkey"
            columns: ["to_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      segment_times: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["route_direction"]
          duration_seconds: number
          from_stop_id: string
          hour_bucket: number
          id: string
          journey_id: string
          route_id: string
          source: string
          to_stop_id: string
        }
        Insert: {
          created_at?: string
          direction: Database["public"]["Enums"]["route_direction"]
          duration_seconds: number
          from_stop_id: string
          hour_bucket: number
          id?: string
          journey_id: string
          route_id: string
          source: string
          to_stop_id: string
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["route_direction"]
          duration_seconds?: number
          from_stop_id?: string
          hour_bucket?: number
          id?: string
          journey_id?: string
          route_id?: string
          source?: string
          to_stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segment_times_from_stop_id_fkey"
            columns: ["from_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_times_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_times_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_times_to_stop_id_fkey"
            columns: ["to_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      stops: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          name_sn: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          name_sn?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          name_sn?: string | null
        }
        Relationships: []
      }
      ticket_events: {
        Row: {
          actor_profile_id: string | null
          conductor_id: string | null
          created_at: string
          detail: Json
          event_type: Database["public"]["Enums"]["ticket_event_type"]
          id: number
          ticket_id: string
          vehicle_id: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          conductor_id?: string | null
          created_at?: string
          detail?: Json
          event_type: Database["public"]["Enums"]["ticket_event_type"]
          id?: never
          ticket_id: string
          vehicle_id?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          conductor_id?: string | null
          created_at?: string
          detail?: Json
          event_type?: Database["public"]["Enums"]["ticket_event_type"]
          id?: never
          ticket_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_status"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          currency: string
          direction: Database["public"]["Enums"]["route_direction"]
          fare_cents: number
          from_stop_id: string | null
          id: string
          kind: Database["public"]["Enums"]["ticket_kind"]
          payment_method: string
          purchased_at: string
          rider_id: string
          route_id: string
          to_stop_id: string | null
        }
        Insert: {
          currency?: string
          direction: Database["public"]["Enums"]["route_direction"]
          fare_cents: number
          from_stop_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ticket_kind"]
          payment_method?: string
          purchased_at?: string
          rider_id: string
          route_id: string
          to_stop_id?: string | null
        }
        Update: {
          currency?: string
          direction?: Database["public"]["Enums"]["route_direction"]
          fare_cents?: number
          from_stop_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ticket_kind"]
          payment_method?: string
          purchased_at?: string
          rider_id?: string
          route_id?: string
          to_stop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_from_stop_id_fkey"
            columns: ["from_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_to_stop_id_fkey"
            columns: ["to_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_claim_attempts: {
        Row: {
          attempted_at: string
          claimer_id: string
          code_entered: string
          id: number
          outcome: string
          transfer_id: string | null
        }
        Insert: {
          attempted_at?: string
          claimer_id: string
          code_entered: string
          id?: never
          outcome: string
          transfer_id?: string | null
        }
        Update: {
          attempted_at?: string
          claimer_id?: string
          code_entered?: string
          id?: never
          outcome?: string
          transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfer_claim_attempts_claimer_id_fkey"
            columns: ["claimer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_claim_attempts_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "credit_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_events: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["transfer_event_type"]
          id: number
          transfer_id: string
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["transfer_event_type"]
          id?: never
          transfer_id: string
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["transfer_event_type"]
          id?: never
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_events_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "credit_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_points: {
        Row: {
          created_at: string
          from_stop_id: string
          id: string
          kind: string
          notes: string | null
          to_stop_id: string
          walk_meters: number
          walk_minutes: number
        }
        Insert: {
          created_at?: string
          from_stop_id: string
          id?: string
          kind: string
          notes?: string | null
          to_stop_id: string
          walk_meters: number
          walk_minutes: number
        }
        Update: {
          created_at?: string
          from_stop_id?: string
          id?: string
          kind?: string
          notes?: string | null
          to_stop_id?: string
          walk_meters?: number
          walk_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "transfer_points_from_stop_id_fkey"
            columns: ["from_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_points_to_stop_id_fkey"
            columns: ["to_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          capacity: number | null
          created_at: string
          id: string
          owner_id: string
          plate: string
        }
        Insert: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          id?: string
          owner_id: string
          plate: string
        }
        Update: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          id?: string
          owner_id?: string
          plate?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      watchdog_day_flags: {
        Row: {
          created_at: string
          data_source: string
          day: string
          digital_share: number
          engine: string
          explanation_en: string | null
          explanation_sn: string | null
          flagged: boolean
          id: string
          injected_leakage: string | null
          owner_id: string
          peak_share: number
          route_id: string
          score: number
          threshold_flagged: boolean
          tickets: number
          tickets_ratio: number
          worst_vehicle_ratio: number
        }
        Insert: {
          created_at?: string
          data_source?: string
          day: string
          digital_share: number
          engine: string
          explanation_en?: string | null
          explanation_sn?: string | null
          flagged: boolean
          id?: string
          injected_leakage?: string | null
          owner_id: string
          peak_share: number
          route_id: string
          score: number
          threshold_flagged?: boolean
          tickets: number
          tickets_ratio: number
          worst_vehicle_ratio: number
        }
        Update: {
          created_at?: string
          data_source?: string
          day?: string
          digital_share?: number
          engine?: string
          explanation_en?: string | null
          explanation_sn?: string | null
          flagged?: boolean
          id?: string
          injected_leakage?: string | null
          owner_id?: string
          peak_share?: number
          route_id?: string
          score?: number
          threshold_flagged?: boolean
          tickets?: number
          tickets_ratio?: number
          worst_vehicle_ratio?: number
        }
        Relationships: [
          {
            foreignKeyName: "watchdog_day_flags_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchdog_day_flags_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      watchdog_staged_day_flags: {
        Row: {
          created_at: string
          day: string
          digital_share: number
          engine: string
          explanation_en: string | null
          explanation_sn: string | null
          flagged: boolean
          id: string
          injected_leakage: string | null
          owner_id: string
          peak_share: number
          route_id: string
          score: number
          threshold_flagged: boolean
          tickets: number
          tickets_ratio: number
          variant: string
          worst_vehicle_ratio: number
        }
        Insert: {
          created_at?: string
          day: string
          digital_share: number
          engine: string
          explanation_en?: string | null
          explanation_sn?: string | null
          flagged: boolean
          id?: string
          injected_leakage?: string | null
          owner_id: string
          peak_share: number
          route_id: string
          score: number
          threshold_flagged?: boolean
          tickets: number
          tickets_ratio: number
          variant: string
          worst_vehicle_ratio: number
        }
        Update: {
          created_at?: string
          day?: string
          digital_share?: number
          engine?: string
          explanation_en?: string | null
          explanation_sn?: string | null
          flagged?: boolean
          id?: string
          injected_leakage?: string | null
          owner_id?: string
          peak_share?: number
          route_id?: string
          score?: number
          threshold_flagged?: boolean
          tickets?: number
          tickets_ratio?: number
          variant?: string
          worst_vehicle_ratio?: number
        }
        Relationships: [
          {
            foreignKeyName: "watchdog_staged_day_flags_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchdog_staged_day_flags_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      watchdog_staged_vehicle_days: {
        Row: {
          created_at: string
          day: string
          digital_tickets: number
          gross_cents: number
          id: string
          injected_leakage: string | null
          owner_id: string
          peak_tickets: number
          route_id: string
          tickets: number
          variant: string
          vehicle_label: string
        }
        Insert: {
          created_at?: string
          day: string
          digital_tickets: number
          gross_cents: number
          id?: string
          injected_leakage?: string | null
          owner_id: string
          peak_tickets: number
          route_id: string
          tickets: number
          variant: string
          vehicle_label: string
        }
        Update: {
          created_at?: string
          day?: string
          digital_tickets?: number
          gross_cents?: number
          id?: string
          injected_leakage?: string | null
          owner_id?: string
          peak_tickets?: number
          route_id?: string
          tickets?: number
          variant?: string
          vehicle_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchdog_staged_vehicle_days_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchdog_staged_vehicle_days_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      watchdog_vehicle_days: {
        Row: {
          created_at: string
          data_source: string
          day: string
          digital_tickets: number
          gross_cents: number
          id: string
          injected_leakage: string | null
          owner_id: string
          peak_tickets: number
          route_id: string
          tickets: number
          vehicle_label: string
        }
        Insert: {
          created_at?: string
          data_source?: string
          day: string
          digital_tickets: number
          gross_cents: number
          id?: string
          injected_leakage?: string | null
          owner_id: string
          peak_tickets: number
          route_id: string
          tickets: number
          vehicle_label: string
        }
        Update: {
          created_at?: string
          data_source?: string
          day?: string
          digital_tickets?: number
          gross_cents?: number
          id?: string
          injected_leakage?: string | null
          owner_id?: string
          peak_tickets?: number
          route_id?: string
          tickets?: number
          vehicle_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchdog_vehicle_days_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchdog_vehicle_days_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          balance_cents: number | null
          currency: string | null
          kind: Database["public"]["Enums"]["ledger_account_kind"] | null
          profile_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_status: {
        Row: {
          direction: Database["public"]["Enums"]["route_direction"] | null
          fare_cents: number | null
          rider_id: string | null
          route_id: string | null
          status: Database["public"]["Enums"]["ticket_event_type"] | null
          status_at: string | null
          ticket_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      anonymise_me: { Args: never; Returns: undefined }
      append_rider_journey_points: {
        Args: { p_journey: string; p_points: Json }
        Returns: number
      }
      assert_plausible_fare: { Args: { p_fare: number }; Returns: number }
      cancel_transfer: { Args: { p_transfer: string }; Returns: undefined }
      claim_credit: {
        Args: { p_code: string }
        Returns: {
          amount_cents: number
          outcome: string
        }[]
      }
      claim_demo_persona: { Args: never; Returns: string }
      complete_rider_journey: {
        Args: {
          p_distance_m: number
          p_ended_at: string
          p_journey: string
          p_mode: Database["public"]["Enums"]["journey_mode"]
          p_name: string
        }
        Returns: undefined
      }
      create_ride_share: {
        Args: { p_ticket: string }
        Returns: {
          share_expires_at: string
          share_token: string
        }[]
      }
      current_fare_cents: { Args: { p_route: string }; Returns: number }
      delete_emergency_details: {
        Args: { p_consent_version: string }
        Returns: undefined
      }
      demo_reset_mine: {
        Args: { p_consent_version: string }
        Returns: undefined
      }
      demo_watchdog_set_day: {
        Args: { p_variant: string }
        Returns: string
      }
      discard_rider_journey: { Args: { p_journey: string }; Returns: undefined }
      kombi_board: {
        Args: never
        Returns: {
          capacity: number
          drift_days_30d: number
          fare_days_30d: number
          last_verified_at: string
          peak_hour_load_30d: number
          plate: string
          verified_fares_30d: number
        }[]
      }
      log_offline_attempts: { Args: { p_attempts: Json }; Returns: number }
      owner_revenue_summary: {
        Args: never
        Returns: {
          commission_cents: number
          day: string
          gross_cents: number
          net_cents: number
          route_code: string
          route_name: string
          tickets: number
        }[]
      }
      pull_offline_cache: {
        Args: {
          p_direction: Database["public"]["Enums"]["route_direction"]
          p_route: string
        }
        Returns: {
          code_hash: string
          code_salt: string
          fare_cents: number
          kind: string
          outcome: string
          payment_method: string
          purpose: string
          server_time: string
          ticket_id: string
          valid_from: string
          valid_until: string
        }[]
      }
      purchase_parcel: {
        Args: {
          p_direction: Database["public"]["Enums"]["route_direction"]
          p_from_stop: string
          p_payment?: string
          p_route: string
          p_to_stop: string
          p_valid_minutes?: number
        }
        Returns: {
          collect_code: string
          fare_cents: number
          load_code: string
          ticket_id: string
          valid_until: string
        }[]
      }
      purchase_ticket: {
        Args: {
          p_direction: Database["public"]["Enums"]["route_direction"]
          p_from_stop?: string
          p_payment?: string
          p_route: string
          p_to_stop?: string
          p_valid_minutes?: number
        }
        Returns: {
          board_code: string
          fare_cents: number
          ticket_id: string
          valid_until: string
        }[]
      }
      record_change_credit: {
        Args: {
          p_covered_fares?: number
          p_note_cents: number
          p_ticket: string
        }
        Returns: {
          change_cents: number
        }[]
      }
      record_topup: {
        Args: { p_amount_cents: number; p_memo?: string; p_profile: string }
        Returns: string
      }
      redeem_board_code: {
        Args: {
          p_code: string
          p_direction: Database["public"]["Enums"]["route_direction"]
          p_route: string
          p_vehicle?: string
        }
        Returns: {
          fare_cents: number
          outcome: string
          payment_method: string
          stage: string
          ticket_id: string
        }[]
      }
      reset_conductor_attempt_log: {
        Args: { p_profile: string }
        Returns: number
      }
      revoke_ride_share: { Args: { p_share: string }; Returns: undefined }
      ride_share_view: {
        Args: { p_token: string }
        Returns: {
          direction: Database["public"]["Enums"]["route_direction"]
          from_stop_id: string
          from_stop_name: string
          route_code: string
          route_name: string
          share_expires_at: string
          to_stop_id: string
          to_stop_name: string
          trip_status: string
        }[]
      }
      save_emergency_details: {
        Args: {
          p_consent_version: string
          p_medical_aid_name: string
          p_medical_aid_number: string
          p_next_of_kin_name: string
          p_next_of_kin_phone: string
        }
        Returns: undefined
      }
      segment_fare_cents: {
        Args: { p_from: string; p_route: string; p_to: string }
        Returns: number
      }
      send_credit: {
        Args: { p_amount_cents: number }
        Returns: {
          claim_code: string
          expires_at: string
          transfer_id: string
        }[]
      }
      sync_offline_change_credit: {
        Args: {
          p_client_event_id: string
          p_covered_fares: number
          p_note_cents: number
          p_recorded_at: string
          p_ticket: string
        }
        Returns: {
          change_cents: number
          outcome: string
        }[]
      }
      sync_offline_redemption: {
        Args: {
          p_client_event_id: string
          p_code: string
          p_direction: Database["public"]["Enums"]["route_direction"]
          p_redeemed_at: string
          p_route: string
          p_vehicle?: string
        }
        Returns: {
          fare_cents: number
          flagged: boolean
          outcome: string
          payment_method: string
          stage: string
          ticket_id: string
        }[]
      }
      upsert_rider_journey: {
        Args: {
          p_journey: string
          p_mode: Database["public"]["Enums"]["journey_mode"]
          p_started_at: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_language: "en" | "sn"
      journey_mode: "kombi" | "walk" | "mixed"
      journey_status: "recording" | "complete" | "discarded"
      ledger_account_kind:
        | "rider_wallet"
        | "conductor_wallet"
        | "owner_wallet"
        | "platform_escrow"
        | "platform_fees"
        | "external_cash"
      ledger_txn_kind:
        | "topup"
        | "ticket_purchase"
        | "fare_settlement"
        | "refund"
        | "adjustment"
        | "change_credit"
        | "transfer_send"
        | "transfer_claim"
        | "transfer_cancel"
      route_direction: "outbound" | "inbound"
      ticket_event_type:
        | "issued"
        | "redeemed"
        | "cancelled"
        | "expired"
        | "refunded"
        | "loaded"
        | "collected"
      ticket_kind: "fare" | "parcel"
      transfer_event_type: "sent" | "claimed" | "cancelled"
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
      app_language: ["en", "sn"],
      journey_mode: ["kombi", "walk", "mixed"],
      journey_status: ["recording", "complete", "discarded"],
      ledger_account_kind: [
        "rider_wallet",
        "conductor_wallet",
        "owner_wallet",
        "platform_escrow",
        "platform_fees",
        "external_cash",
      ],
      ledger_txn_kind: [
        "topup",
        "ticket_purchase",
        "fare_settlement",
        "refund",
        "adjustment",
        "change_credit",
        "transfer_send",
        "transfer_claim",
        "transfer_cancel",
      ],
      route_direction: ["outbound", "inbound"],
      ticket_event_type: [
        "issued",
        "redeemed",
        "cancelled",
        "expired",
        "refunded",
        "loaded",
        "collected",
      ],
      ticket_kind: ["fare", "parcel"],
      transfer_event_type: ["sent", "claimed", "cancelled"],
    },
  },
} as const
