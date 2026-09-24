export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      trip_controls: {
        Row: {
          control_type: string
          created_at: string
          id: string
          incident: string | null
          observation: string | null
          reported_at: string
          reported_location: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          control_type: string
          created_at?: string
          id?: string
          incident?: string | null
          observation?: string | null
          reported_at: string
          reported_location?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          control_type?: string
          created_at?: string
          id?: string
          incident?: string | null
          observation?: string | null
          reported_at?: string
          reported_location?: string | null
          trip_id?: string
          updated_at?: string
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
