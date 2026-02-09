-- Predictions and Outcomes Tracking Migration
-- Created: 2026-02-09
-- Purpose: Track user predictions, outcomes, and performance analytics

-- Predictions Table
CREATE TABLE IF NOT EXISTS public.predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Prediction details
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('betting', 'dfs', 'fantasy', 'kalshi')),
  sport TEXT,
  event_id TEXT,
  event_description TEXT NOT NULL,
  
  -- Prediction data
  prediction_value JSONB NOT NULL,
  predicted_outcome TEXT,
  confidence_score NUMERIC(5,2) CHECK (confidence_score BETWEEN 0 AND 100),
  stake_amount NUMERIC(10,2),
  
  -- AI metadata
  ai_model TEXT DEFAULT 'grok-4-fast',
  ai_response_id TEXT,
  trust_metrics JSONB,
  
  -- Outcome tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'pushed', 'cancelled')),
  actual_outcome TEXT,
  result_determined_at TIMESTAMPTZ,
  payout_amount NUMERIC(10,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  event_date TIMESTAMPTZ
);

-- Prediction Performance Analytics (Materialized View)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.prediction_performance AS
SELECT 
  user_id,
  prediction_type,
  COUNT(*) as total_predictions,
  COUNT(*) FILTER (WHERE status = 'won') as wins,
  COUNT(*) FILTER (WHERE status = 'lost') as losses,
  COUNT(*) FILTER (WHERE status = 'pushed') as pushes,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'won')::NUMERIC / 
    NULLIF(COUNT(*) FILTER (WHERE status IN ('won', 'lost'))::NUMERIC, 0) * 100,
    2
  ) as win_rate,
  SUM(stake_amount) FILTER (WHERE status != 'cancelled') as total_invested,
  SUM(payout_amount) as total_payout,
  SUM(payout_amount) - SUM(stake_amount) FILTER (WHERE status != 'cancelled') as net_profit,
  ROUND(
    (SUM(payout_amount) - SUM(stake_amount) FILTER (WHERE status != 'cancelled')) / 
    NULLIF(SUM(stake_amount) FILTER (WHERE status != 'cancelled'), 0) * 100,
    2
  ) as roi,
  AVG(confidence_score) as avg_confidence,
  MAX(updated_at) as last_prediction_at
FROM public.predictions
GROUP BY user_id, prediction_type;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON public.predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_prediction_type ON public.predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_predictions_status ON public.predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON public.predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_event_date ON public.predictions(event_date);
CREATE INDEX IF NOT EXISTS idx_predictions_ai_response_id ON public.predictions(ai_response_id);
CREATE INDEX IF NOT EXISTS idx_predictions_sport ON public.predictions(sport);

-- Row Level Security
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own predictions"
  ON public.predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own predictions"
  ON public.predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own predictions"
  ON public.predictions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own predictions"
  ON public.predictions FOR DELETE
  USING (auth.uid() = user_id);

-- Functions
-- Function to update prediction performance materialized view
CREATE OR REPLACE FUNCTION public.refresh_prediction_performance()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.prediction_performance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-update prediction status based on outcomes
CREATE OR REPLACE FUNCTION public.update_prediction_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-calculate payout for won bets if not provided
  IF NEW.status = 'won' AND NEW.payout_amount IS NULL THEN
    -- Simple calculation: stake * 2 (actual odds should come from prediction_value)
    NEW.payout_amount := NEW.stake_amount * 2;
  END IF;
  
  -- Set result_determined_at timestamp
  IF NEW.status IN ('won', 'lost', 'pushed') AND OLD.status = 'pending' THEN
    NEW.result_determined_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_predictions_updated_at
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER auto_update_prediction_status
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW 
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.update_prediction_status();

-- Function to get user insights (combines multiple metrics)
CREATE OR REPLACE FUNCTION public.get_user_insights(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_predictions', COUNT(*),
    'pending_predictions', COUNT(*) FILTER (WHERE status = 'pending'),
    'win_rate', ROUND(
      COUNT(*) FILTER (WHERE status = 'won')::NUMERIC / 
      NULLIF(COUNT(*) FILTER (WHERE status IN ('won', 'lost'))::NUMERIC, 0) * 100,
      2
    ),
    'roi', ROUND(
      (SUM(payout_amount) - SUM(stake_amount) FILTER (WHERE status != 'cancelled')) / 
      NULLIF(SUM(stake_amount) FILTER (WHERE status != 'cancelled'), 0) * 100,
      2
    ),
    'total_invested', SUM(stake_amount) FILTER (WHERE status != 'cancelled'),
    'total_returned', SUM(payout_amount),
    'avg_confidence', ROUND(AVG(confidence_score), 2),
    'best_sport', (
      SELECT sport 
      FROM public.predictions 
      WHERE user_id = target_user_id AND status = 'won'
      GROUP BY sport 
      ORDER BY COUNT(*) DESC 
      LIMIT 1
    ),
    'by_type', (
      SELECT jsonb_object_agg(
        prediction_type,
        jsonb_build_object(
          'count', count,
          'win_rate', win_rate,
          'roi', roi
        )
      )
      FROM public.prediction_performance
      WHERE user_id = target_user_id
    )
  ) INTO result
  FROM public.predictions
  WHERE user_id = target_user_id;
  
  RETURN COALESCE(result, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON public.predictions TO authenticated;
GRANT SELECT ON public.prediction_performance TO authenticated;
