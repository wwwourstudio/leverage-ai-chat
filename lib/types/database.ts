// Database types generated from schema
// Corresponds to Supabase migrations

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          credits_balance: number
          total_credits_purchased: number
          total_credits_spent: number
          created_at: string
          updated_at: string
          last_seen_at: string | null
          preferences: Json
          metadata: Json
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          credits_balance?: number
          total_credits_purchased?: number
          total_credits_spent?: number
          created_at?: string
          updated_at?: string
          last_seen_at?: string | null
          preferences?: Json
          metadata?: Json
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          credits_balance?: number
          total_credits_purchased?: number
          total_credits_spent?: number
          created_at?: string
          updated_at?: string
          last_seen_at?: string | null
          preferences?: Json
          metadata?: Json
        }
      }
      chats: {
        Row: {
          id: string
          user_id: string
          title: string
          category: 'betting' | 'fantasy' | 'dfs' | 'kalshi' | 'general'
          is_starred: boolean
          is_archived: boolean
          created_at: string
          updated_at: string
          last_message_at: string | null
          message_count: number
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          category: 'betting' | 'fantasy' | 'dfs' | 'kalshi' | 'general'
          is_starred?: boolean
          is_archived?: boolean
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
          message_count?: number
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          category?: 'betting' | 'fantasy' | 'dfs' | 'kalshi' | 'general'
          is_starred?: boolean
          is_archived?: boolean
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
          message_count?: number
          metadata?: Json
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          user_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          created_at: string
          model: string | null
          tokens_used: number | null
          credits_charged: number
          trust_score: number | null
          confidence_level: 'very_high' | 'high' | 'medium' | 'low' | 'very_low' | null
          validation_status: 'pending' | 'validated' | 'flagged' | 'failed' | null
          validation_details: Json | null
          attachments: Json
          context_data: Json
          metadata: Json
        }
        Insert: {
          id?: string
          chat_id: string
          user_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          created_at?: string
          model?: string | null
          tokens_used?: number | null
          credits_charged?: number
          trust_score?: number | null
          confidence_level?: 'very_high' | 'high' | 'medium' | 'low' | 'very_low' | null
          validation_status?: 'pending' | 'validated' | 'flagged' | 'failed' | null
          validation_details?: Json | null
          attachments?: Json
          context_data?: Json
          metadata?: Json
        }
        Update: {
          id?: string
          chat_id?: string
          user_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          created_at?: string
          model?: string | null
          tokens_used?: number | null
          credits_charged?: number
          trust_score?: number | null
          confidence_level?: 'very_high' | 'high' | 'medium' | 'low' | 'very_low' | null
          validation_status?: 'pending' | 'validated' | 'flagged' | 'failed' | null
          validation_details?: Json | null
          attachments?: Json
          context_data?: Json
          metadata?: Json
        }
      }
      credits_ledger: {
        Row: {
          id: string
          user_id: string
          amount: number
          balance_after: number
          transaction_type: 'purchase' | 'grant' | 'refund' | 'message_charge' | 'bonus' | 'deduction'
          description: string
          message_id: string | null
          chat_id: string | null
          created_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          balance_after: number
          transaction_type: 'purchase' | 'grant' | 'refund' | 'message_charge' | 'bonus' | 'deduction'
          description: string
          message_id?: string | null
          chat_id?: string | null
          created_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          balance_after?: number
          transaction_type?: 'purchase' | 'grant' | 'refund' | 'message_charge' | 'bonus' | 'deduction'
          description?: string
          message_id?: string | null
          chat_id?: string | null
          created_at?: string
          metadata?: Json
        }
      }
      odds_cache: {
        Row: {
          id: string
          sport: string
          league: string
          event_id: string
          event_name: string
          commence_time: string
          bookmaker: string
          market: string
          odds_data: Json
          created_at: string
          expires_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          sport: string
          league: string
          event_id: string
          event_name: string
          commence_time: string
          bookmaker: string
          market: string
          odds_data: Json
          created_at?: string
          expires_at: string
          metadata?: Json
        }
        Update: {
          id?: string
          sport?: string
          league?: string
          event_id?: string
          event_name?: string
          commence_time?: string
          bookmaker?: string
          market?: string
          odds_data?: Json
          created_at?: string
          expires_at?: string
          metadata?: Json
        }
      }
      user_portfolios: {
        Row: {
          id: string
          user_id: string
          category: 'betting' | 'fantasy' | 'dfs' | 'kalshi'
          position_type: string
          event_name: string
          entry_details: Json
          stake_amount: number
          potential_return: number
          current_value: number
          status: 'pending' | 'active' | 'settled' | 'cancelled'
          result: 'win' | 'loss' | 'push' | null
          created_at: string
          updated_at: string
          settled_at: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          category: 'betting' | 'fantasy' | 'dfs' | 'kalshi'
          position_type: string
          event_name: string
          entry_details: Json
          stake_amount: number
          potential_return: number
          current_value?: number
          status?: 'pending' | 'active' | 'settled' | 'cancelled'
          result?: 'win' | 'loss' | 'push' | null
          created_at?: string
          updated_at?: string
          settled_at?: string | null
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          category?: 'betting' | 'fantasy' | 'dfs' | 'kalshi'
          position_type?: string
          event_name?: string
          entry_details?: Json
          stake_amount?: number
          potential_return?: number
          current_value?: number
          status?: 'pending' | 'active' | 'settled' | 'cancelled'
          result?: 'win' | 'loss' | 'push' | null
          created_at?: string
          updated_at?: string
          settled_at?: string | null
          metadata?: Json
        }
      }
    }
  }
}
