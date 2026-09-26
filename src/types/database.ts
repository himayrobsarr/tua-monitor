export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AppRole = 'admin' | 'reporter'
export type TripStatus = 'EN_ROUTE' | 'FINISHED'
export type ControlType = 'STOP' | 'FINAL_ARRIVAL'
export type TripEventType =
  | 'TRIP_CREATED'
  | 'TRIP_UPDATED'
  | 'TRIP_FINISHED'
  | 'TRIP_REOPENED'
  | 'CONTROL_CREATED'
  | 'CONTROL_UPDATED'

export type Database = {
  public: {
    Tables: {
      trip_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          after_state: Json | null
          before_state: Json | null
          control_id: string | null
          event_type: TripEventType
          id: number
          occurred_at: string
          reason: string | null
          trip_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          control_id?: string | null
          event_type: TripEventType
          id?: number
          occurred_at?: string
          reason?: string | null
          trip_id: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          control_id?: string | null
          event_type?: TripEventType
          id?: number
          occurred_at?: string
          reason?: string | null
          trip_id?: string
        }
        Relationships: []
      }
      trip_controls: {
        Row: {
          control_type: string | null
          created_at: string
          id: string
          incident: string | null
          observation: string | null
          reported_at: string
          reported_by: string | null
          reported_location: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          control_type?: string | null
          created_at?: string
          id?: string
          incident?: string | null
          observation?: string | null
          reported_at?: string
          reported_by?: string | null
          reported_location?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          control_type?: string | null
          created_at?: string
          id?: string
          incident?: string | null
          observation?: string | null
          reported_at?: string
          reported_by?: string | null
          reported_location?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: AppRole
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: AppRole
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: AppRole
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          created_at: string
          destination: string | null
          driver: string
          finished_at: string | null
          id: string
          loading_date: string
          observations: string | null
          plate: string
          product: string | null
          status: TripStatus
          updated_at: string
          warehouse: string | null
        }
        Insert: {
          created_at?: string
          destination?: string | null
          driver: string
          finished_at?: string | null
          id?: string
          loading_date: string
          observations?: string | null
          plate: string
          product?: string | null
          status?: TripStatus
          updated_at?: string
          warehouse?: string | null
        }
        Update: {
          created_at?: string
          destination?: string | null
          driver?: string
          finished_at?: string | null
          id?: string
          loading_date?: string
          observations?: string | null
          plate?: string
          product?: string | null
          status?: TripStatus
          updated_at?: string
          warehouse?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      create_trip_control: {
        Args: {
          p_control_type: ControlType
          p_incident: string | null
          p_observation: string | null
          p_reason: string | null
          p_reported_at: string | null
          p_reported_location: string
          p_trip_id: string
        }
        Returns: Json
      }
      finish_trip: {
        Args: {
          p_expected_updated_at: string
          p_trip_id: string
        }
        Returns: Json
      }
      reopen_trip: {
        Args: {
          p_expected_updated_at: string
          p_reason: string
          p_trip_id: string
        }
        Returns: Json
      }
      update_trip_control: {
        Args: {
          p_control_id: string
          p_control_type: ControlType
          p_expected_updated_at: string
          p_incident: string | null
          p_observation: string | null
          p_reason: string | null
          p_reported_at: string
          p_reported_location: string
        }
        Returns: Json
      }
      update_trip_details: {
        Args: {
          p_destination: string | null
          p_driver: string
          p_expected_updated_at: string
          p_loading_date: string
          p_observations: string | null
          p_plate: string
          p_product: string | null
          p_reason: string | null
          p_trip_id: string
          p_warehouse: string | null
        }
        Returns: Json
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
