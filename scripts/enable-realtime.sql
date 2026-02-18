-- Enable Real-time on Critical Tables
-- Execute this in Supabase SQL Editor after creating tables

-- Enable realtime publication for odds tables
ALTER PUBLICATION supabase_realtime ADD TABLE live_odds_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE mlb_odds;
ALTER PUBLICATION supabase_realtime ADD TABLE nfl_odds;
ALTER PUBLICATION supabase_realtime ADD TABLE nba_odds;
ALTER PUBLICATION supabase_realtime ADD TABLE nhl_odds;

-- Enable realtime for trading tables
ALTER PUBLICATION supabase_realtime ADD TABLE bet_allocations;
ALTER PUBLICATION supabase_realtime ADD TABLE edge_opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE arbitrage_opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE line_movement;
ALTER PUBLICATION supabase_realtime ADD TABLE portfolio_performance;

-- Configure replica identity for realtime
-- This ensures full row data is sent on updates/deletes
ALTER TABLE live_odds_cache REPLICA IDENTITY FULL;
ALTER TABLE bet_allocations REPLICA IDENTITY FULL;
ALTER TABLE edge_opportunities REPLICA IDENTITY FULL;
ALTER TABLE arbitrage_opportunities REPLICA IDENTITY FULL;
ALTER TABLE line_movement REPLICA IDENTITY FULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Real-time enabled on 10 tables. Use Supabase client to subscribe.';
END $$;
