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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      bot_settings: {
        Row: {
          aggressive_mode: boolean | null
          allowed_pairs: string[] | null
          bot_name: string
          created_at: string | null
          enable_partial_profits: boolean | null
          enable_regime_boost: boolean | null
          enable_session_trading: boolean | null
          enable_trailing_stop: boolean | null
          enabled_pairs: string[] | null
          id: string
          is_active: boolean | null
          max_daily_loss: number | null
          max_daily_trades: number | null
          max_risk_per_trade: number | null
          min_confidence_score: number | null
          news_blackout_enabled: boolean | null
          partial_profit_levels: Json | null
          regime_expectancy_threshold: number | null
          session_multiplier: number | null
          stop_loss_pips: number | null
          take_profit_pips: number | null
          trading_hours: Json | null
          trading_mode: string | null
          trailing_stop: boolean | null
          trailing_stop_distance: number | null
          updated_at: string | null
          user_id: string | null
          volatility_multiplier: number | null
          volume_boost_max: number | null
          volume_boost_min: number | null
        }
        Insert: {
          aggressive_mode?: boolean | null
          allowed_pairs?: string[] | null
          bot_name?: string
          created_at?: string | null
          enable_partial_profits?: boolean | null
          enable_regime_boost?: boolean | null
          enable_session_trading?: boolean | null
          enable_trailing_stop?: boolean | null
          enabled_pairs?: string[] | null
          id?: string
          is_active?: boolean | null
          max_daily_loss?: number | null
          max_daily_trades?: number | null
          max_risk_per_trade?: number | null
          min_confidence_score?: number | null
          news_blackout_enabled?: boolean | null
          partial_profit_levels?: Json | null
          regime_expectancy_threshold?: number | null
          session_multiplier?: number | null
          stop_loss_pips?: number | null
          take_profit_pips?: number | null
          trading_hours?: Json | null
          trading_mode?: string | null
          trailing_stop?: boolean | null
          trailing_stop_distance?: number | null
          updated_at?: string | null
          user_id?: string | null
          volatility_multiplier?: number | null
          volume_boost_max?: number | null
          volume_boost_min?: number | null
        }
        Update: {
          aggressive_mode?: boolean | null
          allowed_pairs?: string[] | null
          bot_name?: string
          created_at?: string | null
          enable_partial_profits?: boolean | null
          enable_regime_boost?: boolean | null
          enable_session_trading?: boolean | null
          enable_trailing_stop?: boolean | null
          enabled_pairs?: string[] | null
          id?: string
          is_active?: boolean | null
          max_daily_loss?: number | null
          max_daily_trades?: number | null
          max_risk_per_trade?: number | null
          min_confidence_score?: number | null
          news_blackout_enabled?: boolean | null
          partial_profit_levels?: Json | null
          regime_expectancy_threshold?: number | null
          session_multiplier?: number | null
          stop_loss_pips?: number | null
          take_profit_pips?: number | null
          trading_hours?: Json | null
          trading_mode?: string | null
          trailing_stop?: boolean | null
          trailing_stop_distance?: number | null
          updated_at?: string | null
          user_id?: string | null
          volatility_multiplier?: number | null
          volume_boost_max?: number | null
          volume_boost_min?: number | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          actual: string | null
          affected_pairs: string[] | null
          created_at: string | null
          currency: string | null
          description: string | null
          event_date: string
          event_name: string
          forecast: string | null
          id: string
          impact: string | null
          previous: string | null
          source: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          actual?: string | null
          affected_pairs?: string[] | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          event_date: string
          event_name: string
          forecast?: string | null
          id?: string
          impact?: string | null
          previous?: string | null
          source?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          actual?: string | null
          affected_pairs?: string[] | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          event_date?: string
          event_name?: string
          forecast?: string | null
          id?: string
          impact?: string | null
          previous?: string | null
          source?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      currency_pairs: {
        Row: {
          base_currency: string
          created_at: string | null
          display_name: string
          id: string
          is_major: boolean | null
          max_trade_size: number | null
          min_trade_size: number | null
          quote_currency: string
          spread_typical: number | null
          symbol: string
          updated_at: string | null
        }
        Insert: {
          base_currency: string
          created_at?: string | null
          display_name: string
          id?: string
          is_major?: boolean | null
          max_trade_size?: number | null
          min_trade_size?: number | null
          quote_currency: string
          spread_typical?: number | null
          symbol: string
          updated_at?: string | null
        }
        Update: {
          base_currency?: string
          created_at?: string | null
          display_name?: string
          id?: string
          is_major?: boolean | null
          max_trade_size?: number | null
          min_trade_size?: number | null
          quote_currency?: string
          spread_typical?: number | null
          symbol?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      drift_events: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string
          metric: Json | null
          severity: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          metric?: Json | null
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          metric?: Json | null
          severity?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      economic_events: {
        Row: {
          actual: string | null
          affected_pairs: string[] | null
          country: string
          created_at: string | null
          currency: string
          description: string | null
          event_time: string
          forecast: string | null
          id: string
          impact: string
          previous: string | null
          title: string
        }
        Insert: {
          actual?: string | null
          affected_pairs?: string[] | null
          country: string
          created_at?: string | null
          currency: string
          description?: string | null
          event_time: string
          forecast?: string | null
          id?: string
          impact: string
          previous?: string | null
          title: string
        }
        Update: {
          actual?: string | null
          affected_pairs?: string[] | null
          country?: string
          created_at?: string | null
          currency?: string
          description?: string | null
          event_time?: string
          forecast?: string | null
          id?: string
          impact?: string
          previous?: string | null
          title?: string
        }
        Relationships: []
      }
      exness_sessions: {
        Row: {
          account_balance: number | null
          account_currency: string | null
          account_equity: number | null
          account_free_margin: number | null
          account_margin: number | null
          created_at: string
          expires_at: string | null
          id: string
          is_connected: boolean | null
          login_id: number
          server_name: string
          session_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_balance?: number | null
          account_currency?: string | null
          account_equity?: number | null
          account_free_margin?: number | null
          account_margin?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_connected?: boolean | null
          login_id: number
          server_name: string
          session_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_balance?: number | null
          account_currency?: string | null
          account_equity?: number | null
          account_free_margin?: number | null
          account_margin?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_connected?: boolean | null
          login_id?: number
          server_name?: string
          session_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fills: {
        Row: {
          created_at: string | null
          id: string
          liquidity_side: string | null
          price: number
          qty: number
          side: string
          slippage: number | null
          spread: number | null
          symbol: string
          ticket_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          liquidity_side?: string | null
          price: number
          qty: number
          side: string
          slippage?: number | null
          spread?: number | null
          symbol: string
          ticket_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          liquidity_side?: string | null
          price?: number
          qty?: number
          side?: string
          slippage?: number | null
          spread?: number | null
          symbol?: string
          ticket_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      live_trades: {
        Row: {
          closed_at: string | null
          commission: number | null
          created_at: string
          current_price: number | null
          entry_price: number
          id: string
          lot_size: number
          opened_at: string
          pair_id: string | null
          profit: number | null
          profit_pips: number | null
          status: string
          stop_loss: number | null
          swap: number | null
          symbol: string
          take_profit: number | null
          ticket_id: string | null
          trade_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          commission?: number | null
          created_at?: string
          current_price?: number | null
          entry_price: number
          id?: string
          lot_size?: number
          opened_at?: string
          pair_id?: string | null
          profit?: number | null
          profit_pips?: number | null
          status?: string
          stop_loss?: number | null
          swap?: number | null
          symbol: string
          take_profit?: number | null
          ticket_id?: string | null
          trade_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          commission?: number | null
          created_at?: string
          current_price?: number | null
          entry_price?: number
          id?: string
          lot_size?: number
          opened_at?: string
          pair_id?: string | null
          profit?: number | null
          profit_pips?: number | null
          status?: string
          stop_loss?: number | null
          swap?: number | null
          symbol?: string
          take_profit?: number | null
          ticket_id?: string | null
          trade_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_trades_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "currency_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      market_data: {
        Row: {
          ask: number
          bid: number
          created_at: string
          id: string
          spread: number
          symbol: string
          timestamp: string
          volume: number | null
        }
        Insert: {
          ask: number
          bid: number
          created_at?: string
          id?: string
          spread: number
          symbol: string
          timestamp?: string
          volume?: number | null
        }
        Update: {
          ask?: number
          bid?: number
          created_at?: string
          id?: string
          spread?: number
          symbol?: string
          timestamp?: string
          volume?: number | null
        }
        Relationships: []
      }
      news_sentiment: {
        Row: {
          affected_pairs: string[] | null
          content: string | null
          created_at: string | null
          headline: string
          id: string
          impact_level: string | null
          published_at: string
          sentiment: string
          sentiment_score: number | null
          source: string
        }
        Insert: {
          affected_pairs?: string[] | null
          content?: string | null
          created_at?: string | null
          headline: string
          id?: string
          impact_level?: string | null
          published_at: string
          sentiment: string
          sentiment_score?: number | null
          source: string
        }
        Update: {
          affected_pairs?: string[] | null
          content?: string | null
          created_at?: string | null
          headline?: string
          id?: string
          impact_level?: string | null
          published_at?: string
          sentiment?: string
          sentiment_score?: number | null
          source?: string
        }
        Relationships: []
      }
      price_data: {
        Row: {
          close_price: number
          created_at: string | null
          high_price: number
          id: string
          low_price: number
          open_price: number
          pair_id: string | null
          timeframe: string
          timestamp: string
          volume: number | null
        }
        Insert: {
          close_price: number
          created_at?: string | null
          high_price: number
          id?: string
          low_price: number
          open_price: number
          pair_id?: string | null
          timeframe: string
          timestamp: string
          volume?: number | null
        }
        Update: {
          close_price?: number
          created_at?: string | null
          high_price?: number
          id?: string
          low_price?: number
          open_price?: number
          pair_id?: string | null
          timeframe?: string
          timestamp?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_data_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "currency_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      risk_limits: {
        Row: {
          created_at: string | null
          id: string
          max_daily_loss: number | null
          max_drawdown: number | null
          max_risk_per_trade: number | null
          user_id: string | null
          var_limit: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_daily_loss?: number | null
          max_drawdown?: number | null
          max_risk_per_trade?: number | null
          user_id?: string | null
          var_limit?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_daily_loss?: number | null
          max_drawdown?: number | null
          max_risk_per_trade?: number | null
          user_id?: string | null
          var_limit?: number | null
        }
        Relationships: []
      }
      trade_journal: {
        Row: {
          closed_at: string | null
          created_at: string | null
          decision_features: Json | null
          entry_price: number | null
          exit_price: number | null
          id: string
          modeled_slippage: number | null
          opened_at: string | null
          pnl: number | null
          pnl_pips: number | null
          realized_slippage: number | null
          regime_tag: string | null
          session_tag: string | null
          side: string
          spread_at_entry: number | null
          symbol: string
          ticket_id: string | null
          updated_at: string | null
          user_id: string | null
          volume: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          decision_features?: Json | null
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          modeled_slippage?: number | null
          opened_at?: string | null
          pnl?: number | null
          pnl_pips?: number | null
          realized_slippage?: number | null
          regime_tag?: string | null
          session_tag?: string | null
          side: string
          spread_at_entry?: number | null
          symbol: string
          ticket_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          volume: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          decision_features?: Json | null
          entry_price?: number | null
          exit_price?: number | null
          id?: string
          modeled_slippage?: number | null
          opened_at?: string | null
          pnl?: number | null
          pnl_pips?: number | null
          realized_slippage?: number | null
          regime_tag?: string | null
          session_tag?: string | null
          side?: string
          spread_at_entry?: number | null
          symbol?: string
          ticket_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          volume?: number
        }
        Relationships: []
      }
      trades: {
        Row: {
          closed_at: string | null
          commission: number | null
          created_at: string | null
          entry_price: number
          exit_price: number | null
          id: string
          opened_at: string | null
          pair_id: string | null
          pnl: number | null
          pnl_percentage: number | null
          quantity: number
          signal_id: string | null
          status: string | null
          stop_loss: number | null
          take_profit: number | null
          trade_mode: string | null
          trade_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          closed_at?: string | null
          commission?: number | null
          created_at?: string | null
          entry_price: number
          exit_price?: number | null
          id?: string
          opened_at?: string | null
          pair_id?: string | null
          pnl?: number | null
          pnl_percentage?: number | null
          quantity: number
          signal_id?: string | null
          status?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          trade_mode?: string | null
          trade_type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          closed_at?: string | null
          commission?: number | null
          created_at?: string | null
          entry_price?: number
          exit_price?: number | null
          id?: string
          opened_at?: string | null
          pair_id?: string | null
          pnl?: number | null
          pnl_percentage?: number | null
          quantity?: number
          signal_id?: string | null
          status?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          trade_mode?: string | null
          trade_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trades_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "currency_pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "trading_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_accounts: {
        Row: {
          account_number: string
          balance: number | null
          created_at: string
          currency: string | null
          equity: number | null
          free_margin: number | null
          id: string
          is_active: boolean | null
          is_demo: boolean | null
          leverage: string | null
          margin: number | null
          margin_level: number | null
          server: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          balance?: number | null
          created_at?: string
          currency?: string | null
          equity?: number | null
          free_margin?: number | null
          id?: string
          is_active?: boolean | null
          is_demo?: boolean | null
          leverage?: string | null
          margin?: number | null
          margin_level?: number | null
          server: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          balance?: number | null
          created_at?: string
          currency?: string | null
          equity?: number | null
          free_margin?: number | null
          id?: string
          is_active?: boolean | null
          is_demo?: boolean | null
          leverage?: string | null
          margin?: number | null
          margin_level?: number | null
          server?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_signals: {
        Row: {
          ai_model: string | null
          confidence_score: number
          created_at: string | null
          entry_price: number
          expires_at: string | null
          id: string
          pair_id: string | null
          reasoning: string | null
          signal_type: string
          status: string | null
          stop_loss: number | null
          take_profit: number | null
          timeframe: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_model?: string | null
          confidence_score: number
          created_at?: string | null
          entry_price: number
          expires_at?: string | null
          id?: string
          pair_id?: string | null
          reasoning?: string | null
          signal_type: string
          status?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          timeframe: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_model?: string | null
          confidence_score?: number
          created_at?: string | null
          entry_price?: number
          expires_at?: string | null
          id?: string
          pair_id?: string | null
          reasoning?: string | null
          signal_type?: string
          status?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          timeframe?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trading_signals_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "currency_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_portfolios: {
        Row: {
          account_type: string | null
          balance: number | null
          created_at: string | null
          daily_pnl: number | null
          equity: number | null
          free_margin: number | null
          id: string
          margin_level: number | null
          margin_used: number | null
          total_pnl: number | null
          total_trades: number | null
          updated_at: string | null
          user_id: string | null
          win_rate: number | null
          winning_trades: number | null
        }
        Insert: {
          account_type?: string | null
          balance?: number | null
          created_at?: string | null
          daily_pnl?: number | null
          equity?: number | null
          free_margin?: number | null
          id?: string
          margin_level?: number | null
          margin_used?: number | null
          total_pnl?: number | null
          total_trades?: number | null
          updated_at?: string | null
          user_id?: string | null
          win_rate?: number | null
          winning_trades?: number | null
        }
        Update: {
          account_type?: string | null
          balance?: number | null
          created_at?: string | null
          daily_pnl?: number | null
          equity?: number | null
          free_margin?: number | null
          id?: string
          margin_level?: number | null
          margin_used?: number | null
          total_pnl?: number | null
          total_trades?: number | null
          updated_at?: string | null
          user_id?: string | null
          win_rate?: number | null
          winning_trades?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      secure_exness_sessions: {
        Row: {
          account_balance: number | null
          account_currency: string | null
          account_equity: number | null
          account_free_margin: number | null
          account_margin: number | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          is_connected: boolean | null
          login_id: number | null
          server_name: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_balance?: number | null
          account_currency?: string | null
          account_equity?: number | null
          account_free_margin?: number | null
          account_margin?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          is_connected?: boolean | null
          login_id?: number | null
          server_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_balance?: number | null
          account_currency?: string | null
          account_equity?: number | null
          account_free_margin?: number | null
          account_margin?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          is_connected?: boolean | null
          login_id?: number | null
          server_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      decrypt_session_token: {
        Args: { encrypted_token: string }
        Returns: string
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "trader" | "viewer"
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
      app_role: ["admin", "trader", "viewer"],
    },
  },
} as const
