-- Create user_alerts table for price/odds alerts
CREATE TABLE IF NOT EXISTS public.user_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  alert_type character varying NOT NULL DEFAULT 'odds_change',
  sport character varying,
  team character varying,
  player character varying,
  title character varying NOT NULL,
  description text,
  threshold numeric,
  max_triggers integer DEFAULT 1,
  trigger_count integer DEFAULT 0,
  condition jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  last_triggered_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS policies
ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
  ON public.user_alerts FOR SELECT
  USING (user_id IN (
    SELECT id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own alerts"
  ON public.user_alerts FOR INSERT
  WITH CHECK (user_id IN (
    SELECT id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own alerts"
  ON public.user_alerts FOR UPDATE
  USING (user_id IN (
    SELECT id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own alerts"
  ON public.user_alerts FOR DELETE
  USING (user_id IN (
    SELECT id FROM public.user_profiles WHERE user_profiles.user_id = auth.uid()
  ));

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_alerts_user_id ON public.user_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_alerts_active ON public.user_alerts(is_active) WHERE is_active = true;
