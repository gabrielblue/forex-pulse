-- Add regime boost and news blackout settings to bot_settings table
-- Migration: 20240822_add_regime_boost_and_news_settings

-- Add regime boost configuration columns
ALTER TABLE bot_settings 
ADD COLUMN IF NOT EXISTS enable_regime_boost BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS regime_expectancy_threshold NUMERIC DEFAULT 85,
ADD COLUMN IF NOT EXISTS volume_boost_min NUMERIC DEFAULT 0.10,
ADD COLUMN IF NOT EXISTS volume_boost_max NUMERIC DEFAULT 0.20;

-- Add news blackout setting
ALTER TABLE bot_settings 
ADD COLUMN IF NOT EXISTS news_blackout_enabled BOOLEAN DEFAULT false;

-- Add trailing stop and partial profit settings
ALTER TABLE bot_settings 
ADD COLUMN IF NOT EXISTS enable_trailing_stop BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trailing_stop_distance NUMERIC DEFAULT 20,
ADD COLUMN IF NOT EXISTS enable_partial_profits BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS partial_profit_levels JSONB DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN bot_settings.enable_regime_boost IS 'Enable regime-based volume boost when expectancy exceeds threshold';
COMMENT ON COLUMN bot_settings.regime_expectancy_threshold IS 'Expectancy threshold (0-100) for regime boost activation';
COMMENT ON COLUMN bot_settings.volume_boost_min IS 'Minimum volume boost percentage (0.0-0.5)';
COMMENT ON COLUMN bot_settings.volume_boost_max IS 'Maximum volume boost percentage (0.0-0.5)';
COMMENT ON COLUMN bot_settings.news_blackout_enabled IS 'Enable news blackout to prevent trading during high-impact events';
COMMENT ON COLUMN bot_settings.enable_trailing_stop IS 'Enable trailing stop loss for open positions';
COMMENT ON COLUMN bot_settings.trailing_stop_distance IS 'Trailing stop distance in pips';
COMMENT ON COLUMN bot_settings.enable_partial_profits IS 'Enable partial profit taking at specified levels';
COMMENT ON COLUMN bot_settings.partial_profit_levels IS 'JSON array of partial profit levels with percentages and distances';

-- Create calendar_events table for economic calendar data
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    currency TEXT,
    impact TEXT CHECK (impact IN ('LOW', 'MEDIUM', 'HIGH')),
    forecast TEXT,
    previous TEXT,
    actual TEXT,
    source TEXT,
    description TEXT,
    affected_pairs TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_impact ON calendar_events(impact);

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for calendar_events
CREATE POLICY "Users can view their own calendar events" ON calendar_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar events" ON calendar_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events" ON calendar_events
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar events" ON calendar_events
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for calendar_events
CREATE TRIGGER update_calendar_events_updated_at 
    BEFORE UPDATE ON calendar_events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();