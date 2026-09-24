export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AppRole = 'admin' | 'reporter'

export type Database = {
  public: {
    Tables: {
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
          status: string
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
          status?: string
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
          status?: string
          updated_at?: string
          warehouse?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
