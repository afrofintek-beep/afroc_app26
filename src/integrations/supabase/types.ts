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
      administrative_divisions: {
        Row: {
          code: string
          country_code: string
          created_at: string
          created_by_user_id: string | null
          id: string
          level: number
          metadata: Json | null
          name: string
          parent_code: string | null
          parent_level: number | null
          updated_at: string
        }
        Insert: {
          code: string
          country_code: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          level: number
          metadata?: Json | null
          name: string
          parent_code?: string | null
          parent_level?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          country_code?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          level?: number
          metadata?: Json | null
          name?: string
          parent_code?: string | null
          parent_level?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      afroloc_addresses: {
        Row: {
          address_id: string
          administrative_area: string | null
          building_name: string | null
          country_code: string
          created_at: string
          dependent_locality: string | null
          id: string
          lat: number | null
          locality: string | null
          lon: number | null
          place_name: string | null
          post_code: string | null
          precision_level: string | null
          premise_number: string | null
          sub_premise_id: string | null
          sub_premise_type: string | null
          thoroughfare_name: string | null
          thoroughfare_type: string | null
          tile_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_id: string
          administrative_area?: string | null
          building_name?: string | null
          country_code: string
          created_at?: string
          dependent_locality?: string | null
          id?: string
          lat?: number | null
          locality?: string | null
          lon?: number | null
          place_name?: string | null
          post_code?: string | null
          precision_level?: string | null
          premise_number?: string | null
          sub_premise_id?: string | null
          sub_premise_type?: string | null
          thoroughfare_name?: string | null
          thoroughfare_type?: string | null
          tile_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_id?: string
          administrative_area?: string | null
          building_name?: string | null
          country_code?: string
          created_at?: string
          dependent_locality?: string | null
          id?: string
          lat?: number | null
          locality?: string | null
          lon?: number | null
          place_name?: string | null
          post_code?: string | null
          precision_level?: string | null
          premise_number?: string | null
          sub_premise_id?: string | null
          sub_premise_type?: string | null
          thoroughfare_name?: string | null
          thoroughfare_type?: string | null
          tile_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      afroloc_checkins: {
        Row: {
          accuracy_meters: number | null
          afroloc_record_id: string
          checked_in_at: string
          cooldown_expires_at: string | null
          created_at: string
          device_fingerprint: string | null
          device_info: Json | null
          distance_from_address_meters: number | null
          geo_lat: number
          geo_lon: number
          id: string
          is_valid: boolean | null
          rejection_reason: string | null
          user_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          afroloc_record_id: string
          checked_in_at?: string
          cooldown_expires_at?: string | null
          created_at?: string
          device_fingerprint?: string | null
          device_info?: Json | null
          distance_from_address_meters?: number | null
          geo_lat: number
          geo_lon: number
          id?: string
          is_valid?: boolean | null
          rejection_reason?: string | null
          user_id: string
        }
        Update: {
          accuracy_meters?: number | null
          afroloc_record_id?: string
          checked_in_at?: string
          cooldown_expires_at?: string | null
          created_at?: string
          device_fingerprint?: string | null
          device_info?: Json | null
          distance_from_address_meters?: number | null
          geo_lat?: number
          geo_lon?: number
          id?: string
          is_valid?: boolean | null
          rejection_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_checkins_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      afroloc_delivery_audit_log: {
        Row: {
          action: string
          created_at: string | null
          delivery_point_id: string | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          delivery_point_id?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          delivery_point_id?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_delivery_audit_log_delivery_point_id_fkey"
            columns: ["delivery_point_id"]
            isOneToOne: false
            referencedRelation: "afroloc_delivery_points"
            referencedColumns: ["id"]
          },
        ]
      }
      afroloc_delivery_points: {
        Row: {
          afroloc_record_id: string
          confirmed_at: string | null
          created_at: string | null
          geo_lat: number | null
          geo_lon: number | null
          id: string
          is_primary: boolean | null
          metadata: Json | null
          operator_id: string
          otp_attempts: number | null
          otp_code: string | null
          otp_expires_at: string | null
          point_address: string | null
          point_code: string
          point_name: string | null
          point_type: Database["public"]["Enums"]["delivery_point_type"]
          revoked_at: string | null
          revoked_reason: string | null
          status: Database["public"]["Enums"]["delivery_point_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          afroloc_record_id: string
          confirmed_at?: string | null
          created_at?: string | null
          geo_lat?: number | null
          geo_lon?: number | null
          id?: string
          is_primary?: boolean | null
          metadata?: Json | null
          operator_id: string
          otp_attempts?: number | null
          otp_code?: string | null
          otp_expires_at?: string | null
          point_address?: string | null
          point_code: string
          point_name?: string | null
          point_type: Database["public"]["Enums"]["delivery_point_type"]
          revoked_at?: string | null
          revoked_reason?: string | null
          status?: Database["public"]["Enums"]["delivery_point_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          afroloc_record_id?: string
          confirmed_at?: string | null
          created_at?: string | null
          geo_lat?: number | null
          geo_lon?: number | null
          id?: string
          is_primary?: boolean | null
          metadata?: Json | null
          operator_id?: string
          otp_attempts?: number | null
          otp_code?: string | null
          otp_expires_at?: string | null
          point_address?: string | null
          point_code?: string
          point_name?: string | null
          point_type?: Database["public"]["Enums"]["delivery_point_type"]
          revoked_at?: string | null
          revoked_reason?: string | null
          status?: Database["public"]["Enums"]["delivery_point_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_delivery_points_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afroloc_delivery_points_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "afroloc_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      afroloc_gps_history: {
        Row: {
          accuracy_meters: number | null
          afroloc_record_id: string
          created_at: string
          device_info: Json | null
          distance_meters: number | null
          id: string
          new_lat: number
          new_lon: number
          photo_path: string | null
          previous_lat: number | null
          previous_lon: number | null
          update_reason: string | null
          user_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          afroloc_record_id: string
          created_at?: string
          device_info?: Json | null
          distance_meters?: number | null
          id?: string
          new_lat: number
          new_lon: number
          photo_path?: string | null
          previous_lat?: number | null
          previous_lon?: number | null
          update_reason?: string | null
          user_id: string
        }
        Update: {
          accuracy_meters?: number | null
          afroloc_record_id?: string
          created_at?: string
          device_info?: Json | null
          distance_meters?: number | null
          id?: string
          new_lat?: number
          new_lon?: number
          photo_path?: string | null
          previous_lat?: number | null
          previous_lon?: number | null
          update_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_gps_history_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      afroloc_gps_history_archive: {
        Row: {
          accuracy_meters: number | null
          afroloc_record_id: string
          archived_at: string
          created_at: string
          device_info: Json | null
          distance_meters: number | null
          id: string
          new_lat: number
          new_lon: number
          photo_path: string | null
          previous_lat: number | null
          previous_lon: number | null
          update_reason: string | null
          user_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          afroloc_record_id: string
          archived_at?: string
          created_at?: string
          device_info?: Json | null
          distance_meters?: number | null
          id?: string
          new_lat: number
          new_lon: number
          photo_path?: string | null
          previous_lat?: number | null
          previous_lon?: number | null
          update_reason?: string | null
          user_id: string
        }
        Update: {
          accuracy_meters?: number | null
          afroloc_record_id?: string
          archived_at?: string
          created_at?: string
          device_info?: Json | null
          distance_meters?: number | null
          id?: string
          new_lat?: number
          new_lon?: number
          photo_path?: string | null
          previous_lat?: number | null
          previous_lon?: number | null
          update_reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      afroloc_operators: {
        Row: {
          api_endpoint: string | null
          api_key_encrypted: string | null
          code: string
          contact_email: string | null
          contact_phone: string | null
          country_code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_path: string | null
          metadata: Json | null
          name: string
          operator_type: string
          updated_at: string | null
        }
        Insert: {
          api_endpoint?: string | null
          api_key_encrypted?: string | null
          code: string
          contact_email?: string | null
          contact_phone?: string | null
          country_code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_path?: string | null
          metadata?: Json | null
          name: string
          operator_type?: string
          updated_at?: string | null
        }
        Update: {
          api_endpoint?: string | null
          api_key_encrypted?: string | null
          code?: string
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_path?: string | null
          metadata?: Json | null
          name?: string
          operator_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      afroloc_record_versions: {
        Row: {
          change_reason: string | null
          changed_by_user_id: string | null
          changed_fields: string[]
          created_at: string
          id: string
          record_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          change_reason?: string | null
          changed_by_user_id?: string | null
          changed_fields?: string[]
          created_at?: string
          id?: string
          record_id: string
          snapshot: Json
          version?: number
        }
        Update: {
          change_reason?: string | null
          changed_by_user_id?: string | null
          changed_fields?: string[]
          created_at?: string
          id?: string
          record_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_record_versions_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      afroloc_records: {
        Row: {
          address_type: string | null
          approved_at: string | null
          approved_by_user_id: string | null
          batch_id: string | null
          checkin_streak: number | null
          code: string
          country: string
          created_at: string | null
          geo_lat: number | null
          geo_lon: number | null
          gps_validated_at: string | null
          gps_validated_by_user_id: string | null
          gps_validation_notes: string | null
          id: string
          is_primary_residence: boolean | null
          last_checkin_at: string | null
          last_verified_at: string | null
          level1_code: string | null
          level1_name: string | null
          level2_code: string | null
          level2_name: string | null
          level3_code: string | null
          level3_name: string | null
          level4_code: string | null
          level4_name: string | null
          metadata: Json | null
          missed_checkins: number | null
          next_checkin_due: string | null
          next_verification_due: string | null
          number: string | null
          photo_exif_device_make: string | null
          photo_exif_device_model: string | null
          photo_exif_gps_lat: number | null
          photo_exif_gps_lon: number | null
          photo_exif_timestamp: string | null
          photo_metadata: Json | null
          property_name: string | null
          property_type: string | null
          registered_by_user_id: string | null
          status: Database["public"]["Enums"]["afroloc_status"] | null
          street_code: string | null
          street_name: string | null
          unit: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address_type?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          batch_id?: string | null
          checkin_streak?: number | null
          code: string
          country: string
          created_at?: string | null
          geo_lat?: number | null
          geo_lon?: number | null
          gps_validated_at?: string | null
          gps_validated_by_user_id?: string | null
          gps_validation_notes?: string | null
          id?: string
          is_primary_residence?: boolean | null
          last_checkin_at?: string | null
          last_verified_at?: string | null
          level1_code?: string | null
          level1_name?: string | null
          level2_code?: string | null
          level2_name?: string | null
          level3_code?: string | null
          level3_name?: string | null
          level4_code?: string | null
          level4_name?: string | null
          metadata?: Json | null
          missed_checkins?: number | null
          next_checkin_due?: string | null
          next_verification_due?: string | null
          number?: string | null
          photo_exif_device_make?: string | null
          photo_exif_device_model?: string | null
          photo_exif_gps_lat?: number | null
          photo_exif_gps_lon?: number | null
          photo_exif_timestamp?: string | null
          photo_metadata?: Json | null
          property_name?: string | null
          property_type?: string | null
          registered_by_user_id?: string | null
          status?: Database["public"]["Enums"]["afroloc_status"] | null
          street_code?: string | null
          street_name?: string | null
          unit?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address_type?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          batch_id?: string | null
          checkin_streak?: number | null
          code?: string
          country?: string
          created_at?: string | null
          geo_lat?: number | null
          geo_lon?: number | null
          gps_validated_at?: string | null
          gps_validated_by_user_id?: string | null
          gps_validation_notes?: string | null
          id?: string
          is_primary_residence?: boolean | null
          last_checkin_at?: string | null
          last_verified_at?: string | null
          level1_code?: string | null
          level1_name?: string | null
          level2_code?: string | null
          level2_name?: string | null
          level3_code?: string | null
          level3_name?: string | null
          level4_code?: string | null
          level4_name?: string | null
          metadata?: Json | null
          missed_checkins?: number | null
          next_checkin_due?: string | null
          next_verification_due?: string | null
          number?: string | null
          photo_exif_device_make?: string | null
          photo_exif_device_model?: string | null
          photo_exif_gps_lat?: number | null
          photo_exif_gps_lon?: number | null
          photo_exif_timestamp?: string | null
          photo_metadata?: Json | null
          property_name?: string | null
          property_type?: string | null
          registered_by_user_id?: string | null
          status?: Database["public"]["Enums"]["afroloc_status"] | null
          street_code?: string | null
          street_name?: string | null
          unit?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "registration_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      afroloc_request_assignments: {
        Row: {
          assigned_at: string
          assigned_by_user_id: string
          assigned_to_user_id: string
          id: string
          notes: string | null
          reassignment_reason: string | null
          request_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_user_id: string
          assigned_to_user_id: string
          id?: string
          notes?: string | null
          reassignment_reason?: string | null
          request_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by_user_id?: string
          assigned_to_user_id?: string
          id?: string
          notes?: string | null
          reassignment_reason?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_request_assignments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "afroloc_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      afroloc_requests: {
        Row: {
          assigned_at: string | null
          assigned_by_user_id: string | null
          assigned_to_user_id: string | null
          city: string | null
          country_code: string
          created_at: string
          facade_photo_path: string | null
          geo_lat: number | null
          geo_lon: number | null
          house_number: string
          id: string
          level1_code: string | null
          level1_name: string | null
          level2_code: string | null
          level2_name: string | null
          level3_code: string | null
          level3_name: string | null
          level4_code: string | null
          level4_name: string | null
          neighborhood: string | null
          otp_attempts: number | null
          otp_code: string | null
          otp_expires_at: string | null
          otp_verified_at: string | null
          rejection_reason: string | null
          requester_document_number: string | null
          requester_document_path: string | null
          requester_document_type: string | null
          requester_name: string | null
          requester_phone: string
          resulting_afroloc_id: string | null
          site_visit_at: string | null
          site_visit_by_user_id: string | null
          site_visit_geo_lat: number | null
          site_visit_geo_lon: number | null
          site_visit_notes: string | null
          site_visit_photo_path: string | null
          status: Database["public"]["Enums"]["afroloc_request_status"]
          street_name: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by_user_id?: string | null
          assigned_to_user_id?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          facade_photo_path?: string | null
          geo_lat?: number | null
          geo_lon?: number | null
          house_number: string
          id?: string
          level1_code?: string | null
          level1_name?: string | null
          level2_code?: string | null
          level2_name?: string | null
          level3_code?: string | null
          level3_name?: string | null
          level4_code?: string | null
          level4_name?: string | null
          neighborhood?: string | null
          otp_attempts?: number | null
          otp_code?: string | null
          otp_expires_at?: string | null
          otp_verified_at?: string | null
          rejection_reason?: string | null
          requester_document_number?: string | null
          requester_document_path?: string | null
          requester_document_type?: string | null
          requester_name?: string | null
          requester_phone: string
          resulting_afroloc_id?: string | null
          site_visit_at?: string | null
          site_visit_by_user_id?: string | null
          site_visit_geo_lat?: number | null
          site_visit_geo_lon?: number | null
          site_visit_notes?: string | null
          site_visit_photo_path?: string | null
          status?: Database["public"]["Enums"]["afroloc_request_status"]
          street_name: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by_user_id?: string | null
          assigned_to_user_id?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          facade_photo_path?: string | null
          geo_lat?: number | null
          geo_lon?: number | null
          house_number?: string
          id?: string
          level1_code?: string | null
          level1_name?: string | null
          level2_code?: string | null
          level2_name?: string | null
          level3_code?: string | null
          level3_name?: string | null
          level4_code?: string | null
          level4_name?: string | null
          neighborhood?: string | null
          otp_attempts?: number | null
          otp_code?: string | null
          otp_expires_at?: string | null
          otp_verified_at?: string | null
          rejection_reason?: string | null
          requester_document_number?: string | null
          requester_document_path?: string | null
          requester_document_type?: string | null
          requester_name?: string | null
          requester_phone?: string
          resulting_afroloc_id?: string | null
          site_visit_at?: string | null
          site_visit_by_user_id?: string | null
          site_visit_geo_lat?: number | null
          site_visit_geo_lon?: number | null
          site_visit_notes?: string | null
          site_visit_photo_path?: string | null
          status?: Database["public"]["Enums"]["afroloc_request_status"]
          street_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_requests_resulting_afroloc_id_fkey"
            columns: ["resulting_afroloc_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      afroloc_residence_config: {
        Row: {
          afroloc_record_id: string
          configured_at: string
          configured_by_user_id: string
          created_at: string
          id: string
          max_residents: number
          required_documents: Json
          updated_at: string
        }
        Insert: {
          afroloc_record_id: string
          configured_at?: string
          configured_by_user_id: string
          created_at?: string
          id?: string
          max_residents?: number
          required_documents?: Json
          updated_at?: string
        }
        Update: {
          afroloc_record_id?: string
          configured_at?: string
          configured_by_user_id?: string
          created_at?: string
          id?: string
          max_residents?: number
          required_documents?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_residence_config_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: true
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      afroloc_resident_audit_log: {
        Row: {
          action: string
          actor_ip_address: unknown
          actor_role: string | null
          actor_user_agent: string | null
          actor_user_id: string | null
          afroloc_record_id: string | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          resident_id: string | null
        }
        Insert: {
          action: string
          actor_ip_address?: unknown
          actor_role?: string | null
          actor_user_agent?: string | null
          actor_user_id?: string | null
          afroloc_record_id?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          resident_id?: string | null
        }
        Update: {
          action?: string
          actor_ip_address?: unknown
          actor_role?: string | null
          actor_user_agent?: string | null
          actor_user_id?: string | null
          afroloc_record_id?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          resident_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_resident_audit_log_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afroloc_resident_audit_log_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "afroloc_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afroloc_resident_audit_log_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "pending_resident_approvals"
            referencedColumns: ["resident_id"]
          },
        ]
      }
      afroloc_resident_documents: {
        Row: {
          created_at: string
          document_number: string | null
          document_type: Database["public"]["Enums"]["resident_document_type"]
          expiry_alert_sent_at: string | null
          expiry_date: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          issue_date: string | null
          mime_type: string | null
          rejection_reason: string | null
          resident_id: string
          status: string
          updated_at: string
          user_id: string
          verification_notes: string | null
          verified_at: string | null
          verified_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          document_type: Database["public"]["Enums"]["resident_document_type"]
          expiry_alert_sent_at?: string | null
          expiry_date?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          issue_date?: string | null
          mime_type?: string | null
          rejection_reason?: string | null
          resident_id: string
          status?: string
          updated_at?: string
          user_id: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["resident_document_type"]
          expiry_alert_sent_at?: string | null
          expiry_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          issue_date?: string | null
          mime_type?: string | null
          rejection_reason?: string | null
          resident_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_resident_documents_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "afroloc_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afroloc_resident_documents_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "pending_resident_approvals"
            referencedColumns: ["resident_id"]
          },
        ]
      }
      afroloc_residents: {
        Row: {
          afroloc_record_id: string
          authority_approved_at: string | null
          authority_approved_by_user_id: string | null
          authority_notes: string | null
          authority_role: string | null
          created_at: string
          id: string
          is_primary: boolean
          otp_attempts: number | null
          otp_code: string | null
          otp_expires_at: string | null
          primary_approved_at: string | null
          primary_approved_by_user_id: string | null
          rejected_at: string | null
          rejected_by_user_id: string | null
          rejection_reason: string | null
          relationship: Database["public"]["Enums"]["resident_relationship"]
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by_user_id: string | null
          status: Database["public"]["Enums"]["coresident_request_status"]
          updated_at: string
          user_id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          afroloc_record_id: string
          authority_approved_at?: string | null
          authority_approved_by_user_id?: string | null
          authority_notes?: string | null
          authority_role?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          otp_attempts?: number | null
          otp_code?: string | null
          otp_expires_at?: string | null
          primary_approved_at?: string | null
          primary_approved_by_user_id?: string | null
          rejected_at?: string | null
          rejected_by_user_id?: string | null
          rejection_reason?: string | null
          relationship: Database["public"]["Enums"]["resident_relationship"]
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          status?: Database["public"]["Enums"]["coresident_request_status"]
          updated_at?: string
          user_id: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          afroloc_record_id?: string
          authority_approved_at?: string | null
          authority_approved_by_user_id?: string | null
          authority_notes?: string | null
          authority_role?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          otp_attempts?: number | null
          otp_code?: string | null
          otp_expires_at?: string | null
          primary_approved_at?: string | null
          primary_approved_by_user_id?: string | null
          rejected_at?: string | null
          rejected_by_user_id?: string | null
          rejection_reason?: string | null
          relationship?: Database["public"]["Enums"]["resident_relationship"]
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          status?: Database["public"]["Enums"]["coresident_request_status"]
          updated_at?: string
          user_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_residents_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      afroloc_validations: {
        Row: {
          afroloc_record_id: string
          authority_role: string | null
          authority_signature: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          notes: string | null
          validation_method: string
          verified_at: string | null
        }
        Insert: {
          afroloc_record_id: string
          authority_role?: string | null
          authority_signature?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          validation_method: string
          verified_at?: string | null
        }
        Update: {
          afroloc_record_id?: string
          authority_role?: string | null
          authority_signature?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          validation_method?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_validations_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      afroloc_witnesses: {
        Row: {
          afroloc_record_id: string
          confirmed_at: string | null
          created_at: string | null
          id: string
          otp_code: string | null
          otp_expires_at: string | null
          otp_sent_at: string | null
          rejection_reason: string | null
          signature: string | null
          status: string | null
          validated_at: string | null
          validated_by_user_id: string | null
          witness_afro_id: string
          witness_reputation_score: number | null
          witness_reputation_updated_at: string | null
          witness_user_id: string
        }
        Insert: {
          afroloc_record_id: string
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          otp_code?: string | null
          otp_expires_at?: string | null
          otp_sent_at?: string | null
          rejection_reason?: string | null
          signature?: string | null
          status?: string | null
          validated_at?: string | null
          validated_by_user_id?: string | null
          witness_afro_id: string
          witness_reputation_score?: number | null
          witness_reputation_updated_at?: string | null
          witness_user_id: string
        }
        Update: {
          afroloc_record_id?: string
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          otp_code?: string | null
          otp_expires_at?: string | null
          otp_sent_at?: string | null
          rejection_reason?: string | null
          signature?: string | null
          status?: string | null
          validated_at?: string | null
          validated_by_user_id?: string | null
          witness_afro_id?: string
          witness_reputation_score?: number | null
          witness_reputation_updated_at?: string | null
          witness_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_witnesses_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      biometric_devices: {
        Row: {
          biometry_type: string | null
          browser: string | null
          created_at: string | null
          device_fingerprint: string | null
          device_name: string | null
          device_token: string
          device_type: string | null
          expires_at: string | null
          id: string
          last_used_at: string | null
          os: string | null
          phone_number: string
          user_id: string
        }
        Insert: {
          biometry_type?: string | null
          browser?: string | null
          created_at?: string | null
          device_fingerprint?: string | null
          device_name?: string | null
          device_token: string
          device_type?: string | null
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          os?: string | null
          phone_number: string
          user_id: string
        }
        Update: {
          biometry_type?: string | null
          browser?: string | null
          created_at?: string | null
          device_fingerprint?: string | null
          device_name?: string | null
          device_token?: string
          device_type?: string | null
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          os?: string | null
          phone_number?: string
          user_id?: string
        }
        Relationships: []
      }
      biometric_login_history: {
        Row: {
          biometry_type: string
          browser: string | null
          created_at: string
          device_fingerprint: string
          device_name: string
          device_type: string
          id: string
          ip_address: unknown
          login_at: string
          os: string | null
          user_id: string
        }
        Insert: {
          biometry_type: string
          browser?: string | null
          created_at?: string
          device_fingerprint: string
          device_name: string
          device_type: string
          id?: string
          ip_address?: unknown
          login_at?: string
          os?: string | null
          user_id: string
        }
        Update: {
          biometry_type?: string
          browser?: string | null
          created_at?: string
          device_fingerprint?: string
          device_name?: string
          device_type?: string
          id?: string
          ip_address?: unknown
          login_at?: string
          os?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cadastral_batch_generations: {
        Row: {
          area_hectares: number | null
          country_code: string
          created_at: string
          generated_by_user_id: string
          id: string
          level1_code: string | null
          level1_name: string | null
          level2_code: string | null
          level2_name: string | null
          max_lat: number
          max_lon: number
          min_lat: number
          min_lon: number
          rural_cells_count: number | null
          status: string
          total_cells_generated: number
          urban_cells_count: number | null
        }
        Insert: {
          area_hectares?: number | null
          country_code: string
          created_at?: string
          generated_by_user_id: string
          id?: string
          level1_code?: string | null
          level1_name?: string | null
          level2_code?: string | null
          level2_name?: string | null
          max_lat: number
          max_lon: number
          min_lat: number
          min_lon: number
          rural_cells_count?: number | null
          status?: string
          total_cells_generated?: number
          urban_cells_count?: number | null
        }
        Update: {
          area_hectares?: number | null
          country_code?: string
          created_at?: string
          generated_by_user_id?: string
          id?: string
          level1_code?: string | null
          level1_name?: string | null
          level2_code?: string | null
          level2_name?: string | null
          max_lat?: number
          max_lon?: number
          min_lat?: number
          min_lon?: number
          rural_cells_count?: number | null
          status?: string
          total_cells_generated?: number
          urban_cells_count?: number | null
        }
        Relationships: []
      }
      cadastral_creation_quotas: {
        Row: {
          cells_created_month: number | null
          cells_created_today: number | null
          country_code: string
          id: string
          last_creation_date: string | null
          last_creation_month: string | null
          level1_code: string | null
          total_cells_created: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cells_created_month?: number | null
          cells_created_today?: number | null
          country_code: string
          id?: string
          last_creation_date?: string | null
          last_creation_month?: string | null
          level1_code?: string | null
          total_cells_created?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cells_created_month?: number | null
          cells_created_today?: number | null
          country_code?: string
          id?: string
          last_creation_date?: string | null
          last_creation_month?: string | null
          level1_code?: string | null
          total_cells_created?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cadastral_creation_rules: {
        Row: {
          allowed_zone_types: string[] | null
          approval_levels: number[] | null
          auto_approve_level: number
          country_code: string
          created_at: string | null
          created_by_user_id: string | null
          enforce_boundaries: boolean
          id: string
          is_active: boolean | null
          level1_code: string | null
          level2_code: string | null
          max_cells_per_batch: number | null
          max_cells_per_day: number | null
          max_cells_per_month: number | null
          min_authorization_level: number
          notes: string | null
          protected_zones: Json | null
          requires_approval: boolean
          updated_at: string | null
        }
        Insert: {
          allowed_zone_types?: string[] | null
          approval_levels?: number[] | null
          auto_approve_level?: number
          country_code: string
          created_at?: string | null
          created_by_user_id?: string | null
          enforce_boundaries?: boolean
          id?: string
          is_active?: boolean | null
          level1_code?: string | null
          level2_code?: string | null
          max_cells_per_batch?: number | null
          max_cells_per_day?: number | null
          max_cells_per_month?: number | null
          min_authorization_level?: number
          notes?: string | null
          protected_zones?: Json | null
          requires_approval?: boolean
          updated_at?: string | null
        }
        Update: {
          allowed_zone_types?: string[] | null
          approval_levels?: number[] | null
          auto_approve_level?: number
          country_code?: string
          created_at?: string | null
          created_by_user_id?: string | null
          enforce_boundaries?: boolean
          id?: string
          is_active?: boolean | null
          level1_code?: string | null
          level2_code?: string | null
          max_cells_per_batch?: number | null
          max_cells_per_day?: number | null
          max_cells_per_month?: number | null
          min_authorization_level?: number
          notes?: string | null
          protected_zones?: Json | null
          requires_approval?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      cadastral_grid_cells: {
        Row: {
          afroloc_code: string
          approved_at: string | null
          approved_by_user_id: string | null
          batch_id: string | null
          cell_size_meters: number
          centroid_lat: number
          centroid_lon: number
          certification_count: number | null
          country_code: string
          created_at: string
          estimated_parcels: number | null
          generated_by_user_id: string
          generation_method: string
          id: string
          land_use_type: string | null
          last_certification_at: string | null
          level1_code: string | null
          level1_name: string | null
          level2_code: string | null
          level2_name: string | null
          level3_code: string | null
          level3_name: string | null
          level4_code: string | null
          level4_name: string | null
          max_lat: number
          max_lon: number
          min_lat: number
          min_lon: number
          notes: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
          zone_type: string
        }
        Insert: {
          afroloc_code: string
          approved_at?: string | null
          approved_by_user_id?: string | null
          batch_id?: string | null
          cell_size_meters: number
          centroid_lat: number
          centroid_lon: number
          certification_count?: number | null
          country_code: string
          created_at?: string
          estimated_parcels?: number | null
          generated_by_user_id: string
          generation_method?: string
          id?: string
          land_use_type?: string | null
          last_certification_at?: string | null
          level1_code?: string | null
          level1_name?: string | null
          level2_code?: string | null
          level2_name?: string | null
          level3_code?: string | null
          level3_name?: string | null
          level4_code?: string | null
          level4_name?: string | null
          max_lat: number
          max_lon: number
          min_lat: number
          min_lon: number
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          zone_type: string
        }
        Update: {
          afroloc_code?: string
          approved_at?: string | null
          approved_by_user_id?: string | null
          batch_id?: string | null
          cell_size_meters?: number
          centroid_lat?: number
          centroid_lon?: number
          certification_count?: number | null
          country_code?: string
          created_at?: string
          estimated_parcels?: number | null
          generated_by_user_id?: string
          generation_method?: string
          id?: string
          land_use_type?: string | null
          last_certification_at?: string | null
          level1_code?: string | null
          level1_name?: string | null
          level2_code?: string | null
          level2_name?: string | null
          level3_code?: string | null
          level3_name?: string | null
          level4_code?: string | null
          level4_name?: string | null
          max_lat?: number
          max_lon?: number
          min_lat?: number
          min_lon?: number
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          zone_type?: string
        }
        Relationships: []
      }
      cadastral_protected_zones: {
        Row: {
          boundary_geojson: Json | null
          country_code: string
          created_at: string | null
          created_by_user_id: string | null
          creation_blocked: boolean | null
          id: string
          is_active: boolean | null
          level1_code: string | null
          level1_name: string | null
          max_lat: number
          max_lon: number
          min_lat: number
          min_lon: number
          name: string
          reason: string | null
          requires_special_approval: boolean | null
          special_approval_level: number | null
          updated_at: string | null
          zone_type: string
        }
        Insert: {
          boundary_geojson?: Json | null
          country_code: string
          created_at?: string | null
          created_by_user_id?: string | null
          creation_blocked?: boolean | null
          id?: string
          is_active?: boolean | null
          level1_code?: string | null
          level1_name?: string | null
          max_lat: number
          max_lon: number
          min_lat: number
          min_lon: number
          name: string
          reason?: string | null
          requires_special_approval?: boolean | null
          special_approval_level?: number | null
          updated_at?: string | null
          zone_type?: string
        }
        Update: {
          boundary_geojson?: Json | null
          country_code?: string
          created_at?: string | null
          created_by_user_id?: string | null
          creation_blocked?: boolean | null
          id?: string
          is_active?: boolean | null
          level1_code?: string | null
          level1_name?: string | null
          max_lat?: number
          max_lon?: number
          min_lat?: number
          min_lon?: number
          name?: string
          reason?: string | null
          requires_special_approval?: boolean | null
          special_approval_level?: number | null
          updated_at?: string | null
          zone_type?: string
        }
        Relationships: []
      }
      cell_density_cache: {
        Row: {
          afroloc_code: string
          bbox_max_lat: number | null
          bbox_max_lon: number | null
          bbox_min_lat: number | null
          bbox_min_lon: number | null
          calculation_window_days: number
          certification_count: number
          country_code: string
          created_at: string
          density_class: string
          estimated_population: number
          grid_m: number
          growth_rate_percent: number | null
          id: string
          last_calculated_at: string
          previous_density_class: string | null
          promoted_at: string | null
          subdivision_type: string
          tile_ix: number
          tile_iy: number
          updated_at: string
          zone: string
        }
        Insert: {
          afroloc_code: string
          bbox_max_lat?: number | null
          bbox_max_lon?: number | null
          bbox_min_lat?: number | null
          bbox_min_lon?: number | null
          calculation_window_days?: number
          certification_count?: number
          country_code?: string
          created_at?: string
          density_class?: string
          estimated_population?: number
          grid_m: number
          growth_rate_percent?: number | null
          id?: string
          last_calculated_at?: string
          previous_density_class?: string | null
          promoted_at?: string | null
          subdivision_type?: string
          tile_ix: number
          tile_iy: number
          updated_at?: string
          zone: string
        }
        Update: {
          afroloc_code?: string
          bbox_max_lat?: number | null
          bbox_max_lon?: number | null
          bbox_min_lat?: number | null
          bbox_min_lon?: number | null
          calculation_window_days?: number
          certification_count?: number
          country_code?: string
          created_at?: string
          density_class?: string
          estimated_population?: number
          grid_m?: number
          growth_rate_percent?: number | null
          id?: string
          last_calculated_at?: string
          previous_density_class?: string | null
          promoted_at?: string | null
          subdivision_type?: string
          tile_ix?: number
          tile_iy?: number
          updated_at?: string
          zone?: string
        }
        Relationships: []
      }
      cell_density_history: {
        Row: {
          afroloc_code: string
          certification_count: number
          density_class: string
          growth_rate_percent: number | null
          id: string
          snapshot_at: string
          subdivision_type: string
        }
        Insert: {
          afroloc_code: string
          certification_count: number
          density_class: string
          growth_rate_percent?: number | null
          id?: string
          snapshot_at?: string
          subdivision_type: string
        }
        Update: {
          afroloc_code?: string
          certification_count?: number
          density_class?: string
          growth_rate_percent?: number | null
          id?: string
          snapshot_at?: string
          subdivision_type?: string
        }
        Relationships: []
      }
      cell_towers: {
        Row: {
          altitude_meters: number | null
          antenna_height_meters: number | null
          azimuth_degrees: number | null
          cell_id: string
          country_code: string
          coverage_radius_meters: number | null
          created_at: string
          frequency_band: string | null
          id: string
          is_active: boolean | null
          lac: number | null
          last_verified_at: string | null
          latitude: number
          level1_code: string | null
          level1_name: string | null
          level2_code: string | null
          level2_name: string | null
          longitude: number
          max_rsrp: number | null
          mcc: string
          metadata: Json | null
          mnc: string
          path_loss_exponent: number | null
          tac: number | null
          technology: string
          telecom_operator_id: string | null
          updated_at: string
          verified_by_user_id: string | null
        }
        Insert: {
          altitude_meters?: number | null
          antenna_height_meters?: number | null
          azimuth_degrees?: number | null
          cell_id: string
          country_code: string
          coverage_radius_meters?: number | null
          created_at?: string
          frequency_band?: string | null
          id?: string
          is_active?: boolean | null
          lac?: number | null
          last_verified_at?: string | null
          latitude: number
          level1_code?: string | null
          level1_name?: string | null
          level2_code?: string | null
          level2_name?: string | null
          longitude: number
          max_rsrp?: number | null
          mcc: string
          metadata?: Json | null
          mnc: string
          path_loss_exponent?: number | null
          tac?: number | null
          technology: string
          telecom_operator_id?: string | null
          updated_at?: string
          verified_by_user_id?: string | null
        }
        Update: {
          altitude_meters?: number | null
          antenna_height_meters?: number | null
          azimuth_degrees?: number | null
          cell_id?: string
          country_code?: string
          coverage_radius_meters?: number | null
          created_at?: string
          frequency_band?: string | null
          id?: string
          is_active?: boolean | null
          lac?: number | null
          last_verified_at?: string | null
          latitude?: number
          level1_code?: string | null
          level1_name?: string | null
          level2_code?: string | null
          level2_name?: string | null
          longitude?: number
          max_rsrp?: number | null
          mcc?: string
          metadata?: Json | null
          mnc?: string
          path_loss_exponent?: number | null
          tac?: number | null
          technology?: string
          telecom_operator_id?: string | null
          updated_at?: string
          verified_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cell_towers_telecom_operator_id_fkey"
            columns: ["telecom_operator_id"]
            isOneToOne: false
            referencedRelation: "telecom_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          address_format: Json | null
          admin_levels_count: number | null
          afro_id_format: string | null
          afro_id_prefix: string | null
          country_code: string
          country_name: string
          created_at: string | null
          created_by_user_id: string | null
          currency: string | null
          id: string
          is_active: boolean | null
          language_codes: string[] | null
          level1_label: string | null
          level2_label: string | null
          level3_label: string | null
          level4_label: string | null
          level5_label: string | null
          min_witnesses_required: number | null
          phone_country_code: string | null
          phone_number_format: string | null
          requires_authority_validation: boolean | null
          requires_division_validation: boolean | null
          requires_witness_validation: boolean | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          address_format?: Json | null
          admin_levels_count?: number | null
          afro_id_format?: string | null
          afro_id_prefix?: string | null
          country_code: string
          country_name: string
          created_at?: string | null
          created_by_user_id?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean | null
          language_codes?: string[] | null
          level1_label?: string | null
          level2_label?: string | null
          level3_label?: string | null
          level4_label?: string | null
          level5_label?: string | null
          min_witnesses_required?: number | null
          phone_country_code?: string | null
          phone_number_format?: string | null
          requires_authority_validation?: boolean | null
          requires_division_validation?: boolean | null
          requires_witness_validation?: boolean | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          address_format?: Json | null
          admin_levels_count?: number | null
          afro_id_format?: string | null
          afro_id_prefix?: string | null
          country_code?: string
          country_name?: string
          created_at?: string | null
          created_by_user_id?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean | null
          language_codes?: string[] | null
          level1_label?: string | null
          level2_label?: string | null
          level3_label?: string | null
          level4_label?: string | null
          level5_label?: string | null
          min_witnesses_required?: number | null
          phone_country_code?: string | null
          phone_number_format?: string | null
          requires_authority_validation?: boolean | null
          requires_division_validation?: boolean | null
          requires_witness_validation?: boolean | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string
          created_at: string | null
          file_path: string
          id: string
          language: string
          published_at: string
          sha256: string
          title: string
          updated_at: string | null
          version: string
          visibility: string
        }
        Insert: {
          category: string
          created_at?: string | null
          file_path: string
          id?: string
          language: string
          published_at: string
          sha256: string
          title: string
          updated_at?: string | null
          version: string
          visibility?: string
        }
        Update: {
          category?: string
          created_at?: string | null
          file_path?: string
          id?: string
          language?: string
          published_at?: string
          sha256?: string
          title?: string
          updated_at?: string | null
          version?: string
          visibility?: string
        }
        Relationships: []
      }
      fine_audit_log: {
        Row: {
          action: string
          actor_institution_id: string | null
          actor_ip_address: unknown
          actor_role: string | null
          actor_user_agent: string | null
          actor_user_id: string | null
          created_at: string | null
          error_message: string | null
          hash_chain_curr: string
          hash_chain_prev: string | null
          id: string
          log_sequence: number
          new_values: Json | null
          object_id: string
          object_type: string
          old_values: Json | null
          result: string | null
        }
        Insert: {
          action: string
          actor_institution_id?: string | null
          actor_ip_address?: unknown
          actor_role?: string | null
          actor_user_agent?: string | null
          actor_user_id?: string | null
          created_at?: string | null
          error_message?: string | null
          hash_chain_curr: string
          hash_chain_prev?: string | null
          id?: string
          log_sequence?: number
          new_values?: Json | null
          object_id: string
          object_type: string
          old_values?: Json | null
          result?: string | null
        }
        Update: {
          action?: string
          actor_institution_id?: string | null
          actor_ip_address?: unknown
          actor_role?: string | null
          actor_user_agent?: string | null
          actor_user_id?: string | null
          created_at?: string | null
          error_message?: string | null
          hash_chain_curr?: string
          hash_chain_prev?: string | null
          id?: string
          log_sequence?: number
          new_values?: Json | null
          object_id?: string
          object_type?: string
          old_values?: Json | null
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fine_audit_log_actor_institution_id_fkey"
            columns: ["actor_institution_id"]
            isOneToOne: false
            referencedRelation: "fine_institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      fine_institutions: {
        Row: {
          code: string
          contact_email: string | null
          contact_phone: string | null
          country_code: string
          created_at: string | null
          id: string
          institution_type: string | null
          is_active: boolean | null
          level1_code: string | null
          level1_name: string | null
          level2_code: string | null
          level2_name: string | null
          level3_code: string | null
          level3_name: string | null
          logo_path: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          contact_email?: string | null
          contact_phone?: string | null
          country_code: string
          created_at?: string | null
          id?: string
          institution_type?: string | null
          is_active?: boolean | null
          level1_code?: string | null
          level1_name?: string | null
          level2_code?: string | null
          level2_name?: string | null
          level3_code?: string | null
          level3_name?: string | null
          logo_path?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string
          created_at?: string | null
          id?: string
          institution_type?: string | null
          is_active?: boolean | null
          level1_code?: string | null
          level1_name?: string | null
          level2_code?: string | null
          level2_name?: string | null
          level3_code?: string | null
          level3_name?: string | null
          logo_path?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fines: {
        Row: {
          approved_by_user_id: string | null
          base_amount: number
          canceled_by_user_id: string | null
          cancellation_date: string | null
          cancellation_reason: string | null
          country_code: string | null
          created_at: string | null
          created_by_user_id: string
          currency: string | null
          discount_amount: number | null
          discount_deadline: string | null
          due_date: string | null
          final_amount: number
          fine_number: string
          id: string
          institution_id: string
          issue_date: string | null
          issued_by_user_id: string | null
          jurisdiction_level1_code: string | null
          jurisdiction_level1_name: string | null
          jurisdiction_level2_code: string | null
          jurisdiction_level2_name: string | null
          metadata: Json | null
          payment_entity: string | null
          payment_reference: string | null
          penalty_amount: number | null
          status: Database["public"]["Enums"]["fine_status"] | null
          status_updated_at: string | null
          subject_address: string | null
          subject_email: string | null
          subject_name: string | null
          subject_phone: string | null
          subject_ref: string
          subject_type: string
          updated_at: string | null
          violation_event_id: string
        }
        Insert: {
          approved_by_user_id?: string | null
          base_amount: number
          canceled_by_user_id?: string | null
          cancellation_date?: string | null
          cancellation_reason?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by_user_id: string
          currency?: string | null
          discount_amount?: number | null
          discount_deadline?: string | null
          due_date?: string | null
          final_amount: number
          fine_number: string
          id?: string
          institution_id: string
          issue_date?: string | null
          issued_by_user_id?: string | null
          jurisdiction_level1_code?: string | null
          jurisdiction_level1_name?: string | null
          jurisdiction_level2_code?: string | null
          jurisdiction_level2_name?: string | null
          metadata?: Json | null
          payment_entity?: string | null
          payment_reference?: string | null
          penalty_amount?: number | null
          status?: Database["public"]["Enums"]["fine_status"] | null
          status_updated_at?: string | null
          subject_address?: string | null
          subject_email?: string | null
          subject_name?: string | null
          subject_phone?: string | null
          subject_ref: string
          subject_type: string
          updated_at?: string | null
          violation_event_id: string
        }
        Update: {
          approved_by_user_id?: string | null
          base_amount?: number
          canceled_by_user_id?: string | null
          cancellation_date?: string | null
          cancellation_reason?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by_user_id?: string
          currency?: string | null
          discount_amount?: number | null
          discount_deadline?: string | null
          due_date?: string | null
          final_amount?: number
          fine_number?: string
          id?: string
          institution_id?: string
          issue_date?: string | null
          issued_by_user_id?: string | null
          jurisdiction_level1_code?: string | null
          jurisdiction_level1_name?: string | null
          jurisdiction_level2_code?: string | null
          jurisdiction_level2_name?: string | null
          metadata?: Json | null
          payment_entity?: string | null
          payment_reference?: string | null
          penalty_amount?: number | null
          status?: Database["public"]["Enums"]["fine_status"] | null
          status_updated_at?: string | null
          subject_address?: string | null
          subject_email?: string | null
          subject_name?: string | null
          subject_phone?: string | null
          subject_ref?: string
          subject_type?: string
          updated_at?: string | null
          violation_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fines_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "fine_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fines_violation_event_id_fkey"
            columns: ["violation_event_id"]
            isOneToOne: false
            referencedRelation: "violation_events"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_documents: {
        Row: {
          afroloc_record_id: string
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          rejection_reason: string | null
          status: string
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by_user_id: string | null
        }
        Insert: {
          afroloc_record_id: string
          created_at?: string
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by_user_id?: string | null
        }
        Update: {
          afroloc_record_id?: string
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_documents_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      offline_cache_metadata: {
        Row: {
          cache_key: string
          checksum: string | null
          data_type: string
          expires_at: string | null
          id: string
          last_synced_at: string | null
          user_id: string
        }
        Insert: {
          cache_key: string
          checksum?: string | null
          data_type: string
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          user_id: string
        }
        Update: {
          cache_key?: string
          checksum?: string | null
          data_type?: string
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      partner_api_keys: {
        Row: {
          api_key_hash: string
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          partner_name: string
          permissions: string[]
          request_count: number
          updated_at: string
        }
        Insert: {
          api_key_hash?: string
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          partner_name: string
          permissions?: string[]
          request_count?: number
          updated_at?: string
        }
        Update: {
          api_key_hash?: string
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          partner_name?: string
          permissions?: string[]
          request_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      partner_api_log: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          id: string
          ip_address: unknown
          method: string
          partner_name: string
          request_body: Json | null
          response_summary: string | null
          status_code: number | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: unknown
          method: string
          partner_name: string
          request_body?: Json | null
          response_summary?: string | null
          status_code?: number | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: unknown
          method?: string
          partner_name?: string
          request_body?: Json | null
          response_summary?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_api_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "partner_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_change_attempts: {
        Row: {
          attempt_type: string
          created_at: string | null
          id: string
          ip_address: string | null
          phone_number: string
          user_id: string
        }
        Insert: {
          attempt_type: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          phone_number: string
          user_id: string
        }
        Update: {
          attempt_type?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          phone_number?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_otp_verifications: {
        Row: {
          attempts: number
          country_code: string | null
          created_at: string
          expires_at: string
          operator_code: string | null
          operator_name: string | null
          otp_code: string
          phone_number: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          country_code?: string | null
          created_at?: string
          expires_at: string
          operator_code?: string | null
          operator_name?: string | null
          otp_code: string
          phone_number: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          country_code?: string | null
          created_at?: string
          expires_at?: string
          operator_code?: string | null
          operator_name?: string | null
          otp_code?: string
          phone_number?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      podp_config: {
        Row: {
          country_code: string | null
          created_at: string
          cycle_length_days: number
          enabled: boolean
          id: string
          max_gps_accuracy_m: number
          min_hours_per_day: number
          min_valid_days_ratio: number
          sample_interval_minutes: number
          scope: string
          tolerance_radius_rural_m: number
          tolerance_radius_urban_m: number
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          cycle_length_days?: number
          enabled?: boolean
          id?: string
          max_gps_accuracy_m?: number
          min_hours_per_day?: number
          min_valid_days_ratio?: number
          sample_interval_minutes?: number
          scope?: string
          tolerance_radius_rural_m?: number
          tolerance_radius_urban_m?: number
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          cycle_length_days?: number
          enabled?: boolean
          id?: string
          max_gps_accuracy_m?: number
          min_hours_per_day?: number
          min_valid_days_ratio?: number
          sample_interval_minutes?: number
          scope?: string
          tolerance_radius_rural_m?: number
          tolerance_radius_urban_m?: number
          updated_at?: string
        }
        Relationships: []
      }
      podp_cycles: {
        Row: {
          afroloc_record_id: string
          applied_to_ats: boolean
          closed_at: string
          created_at: string
          cycle_end: string
          cycle_start: string
          id: string
          kpi: Json
          podp_score: number
          total_days: number
          user_id: string
          valid_days: number
        }
        Insert: {
          afroloc_record_id: string
          applied_to_ats?: boolean
          closed_at?: string
          created_at?: string
          cycle_end: string
          cycle_start: string
          id?: string
          kpi?: Json
          podp_score?: number
          total_days: number
          user_id: string
          valid_days?: number
        }
        Update: {
          afroloc_record_id?: string
          applied_to_ats?: boolean
          closed_at?: string
          created_at?: string
          cycle_end?: string
          cycle_start?: string
          id?: string
          kpi?: Json
          podp_score?: number
          total_days?: number
          user_id?: string
          valid_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "podp_cycles_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      podp_daily_rollup: {
        Row: {
          afroloc_record_id: string
          created_at: string
          day: string
          day_is_valid: boolean
          hours_present: number
          id: string
          updated_at: string
          user_id: string
          valid_samples: number
        }
        Insert: {
          afroloc_record_id: string
          created_at?: string
          day: string
          day_is_valid?: boolean
          hours_present?: number
          id?: string
          updated_at?: string
          user_id: string
          valid_samples?: number
        }
        Update: {
          afroloc_record_id?: string
          created_at?: string
          day?: string
          day_is_valid?: boolean
          hours_present?: number
          id?: string
          updated_at?: string
          user_id?: string
          valid_samples?: number
        }
        Relationships: [
          {
            foreignKeyName: "podp_daily_rollup_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      podp_samples: {
        Row: {
          accuracy_m: number | null
          afroloc_record_id: string
          captured_at: string
          client_generated_id: string
          created_at: string
          device_fingerprint: string | null
          distance_from_address_m: number
          geo_lat: number
          geo_lon: number
          id: string
          is_within_radius: boolean
          received_at: string
          rejection_reason: string | null
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          afroloc_record_id: string
          captured_at: string
          client_generated_id: string
          created_at?: string
          device_fingerprint?: string | null
          distance_from_address_m: number
          geo_lat: number
          geo_lon: number
          id?: string
          is_within_radius: boolean
          received_at?: string
          rejection_reason?: string | null
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          afroloc_record_id?: string
          captured_at?: string
          client_generated_id?: string
          created_at?: string
          device_fingerprint?: string | null
          distance_from_address_m?: number
          geo_lat?: number
          geo_lon?: number
          id?: string
          is_within_radius?: boolean
          received_at?: string
          rejection_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "podp_samples_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          afro_id: string | null
          city: string | null
          country: string | null
          created_at: string | null
          full_name: string | null
          id: string
          last_phone_change_at: string | null
          onboarding_completed: boolean | null
          phone: string | null
          purpose: string[] | null
          two_factor_enabled: boolean | null
          two_factor_method: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          afro_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          last_phone_change_at?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          purpose?: string[] | null
          two_factor_enabled?: boolean | null
          two_factor_method?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          afro_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          last_phone_change_at?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          purpose?: string[] | null
          two_factor_enabled?: boolean | null
          two_factor_method?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          id: string
          subscription: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subscription: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subscription?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      registration_batches: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          batch_number: string
          created_at: string | null
          created_by_user_id: string
          id: string
          jurisdiction_country: string
          jurisdiction_level1_code: string | null
          jurisdiction_level1_name: string | null
          jurisdiction_level2_code: string | null
          jurisdiction_level2_name: string | null
          jurisdiction_level3_code: string | null
          jurisdiction_level3_name: string | null
          jurisdiction_level4_code: string | null
          jurisdiction_level4_name: string | null
          notes: string | null
          record_count: number | null
          rejected_at: string | null
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          submitted_to_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          batch_number: string
          created_at?: string | null
          created_by_user_id: string
          id?: string
          jurisdiction_country: string
          jurisdiction_level1_code?: string | null
          jurisdiction_level1_name?: string | null
          jurisdiction_level2_code?: string | null
          jurisdiction_level2_name?: string | null
          jurisdiction_level3_code?: string | null
          jurisdiction_level3_name?: string | null
          jurisdiction_level4_code?: string | null
          jurisdiction_level4_name?: string | null
          notes?: string | null
          record_count?: number | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          submitted_at?: string | null
          submitted_to_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          batch_number?: string
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          jurisdiction_country?: string
          jurisdiction_level1_code?: string | null
          jurisdiction_level1_name?: string | null
          jurisdiction_level2_code?: string | null
          jurisdiction_level2_name?: string | null
          jurisdiction_level3_code?: string | null
          jurisdiction_level3_name?: string | null
          jurisdiction_level4_code?: string | null
          jurisdiction_level4_name?: string | null
          notes?: string | null
          record_count?: number | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          submitted_at?: string | null
          submitted_to_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      risk_alert_settings: {
        Row: {
          alert_type: string
          created_at: string
          critical_risk_threshold: number
          enabled: boolean
          high_risk_threshold: number
          id: string
          trend_increase_threshold: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          critical_risk_threshold?: number
          enabled?: boolean
          high_risk_threshold?: number
          id?: string
          trend_increase_threshold?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          critical_risk_threshold?: number
          enabled?: boolean
          high_risk_threshold?: number
          id?: string
          trend_increase_threshold?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      risk_alerts_log: {
        Row: {
          alert_type: string
          country_code: string | null
          id: string
          message: string
          metadata: Json | null
          region_name: string | null
          risk_score: number
          sent_at: string
          sent_via: string
          user_id: string | null
        }
        Insert: {
          alert_type: string
          country_code?: string | null
          id?: string
          message: string
          metadata?: Json | null
          region_name?: string | null
          risk_score: number
          sent_at?: string
          sent_via: string
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          country_code?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          region_name?: string | null
          risk_score?: number
          sent_at?: string
          sent_via?: string
          user_id?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          description: string
          id: number
          name: string
        }
        Insert: {
          description?: string
          id?: number
          name: string
        }
        Update: {
          description?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          function_name: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          function_name: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          function_name?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string | null
          details: Json | null
          endpoint: string | null
          event_type: string
          id: string
          ip_address: string | null
          notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          endpoint?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          endpoint?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      telecom_operators: {
        Row: {
          administrative_division_id: string | null
          country_code: string
          created_at: string
          id: string
          is_active: boolean | null
          metadata: Json | null
          operator_code: string
          operator_name: string
          otp_provider: string
          phone_prefixes: string[]
          updated_at: string
        }
        Insert: {
          administrative_division_id?: string | null
          country_code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          operator_code: string
          operator_name: string
          otp_provider: string
          phone_prefixes: string[]
          updated_at?: string
        }
        Update: {
          administrative_division_id?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          operator_code?: string
          operator_name?: string
          otp_provider?: string
          phone_prefixes?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telecom_operators_administrative_division_id_fkey"
            columns: ["administrative_division_id"]
            isOneToOne: false
            referencedRelation: "administrative_divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      two_factor_backup_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          ip_address: string | null
          used: boolean | null
          used_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          used?: boolean | null
          used_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          used?: boolean | null
          used_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      two_factor_codes: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          method: string
          user_agent: string | null
          user_id: string
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          method: string
          user_agent?: string | null
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          method?: string
          user_agent?: string | null
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: []
      }
      urban_zones: {
        Row: {
          admin_path: string
          created_at: string
          geom: unknown
          id: number
          name: string
          source: string
        }
        Insert: {
          admin_path?: string
          created_at?: string
          geom: unknown
          id?: number
          name?: string
          source?: string
        }
        Update: {
          admin_path?: string
          created_at?: string
          geom?: unknown
          id?: number
          name?: string
          source?: string
        }
        Relationships: []
      }
      user_2fa_settings: {
        Row: {
          authenticator_secret: string | null
          backup_codes_count: number | null
          created_at: string | null
          email_verified: boolean | null
          enabled: boolean | null
          id: string
          method: string | null
          phone_verified: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          authenticator_secret?: string | null
          backup_codes_count?: number | null
          created_at?: string | null
          email_verified?: boolean | null
          enabled?: boolean | null
          id?: string
          method?: string | null
          phone_verified?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          authenticator_secret?: string | null
          backup_codes_count?: number | null
          created_at?: string | null
          email_verified?: boolean | null
          enabled?: boolean | null
          id?: string
          method?: string | null
          phone_verified?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_authorization_levels: {
        Row: {
          administrative_role: string | null
          assigned_at: string | null
          assigned_by_user_id: string | null
          created_at: string | null
          current_level: number
          id: string
          jurisdiction_country: string | null
          jurisdiction_level1_code: string | null
          jurisdiction_level1_name: string | null
          jurisdiction_level2_code: string | null
          jurisdiction_level2_name: string | null
          jurisdiction_level3_code: string | null
          jurisdiction_level3_name: string | null
          jurisdiction_level4_code: string | null
          jurisdiction_level4_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          administrative_role?: string | null
          assigned_at?: string | null
          assigned_by_user_id?: string | null
          created_at?: string | null
          current_level?: number
          id?: string
          jurisdiction_country?: string | null
          jurisdiction_level1_code?: string | null
          jurisdiction_level1_name?: string | null
          jurisdiction_level2_code?: string | null
          jurisdiction_level2_name?: string | null
          jurisdiction_level3_code?: string | null
          jurisdiction_level3_name?: string | null
          jurisdiction_level4_code?: string | null
          jurisdiction_level4_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          administrative_role?: string | null
          assigned_at?: string | null
          assigned_by_user_id?: string | null
          created_at?: string | null
          current_level?: number
          id?: string
          jurisdiction_country?: string | null
          jurisdiction_level1_code?: string | null
          jurisdiction_level1_name?: string | null
          jurisdiction_level2_code?: string | null
          jurisdiction_level2_name?: string | null
          jurisdiction_level3_code?: string | null
          jurisdiction_level3_name?: string | null
          jurisdiction_level4_code?: string | null
          jurisdiction_level4_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          browser: string | null
          created_at: string | null
          device_fingerprint: string
          device_name: string
          device_type: string
          id: string
          ip_address: unknown
          is_trusted: boolean | null
          last_active_at: string | null
          os: string | null
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string | null
          device_fingerprint: string
          device_name: string
          device_type: string
          id?: string
          ip_address?: unknown
          is_trusted?: boolean | null
          last_active_at?: string | null
          os?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string | null
          device_fingerprint?: string
          device_name?: string
          device_type?: string
          id?: string
          ip_address?: unknown
          is_trusted?: boolean | null
          last_active_at?: string | null
          os?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      validation_phone_numbers: {
        Row: {
          administrative_division_id: string
          allocated_at: string | null
          country_code: string
          created_at: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          metadata: Json | null
          phone_number: string
          telecom_operator_id: string | null
          updated_at: string
          usage_count: number | null
          validator_user_id: string | null
          verification_status: string | null
          verified_at: string | null
        }
        Insert: {
          administrative_division_id: string
          allocated_at?: string | null
          country_code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          metadata?: Json | null
          phone_number: string
          telecom_operator_id?: string | null
          updated_at?: string
          usage_count?: number | null
          validator_user_id?: string | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Update: {
          administrative_division_id?: string
          allocated_at?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          metadata?: Json | null
          phone_number?: string
          telecom_operator_id?: string | null
          updated_at?: string
          usage_count?: number | null
          validator_user_id?: string | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "validation_phone_numbers_administrative_division_id_fkey"
            columns: ["administrative_division_id"]
            isOneToOne: false
            referencedRelation: "administrative_divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_phone_numbers_telecom_operator_id_fkey"
            columns: ["telecom_operator_id"]
            isOneToOne: false
            referencedRelation: "telecom_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      validator_notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          priority: string | null
          read: boolean | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          priority?: string | null
          read?: boolean | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          priority?: string | null
          read?: boolean | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      violation_categories: {
        Row: {
          category_code: string
          category_name: string
          country_code: string
          created_at: string | null
          description: string | null
          governing_institution_type: string | null
          id: string
          is_active: boolean | null
          legal_framework: string | null
        }
        Insert: {
          category_code: string
          category_name: string
          country_code: string
          created_at?: string | null
          description?: string | null
          governing_institution_type?: string | null
          id?: string
          is_active?: boolean | null
          legal_framework?: string | null
        }
        Update: {
          category_code?: string
          category_name?: string
          country_code?: string
          created_at?: string | null
          description?: string | null
          governing_institution_type?: string | null
          id?: string
          is_active?: boolean | null
          legal_framework?: string | null
        }
        Relationships: []
      }
      violation_codes: {
        Row: {
          base_amount: number
          category: Database["public"]["Enums"]["violation_category"]
          code: string
          created_at: string | null
          created_by_user_id: string | null
          currency: string | null
          description: string
          discount_days: number | null
          discount_percentage: number | null
          id: string
          is_active: boolean | null
          legal_basis_ref: string | null
          points: number | null
          severity: string | null
          updated_at: string | null
        }
        Insert: {
          base_amount: number
          category: Database["public"]["Enums"]["violation_category"]
          code: string
          created_at?: string | null
          created_by_user_id?: string | null
          currency?: string | null
          description: string
          discount_days?: number | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          legal_basis_ref?: string | null
          points?: number | null
          severity?: string | null
          updated_at?: string | null
        }
        Update: {
          base_amount?: number
          category?: Database["public"]["Enums"]["violation_category"]
          code?: string
          created_at?: string | null
          created_by_user_id?: string | null
          currency?: string | null
          description?: string
          discount_days?: number | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          legal_basis_ref?: string | null
          points?: number | null
          severity?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      violation_events: {
        Row: {
          accuracy_meters: number | null
          afroloc_code: string | null
          afroloc_id: string | null
          collector_type: Database["public"]["Enums"]["collector_type"]
          collector_user_id: string | null
          country_code: string | null
          created_at: string | null
          device_info: Json | null
          event_id: string
          event_timestamp: string
          evidence_bundle_id: string | null
          evidence_photo_paths: string[] | null
          evidence_video_paths: string[] | null
          geo_confidence_score: number | null
          geo_type: Database["public"]["Enums"]["geo_type"] | null
          hash_sha256: string
          id: string
          institution_id: string | null
          is_synced: boolean | null
          lat: number
          level1_code: string | null
          level1_name: string | null
          level2_code: string | null
          level2_name: string | null
          level3_code: string | null
          level3_name: string | null
          level4_code: string | null
          level4_name: string | null
          lon: number
          notes: string | null
          raw_data: Json | null
          subject_document_number: string | null
          subject_document_type: string | null
          subject_plate: string | null
          subject_type: string | null
          synced_at: string | null
          violation_category: Database["public"]["Enums"]["violation_category"]
          violation_code_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          afroloc_code?: string | null
          afroloc_id?: string | null
          collector_type: Database["public"]["Enums"]["collector_type"]
          collector_user_id?: string | null
          country_code?: string | null
          created_at?: string | null
          device_info?: Json | null
          event_id: string
          event_timestamp?: string
          evidence_bundle_id?: string | null
          evidence_photo_paths?: string[] | null
          evidence_video_paths?: string[] | null
          geo_confidence_score?: number | null
          geo_type?: Database["public"]["Enums"]["geo_type"] | null
          hash_sha256: string
          id?: string
          institution_id?: string | null
          is_synced?: boolean | null
          lat: number
          level1_code?: string | null
          level1_name?: string | null
          level2_code?: string | null
          level2_name?: string | null
          level3_code?: string | null
          level3_name?: string | null
          level4_code?: string | null
          level4_name?: string | null
          lon: number
          notes?: string | null
          raw_data?: Json | null
          subject_document_number?: string | null
          subject_document_type?: string | null
          subject_plate?: string | null
          subject_type?: string | null
          synced_at?: string | null
          violation_category: Database["public"]["Enums"]["violation_category"]
          violation_code_id: string
        }
        Update: {
          accuracy_meters?: number | null
          afroloc_code?: string | null
          afroloc_id?: string | null
          collector_type?: Database["public"]["Enums"]["collector_type"]
          collector_user_id?: string | null
          country_code?: string | null
          created_at?: string | null
          device_info?: Json | null
          event_id?: string
          event_timestamp?: string
          evidence_bundle_id?: string | null
          evidence_photo_paths?: string[] | null
          evidence_video_paths?: string[] | null
          geo_confidence_score?: number | null
          geo_type?: Database["public"]["Enums"]["geo_type"] | null
          hash_sha256?: string
          id?: string
          institution_id?: string | null
          is_synced?: boolean | null
          lat?: number
          level1_code?: string | null
          level1_name?: string | null
          level2_code?: string | null
          level2_name?: string | null
          level3_code?: string | null
          level3_name?: string | null
          level4_code?: string | null
          level4_name?: string | null
          lon?: number
          notes?: string | null
          raw_data?: Json | null
          subject_document_number?: string | null
          subject_document_type?: string | null
          subject_plate?: string | null
          subject_type?: string | null
          synced_at?: string | null
          violation_category?: Database["public"]["Enums"]["violation_category"]
          violation_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "violation_events_afroloc_id_fkey"
            columns: ["afroloc_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violation_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "fine_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violation_events_violation_code_id_fkey"
            columns: ["violation_code_id"]
            isOneToOne: false
            referencedRelation: "violation_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          error_message: string | null
          event: string
          failed_at: string | null
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          subscription_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event: string
          failed_at?: string | null
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          subscription_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event?: string
          failed_at?: string | null
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "webhook_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_subscriptions: {
        Row: {
          created_at: string
          events: string[]
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          secret: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          secret: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          secret?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      witness_contract_downloads: {
        Row: {
          afroloc_code: string
          afroloc_record_id: string
          created_at: string | null
          downloaded_at: string
          downloaded_by_user_id: string
          email_sent: boolean | null
          email_status: string | null
          id: string
          whatsapp_sent: boolean | null
          whatsapp_status: string | null
          witness_afro_id: string
          witness_id: string
        }
        Insert: {
          afroloc_code: string
          afroloc_record_id: string
          created_at?: string | null
          downloaded_at?: string
          downloaded_by_user_id: string
          email_sent?: boolean | null
          email_status?: string | null
          id?: string
          whatsapp_sent?: boolean | null
          whatsapp_status?: string | null
          witness_afro_id: string
          witness_id: string
        }
        Update: {
          afroloc_code?: string
          afroloc_record_id?: string
          created_at?: string | null
          downloaded_at?: string
          downloaded_by_user_id?: string
          email_sent?: boolean | null
          email_status?: string | null
          id?: string
          whatsapp_sent?: boolean | null
          whatsapp_status?: string | null
          witness_afro_id?: string
          witness_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "witness_contract_downloads_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "witness_contract_downloads_afroloc_witness_id_fkey"
            columns: ["witness_id"]
            isOneToOne: false
            referencedRelation: "afroloc_witnesses"
            referencedColumns: ["id"]
          },
        ]
      }
      witness_fraud_flags: {
        Row: {
          afroloc_record_id: string | null
          created_at: string | null
          description: string | null
          flag_type: string
          id: string
          metadata: Json | null
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          severity: string
          updated_at: string | null
          witness_user_id: string
        }
        Insert: {
          afroloc_record_id?: string | null
          created_at?: string | null
          description?: string | null
          flag_type: string
          id?: string
          metadata?: Json | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity?: string
          updated_at?: string | null
          witness_user_id: string
        }
        Update: {
          afroloc_record_id?: string | null
          created_at?: string | null
          description?: string | null
          flag_type?: string
          id?: string
          metadata?: Json | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity?: string
          updated_at?: string | null
          witness_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "witness_fraud_flags_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      witness_reputation_history: {
        Row: {
          action_type: string
          afroloc_record_id: string | null
          created_at: string | null
          created_by_user_id: string | null
          id: string
          new_score: number
          previous_score: number
          reason: string | null
          score_change: number
          witness_user_id: string
        }
        Insert: {
          action_type: string
          afroloc_record_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          id?: string
          new_score: number
          previous_score: number
          reason?: string | null
          score_change?: number
          witness_user_id: string
        }
        Update: {
          action_type?: string
          afroloc_record_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          id?: string
          new_score?: number
          previous_score?: number
          reason?: string | null
          score_change?: number
          witness_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "witness_reputation_history_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      yamioo_agents: {
        Row: {
          agent_number: number
          assigned_at: string
          assigned_by_user_id: string | null
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_number?: number
          assigned_at?: string
          assigned_by_user_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_number?: number
          assigned_at?: string
          assigned_by_user_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      expiring_resident_documents: {
        Row: {
          afroloc_code: string | null
          afroloc_record_id: string | null
          days_until_expiry: number | null
          document_number: string | null
          document_type:
            | Database["public"]["Enums"]["resident_document_type"]
            | null
          expiry_date: string | null
          full_name: string | null
          id: string | null
          phone: string | null
          resident_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_resident_documents_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "afroloc_residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afroloc_resident_documents_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "pending_resident_approvals"
            referencedColumns: ["resident_id"]
          },
          {
            foreignKeyName: "afroloc_residents_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      pending_resident_approvals: {
        Row: {
          afroloc_code: string | null
          afroloc_record_id: string | null
          commune: string | null
          country: string | null
          created_at: string | null
          full_name: string | null
          municipality: string | null
          pending_documents: number | null
          phone: string | null
          primary_approved_at: string | null
          province: string | null
          relationship:
            | Database["public"]["Enums"]["resident_relationship"]
            | null
          resident_id: string | null
          status:
            | Database["public"]["Enums"]["coresident_request_status"]
            | null
          user_id: string | null
          verified_documents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "afroloc_residents_afroloc_record_id_fkey"
            columns: ["afroloc_record_id"]
            isOneToOne: false
            referencedRelation: "afroloc_records"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      archive_old_gps_history: {
        Args: { retention_days?: number }
        Returns: Json
      }
      calculate_next_verification_date: {
        Args: {
          p_last_verified_at: string
          p_number: string
          p_street_name: string
        }
        Returns: string
      }
      calculate_witness_reputation: {
        Args: { p_user_id: string }
        Returns: number
      }
      can_change_phone_number: { Args: { p_user_id: string }; Returns: boolean }
      can_validate_batch: {
        Args: { _batch_id: string; _user_id: string }
        Returns: boolean
      }
      check_cell_creation_allowed: {
        Args: {
          p_cell_count?: number
          p_country_code: string
          p_lat?: number
          p_level1_code?: string
          p_lon?: number
          p_user_id: string
        }
        Returns: Json
      }
      check_phone_change_rate_limit: {
        Args: {
          p_attempt_type: string
          p_max_attempts?: number
          p_time_window_minutes?: number
          p_user_id: string
        }
        Returns: boolean
      }
      check_risk_alerts: { Args: never; Returns: undefined }
      cleanup_expired_2fa_codes: { Args: never; Returns: undefined }
      cleanup_expired_signup_otps: { Args: never; Returns: undefined }
      cleanup_old_security_events: { Args: never; Returns: undefined }
      cleanup_old_sessions: { Args: never; Returns: undefined }
      cleanup_phone_change_attempts: { Args: never; Returns: undefined }
      clear_urban_zones: { Args: never; Returns: undefined }
      count_unused_backup_codes: { Args: { _user_id: string }; Returns: number }
      create_validator_notification: {
        Args: {
          p_message: string
          p_metadata?: Json
          p_priority?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      detect_brute_force_attempts: {
        Args: never
        Returns: {
          failed_attempts: number
          ip_address: string
          last_attempt: string
          user_ids: string[]
        }[]
      }
      detect_witness_fraud_patterns: {
        Args: { p_afroloc_record_id: string; p_witness_user_id: string }
        Returns: {
          description: string
          flag_type: string
          metadata: Json
          severity: string
        }[]
      }
      determine_address_type: {
        Args: { p_number: string; p_street_code: string; p_street_name: string }
        Returns: string
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      find_nearby_cell_towers: {
        Args: {
          p_latitude: number
          p_limit?: number
          p_longitude: number
          p_radius_meters?: number
          p_technology?: string
        }
        Returns: {
          cell_id: string
          coverage_radius_meters: number
          distance_meters: number
          latitude: number
          longitude: number
          max_rsrp: number
          operator_name: string
          path_loss_exponent: number
          technology: string
          tower_id: string
        }[]
      }
      flag_witness_fraud: {
        Args: {
          p_afroloc_record_id: string
          p_description: string
          p_flag_type: string
          p_metadata?: Json
          p_severity: string
          p_witness_user_id: string
        }
        Returns: string
      }
      generate_batch_number: { Args: never; Returns: string }
      generate_fine_number: {
        Args: { p_institution_code: string }
        Returns: string
      }
      generate_violation_event_hash: {
        Args: {
          p_collector_type: string
          p_event_id: string
          p_lat: number
          p_lon: number
          p_timestamp: string
          p_violation_code: string
        }
        Returns: string
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_address_category: {
        Args: { p_number: string; p_street_name: string }
        Returns: string
      }
      get_fraud_detection_metrics: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          expired_otps: number
          fraud_risk_percentage: number
          rejected_validations: number
          suspicious_patterns: number
          total_requests: number
        }[]
      }
      get_phone_change_cooldown_days: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_security_stats: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          event_count: number
          event_type: string
          severity: string
          unique_ips: number
          unique_users: number
        }[]
      }
      get_superior_user_id: { Args: { _user_id: string }; Returns: string }
      get_telecom_operator_by_phone: {
        Args: { phone_number: string }
        Returns: {
          country_code: string
          operator_code: string
          operator_id: string
          operator_name: string
          otp_provider: string
        }[]
      }
      get_urban_zones_status: { Args: never; Returns: Json }
      get_user_by_phone: {
        Args: { p_phone: string }
        Returns: {
          afro_id: string
          created_at: string
          email: string
          full_name: string
          phone: string
          user_id: string
        }[]
      }
      get_validation_number_for_address: {
        Args: {
          p_country_code: string
          p_level1_code?: string
          p_level2_code?: string
          p_level3_code?: string
          p_level4_code?: string
        }
        Returns: {
          division_level: number
          division_name: string
          phone_number: string
          validator_user_id: string
        }[]
      }
      get_validation_stats_by_region: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          approval_rate: number
          approved_count: number
          avg_response_time_minutes: number
          region_name: string
          rejected_count: number
          total_validations: number
        }[]
      }
      get_validation_stats_by_validator: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          approval_rate: number
          approved_count: number
          avg_response_time_minutes: number
          rejected_count: number
          total_validations: number
          validator_id: string
          validator_name: string
        }[]
      }
      get_validation_trends: {
        Args: {
          p_end_date?: string
          p_interval?: string
          p_start_date?: string
        }
        Returns: {
          approved_count: number
          pending_count: number
          rejected_count: number
          time_bucket: string
          total_validations: number
        }[]
      }
      get_weighted_witness_score: {
        Args: { p_afroloc_record_id: string }
        Returns: {
          average_reputation: number
          confirmed_witnesses: number
          max_possible_score: number
          total_witnesses: number
          validated_witnesses: number
          weighted_score: number
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      has_admin_role: { Args: { _user_id: string }; Returns: boolean }
      has_fines_role: {
        Args: { _role_check: string; _user_id: string }
        Returns: boolean
      }
      has_jurisdiction_access: {
        Args: {
          _target_country: string
          _target_level1?: string
          _target_level2?: string
          _user_id: string
        }
        Returns: boolean
      }
      has_min_level: {
        Args: { _min_level: number; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_urban_zone: {
        Args: {
          p_admin_path: string
          p_geojson: string
          p_name: string
          p_source: string
        }
        Returns: number
      }
      import_urban_zones_bulk: {
        Args: { p_features: Json; p_source?: string }
        Returns: {
          feature_name: string
          imported_id: number
        }[]
      }
      increment_cell_creation_quota: {
        Args: {
          p_cell_count?: number
          p_country_code: string
          p_level1_code?: string
          p_user_id: string
        }
        Returns: undefined
      }
      is_phone_available: { Args: { p_phone: string }; Returns: boolean }
      is_primary_resident_for_record: {
        Args: { _afroloc_record_id: string }
        Returns: boolean
      }
      is_yamioo_agent: { Args: { p_user_id: string }; Returns: boolean }
      log_fine_audit: {
        Args: {
          p_action: string
          p_new_values?: Json
          p_object_id: string
          p_object_type: string
          p_old_values?: Json
          p_result?: string
        }
        Returns: string
      }
      log_phone_change_attempt: {
        Args: {
          p_attempt_type: string
          p_ip_address?: string
          p_phone_number: string
          p_user_id: string
        }
        Returns: undefined
      }
      log_security_event:
        | {
            Args: {
              _action: string
              _details?: Json
              _function_name: string
              _user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_details?: Json
              p_endpoint?: string
              p_event_type: string
              p_ip_address?: string
              p_severity: string
              p_user_agent?: string
              p_user_id?: string
            }
            Returns: string
          }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      merge_duplicate_profiles: { Args: never; Returns: undefined }
      podp_is_admin_lvl4: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      register_yamioo_agent: {
        Args: { p_assigned_by: string; p_notes?: string; p_user_id: string }
        Returns: {
          agent_number: number
          assigned_at: string
          assigned_by_user_id: string | null
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "yamioo_agents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_zone: {
        Args: {
          p_admin_path?: string
          p_explicit_zone?: string
          p_lat: number
          p_lon: number
        }
        Returns: string
      }
      resolve_zone_by_polygon: {
        Args: { p_lat: number; p_lon: number }
        Returns: boolean
      }
      setup_first_admin: {
        Args: { p_full_name: string; p_phone: string; p_user_id: string }
        Returns: undefined
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      trilaterate_position: {
        Args: { p_tower_signals: Json }
        Returns: {
          accuracy_meters: number
          confidence_score: number
          estimated_latitude: number
          estimated_longitude: number
          towers_used: number
        }[]
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_device_activity: {
        Args: { p_device_fingerprint: string; p_user_id: string }
        Returns: undefined
      }
      update_user_authorization_level: {
        Args: { _user_id: string }
        Returns: undefined
      }
      update_validation_number_usage: {
        Args: { p_phone_number: string }
        Returns: undefined
      }
      update_witness_reputation: {
        Args: {
          p_action_type: string
          p_afroloc_record_id: string
          p_created_by_user_id?: string
          p_reason?: string
          p_witness_user_id: string
        }
        Returns: number
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      afroloc_request_status:
        | "pending_otp"
        | "otp_verified"
        | "pending_document"
        | "pending_assignment"
        | "assigned"
        | "in_progress"
        | "pending_site_visit"
        | "completed"
        | "rejected"
        | "cancelled"
      afroloc_status:
        | "draft"
        | "verified"
        | "certified"
        | "pending_validation"
        | "approved"
        | "rejected"
        | "pending"
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "citizen"
        | "admin_national"
        | "admin_province"
        | "admin_municipality"
        | "operator_field"
        | "auditor_read"
        | "yamioo_agent"
      collector_type: "agent" | "radar" | "system" | "camera"
      coresident_request_status:
        | "pending_primary"
        | "pending_documents"
        | "pending_authority"
        | "approved"
        | "rejected"
        | "expired"
        | "revoked"
      delivery_point_status: "pending_otp" | "active" | "revoked" | "expired"
      delivery_point_type: "po_box" | "locker" | "pickup"
      fine_status:
        | "draft"
        | "issued"
        | "notified"
        | "paid"
        | "overdue"
        | "appealed"
        | "canceled"
        | "enforced"
      geo_type: "point" | "segment" | "area"
      resident_document_type:
        | "identity_card"
        | "passport"
        | "birth_certificate"
        | "marriage_certificate"
        | "rental_contract"
        | "property_deed"
        | "residence_declaration"
      resident_relationship:
        | "owner"
        | "tenant"
        | "spouse"
        | "child"
        | "parent"
        | "sibling"
        | "other_family"
        | "cohabitant"
      violation_category:
        | "transito"
        | "transporte"
        | "municipal"
        | "ambiental"
        | "comercial"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      afroloc_request_status: [
        "pending_otp",
        "otp_verified",
        "pending_document",
        "pending_assignment",
        "assigned",
        "in_progress",
        "pending_site_visit",
        "completed",
        "rejected",
        "cancelled",
      ],
      afroloc_status: [
        "draft",
        "verified",
        "certified",
        "pending_validation",
        "approved",
        "rejected",
        "pending",
      ],
      app_role: [
        "admin",
        "moderator",
        "user",
        "citizen",
        "admin_national",
        "admin_province",
        "admin_municipality",
        "operator_field",
        "auditor_read",
        "yamioo_agent",
      ],
      collector_type: ["agent", "radar", "system", "camera"],
      coresident_request_status: [
        "pending_primary",
        "pending_documents",
        "pending_authority",
        "approved",
        "rejected",
        "expired",
        "revoked",
      ],
      delivery_point_status: ["pending_otp", "active", "revoked", "expired"],
      delivery_point_type: ["po_box", "locker", "pickup"],
      fine_status: [
        "draft",
        "issued",
        "notified",
        "paid",
        "overdue",
        "appealed",
        "canceled",
        "enforced",
      ],
      geo_type: ["point", "segment", "area"],
      resident_document_type: [
        "identity_card",
        "passport",
        "birth_certificate",
        "marriage_certificate",
        "rental_contract",
        "property_deed",
        "residence_declaration",
      ],
      resident_relationship: [
        "owner",
        "tenant",
        "spouse",
        "child",
        "parent",
        "sibling",
        "other_family",
        "cohabitant",
      ],
      violation_category: [
        "transito",
        "transporte",
        "municipal",
        "ambiental",
        "comercial",
      ],
    },
  },
} as const
