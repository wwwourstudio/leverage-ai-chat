-- ============================================================================
-- LEVERAGE AI - FANTASY PLATFORM SCHEMA
-- Database tables for fantasy sports intelligence modules
-- Execute in Supabase SQL Editor after master-schema.sql
-- ============================================================================

-- ============================================================================
-- 1. FANTASY LEAGUES (Manual Import)
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  name VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  platform VARCHAR(50),
  league_size INT NOT NULL DEFAULT 12,
  scoring_type VARCHAR(50) DEFAULT 'ppr',
  scoring_settings JSONB DEFAULT '{}',
  roster_slots JSONB DEFAULT '{}',
  draft_type VARCHAR(20) DEFAULT 'snake',
  faab_budget INT DEFAULT 100,
  trade_deadline TIMESTAMPTZ,
  season_year INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_user ON fantasy_leagues(user_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_sport ON fantasy_leagues(sport);

-- ============================================================================
-- 2. FANTASY TEAMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  team_name VARCHAR(255) NOT NULL,
  draft_position INT,
  is_user_team BOOLEAN DEFAULT false,
  record_wins INT DEFAULT 0,
  record_losses INT DEFAULT 0,
  record_ties INT DEFAULT 0,
  points_for NUMERIC DEFAULT 0,
  points_against NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fantasy_teams_league ON fantasy_teams(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_user ON fantasy_teams(user_id);

-- ============================================================================
-- 3. FANTASY ROSTERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  player_name VARCHAR(255) NOT NULL,
  player_id VARCHAR(100),
  position VARCHAR(10) NOT NULL,
  roster_slot VARCHAR(20) NOT NULL,
  acquisition_type VARCHAR(20) DEFAULT 'draft',
  acquisition_cost INT DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fantasy_rosters_team ON fantasy_rosters(team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_rosters_player ON fantasy_rosters(player_name);

-- ============================================================================
-- 4. PLAYER PROJECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS fantasy_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport VARCHAR(50) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  player_id VARCHAR(100),
  position VARCHAR(10) NOT NULL,
  season_year INT NOT NULL,
  week INT,
  projection_source VARCHAR(50) DEFAULT 'consensus',
  stats JSONB NOT NULL,
  fantasy_points NUMERIC,
  adp NUMERIC,
  vbd NUMERIC,
  tier INT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sport, player_name, season_year, week, projection_source)
);

CREATE INDEX IF NOT EXISTS idx_projections_sport_pos ON fantasy_projections(sport, position);
CREATE INDEX IF NOT EXISTS idx_projections_vbd ON fantasy_projections(vbd DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_projections_adp ON fantasy_projections(adp ASC NULLS LAST);

-- ============================================================================
-- 5. DRAFT ROOMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS draft_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  current_pick INT DEFAULT 1,
  total_picks INT,
  draft_order JSONB,
  settings JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draft_rooms_league ON draft_rooms(league_id);
CREATE INDEX IF NOT EXISTS idx_draft_rooms_status ON draft_rooms(status);

-- ============================================================================
-- 6. DRAFT PICKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS draft_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_room_id UUID NOT NULL REFERENCES draft_rooms(id) ON DELETE CASCADE,
  pick_number INT NOT NULL,
  round INT NOT NULL,
  team_id UUID NOT NULL REFERENCES fantasy_teams(id),
  player_name VARCHAR(255) NOT NULL,
  position VARCHAR(10) NOT NULL,
  vbd_at_pick NUMERIC,
  recommendation VARCHAR(255),
  was_recommended BOOLEAN DEFAULT false,
  survival_probability NUMERIC,
  picked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_picks_draft ON draft_picks(draft_room_id, pick_number);
CREATE INDEX IF NOT EXISTS idx_picks_team ON draft_picks(team_id);

-- ============================================================================
-- 7. WAIVER TRANSACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS waiver_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES fantasy_leagues(id),
  team_id UUID NOT NULL REFERENCES fantasy_teams(id),
  add_player VARCHAR(255) NOT NULL,
  drop_player VARCHAR(255),
  faab_bid INT DEFAULT 0,
  bid_recommended INT,
  status VARCHAR(20) DEFAULT 'pending',
  week INT NOT NULL,
  breakout_score NUMERIC,
  reason TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waivers_league ON waiver_transactions(league_id, week);
CREATE INDEX IF NOT EXISTS idx_waivers_status ON waiver_transactions(status);

-- ============================================================================
-- 8. DFS LINEUPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS dfs_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  platform VARCHAR(20) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  contest_type VARCHAR(20) NOT NULL,
  slate_date DATE NOT NULL,
  players JSONB NOT NULL,
  total_salary INT NOT NULL,
  projected_points NUMERIC NOT NULL,
  projected_ownership NUMERIC,
  sharpe_ratio NUMERIC,
  actual_points NUMERIC,
  lineup_group_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dfs_user_date ON dfs_lineups(user_id, slate_date);
CREATE INDEX IF NOT EXISTS idx_dfs_group ON dfs_lineups(lineup_group_id);

-- ============================================================================
-- 9. BANKROLL TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS bankroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  entry_type VARCHAR(20) NOT NULL,
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  sport VARCHAR(50),
  platform VARCHAR(50),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bankroll_user ON bankroll_entries(user_id, created_at DESC);

-- ============================================================================
-- 10. SUBSCRIPTION TIERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) UNIQUE,
  tier VARCHAR(20) NOT NULL DEFAULT 'free',
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_user ON subscription_tiers(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_tier ON subscription_tiers(tier);

-- ============================================================================
-- 11. INJURY ALERTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS injury_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  injury_type VARCHAR(100),
  source_text TEXT,
  projection_delta NUMERIC,
  beneficiary_players JSONB DEFAULT '[]',
  notified_users JSONB DEFAULT '[]',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  game_time TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_injury_sport ON injury_alerts(sport, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_injury_player ON injury_alerts(player_name);

-- ============================================================================
-- 12. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE fantasy_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiver_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE bankroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;

-- Users can only see their own leagues
CREATE POLICY fantasy_leagues_user_policy ON fantasy_leagues
  FOR ALL USING (user_id = auth.uid());

-- Users can see teams in their leagues
CREATE POLICY fantasy_teams_user_policy ON fantasy_teams
  FOR ALL USING (
    league_id IN (SELECT id FROM fantasy_leagues WHERE user_id = auth.uid())
  );

-- Users can see rosters in their leagues
CREATE POLICY fantasy_rosters_user_policy ON fantasy_rosters
  FOR ALL USING (
    team_id IN (
      SELECT ft.id FROM fantasy_teams ft
      JOIN fantasy_leagues fl ON ft.league_id = fl.id
      WHERE fl.user_id = auth.uid()
    )
  );

-- Draft rooms: users can see drafts for their leagues
CREATE POLICY draft_rooms_user_policy ON draft_rooms
  FOR ALL USING (
    league_id IN (SELECT id FROM fantasy_leagues WHERE user_id = auth.uid())
  );

-- Draft picks: users can see picks in their draft rooms
CREATE POLICY draft_picks_user_policy ON draft_picks
  FOR ALL USING (
    draft_room_id IN (
      SELECT dr.id FROM draft_rooms dr
      JOIN fantasy_leagues fl ON dr.league_id = fl.id
      WHERE fl.user_id = auth.uid()
    )
  );

-- Waiver transactions: users can see their league waivers
CREATE POLICY waiver_txns_user_policy ON waiver_transactions
  FOR ALL USING (
    league_id IN (SELECT id FROM fantasy_leagues WHERE user_id = auth.uid())
  );

-- DFS lineups: users can only see their own
CREATE POLICY dfs_lineups_user_policy ON dfs_lineups
  FOR ALL USING (user_id = auth.uid());

-- Bankroll: users can only see their own
CREATE POLICY bankroll_user_policy ON bankroll_entries
  FOR ALL USING (user_id = auth.uid());

-- Subscriptions: users can only see their own
CREATE POLICY subscription_user_policy ON subscription_tiers
  FOR ALL USING (user_id = auth.uid());

-- Projections are readable by all authenticated users
ALTER TABLE fantasy_projections ENABLE ROW LEVEL SECURITY;
CREATE POLICY projections_read_policy ON fantasy_projections
  FOR SELECT USING (auth.role() = 'authenticated');

-- Injury alerts are readable by all authenticated users
CREATE POLICY injury_alerts_read_policy ON injury_alerts
  FOR SELECT USING (auth.role() = 'authenticated');
