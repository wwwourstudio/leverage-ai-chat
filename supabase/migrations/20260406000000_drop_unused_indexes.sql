-- =============================================================================
-- Migration: Drop 190 unused indexes (idx_scan = 0)
-- Generated: 2026-04-06
-- Project:   Leverage2 (xvhdomnjhlbxzocayocg)
-- =============================================================================
--
-- WHAT THIS FILE DOES
-- Drops every non-primary-key, non-unique-constraint index in the api and
-- public schemas that has never been used (pg_stat_user_indexes.idx_scan = 0).
-- Primary key indexes and unique constraint indexes are intentionally preserved.
-- The four explicitly-protected active indexes are NOT in this list because they
-- already show idx_scan > 0:
--   idx_chat_threads_user_id, idx_chat_messages_thread_id,
--   idx_user_credits_user_id, idx_kalshi_markets_market_id
--
-- ORPHANED SUBSYSTEMS (all indexes unused — flag for table-drop in next sprint)
--   api.backup_daily_picks, api.backup_live_odds        — backup snapshots
--   api.market_anomalies, api.market_predictions,
--   api.market_snapshots, api.market_outcomes           — unused market-analysis pipeline
--   api.model_predictions, api.model_versions,
--   api.signal_performance, api.movement_events         — unused ML-model tracking
--   public.conversations, public.conversation_members,
--   public.messages, public.message_attachments         — legacy chat schema (replaced by api.chat_threads)
--   public.tenants                                      — multi-tenancy never activated
--   public.dfs_lineups                                  — DFS lineup storage never read
--   public.predictions, public.user_predictions,
--   public.user_bets                                    — old prediction tracking (superseded by api schema)
--
-- NOTE ON CONCURRENTLY
-- `DROP INDEX CONCURRENTLY` cannot run inside a transaction block.
-- This file uses plain DROP INDEX IF EXISTS so it works with `supabase db push`.
-- To run without any lock, execute each statement individually in the Supabase
-- SQL editor (which runs outside a transaction) and add the CONCURRENTLY keyword.
--
-- =============================================================================

-- ---------------------------------------------------------------------------
-- api schema
-- ---------------------------------------------------------------------------

-- api.adp_upload_history
DROP INDEX IF EXISTS api.idx_adp_upload_history_uploaded_by;

-- api.ai_feedback
DROP INDEX IF EXISTS api.idx_ai_feedback_user;
DROP INDEX IF EXISTS api.idx_ai_feedback_vote;

-- api.ai_predictions
DROP INDEX IF EXISTS api.idx_ai_predictions_created;
DROP INDEX IF EXISTS api.idx_ai_predictions_user;

-- api.arbitrage_opportunities
DROP INDEX IF EXISTS api.idx_arb_expires;
DROP INDEX IF EXISTS api.idx_arb_profit;
DROP INDEX IF EXISTS api.idx_arb_sport;
DROP INDEX IF EXISTS api.idx_arb_status;

-- api.bet_allocations
DROP INDEX IF EXISTS api.idx_bet_allocations_capital_state_id;
DROP INDEX IF EXISTS api.idx_bet_allocations_created;
DROP INDEX IF EXISTS api.idx_bet_allocations_market;
DROP INDEX IF EXISTS api.idx_bet_allocations_sport;
DROP INDEX IF EXISTS api.idx_bet_allocations_status;

-- api.capital_state
DROP INDEX IF EXISTS api.idx_capital_state_active;

-- api.chat_messages
DROP INDEX IF EXISTS api.idx_chat_messages_created;

-- api.chat_threads
DROP INDEX IF EXISTS api.idx_chat_threads_share_token;
DROP INDEX IF EXISTS api.idx_chat_threads_user_category;

-- api.closing_lines
DROP INDEX IF EXISTS api.closing_lines_game;

-- api.daily_picks
DROP INDEX IF EXISTS api.idx_daily_picks_player_id;

-- api.draft_picks
DROP INDEX IF EXISTS api.idx_draft_picks_draft_room_id;
DROP INDEX IF EXISTS api.idx_draft_picks_pick_number;
DROP INDEX IF EXISTS api.idx_draft_picks_team_id;

-- api.draft_rooms
DROP INDEX IF EXISTS api.idx_draft_rooms_league_id;
DROP INDEX IF EXISTS api.idx_draft_rooms_status;

-- api.fantasy_leagues
DROP INDEX IF EXISTS api.idx_fantasy_leagues_season_year;
DROP INDEX IF EXISTS api.idx_fantasy_leagues_sport;
DROP INDEX IF EXISTS api.idx_fantasy_leagues_user_id;

-- api.fantasy_projections
DROP INDEX IF EXISTS api.idx_fantasy_projections_player;
DROP INDEX IF EXISTS api.idx_fantasy_projections_player_name_trgm;
DROP INDEX IF EXISTS api.idx_fantasy_projections_points;
DROP INDEX IF EXISTS api.idx_fantasy_projections_season;
DROP INDEX IF EXISTS api.idx_fantasy_projections_sport;

-- api.fantasy_rosters
DROP INDEX IF EXISTS api.idx_fantasy_rosters_player_name;
DROP INDEX IF EXISTS api.idx_fantasy_rosters_team_id;

-- api.fantasy_teams
DROP INDEX IF EXISTS api.idx_fantasy_teams_league_id;
DROP INDEX IF EXISTS api.idx_fantasy_teams_user_id;

-- api.games
DROP INDEX IF EXISTS api.games_sport_commence;
DROP INDEX IF EXISTS api.games_status;
DROP INDEX IF EXISTS api.idx_games_time;

-- api.historical_games
DROP INDEX IF EXISTS api.idx_historical_date;
DROP INDEX IF EXISTS api.idx_historical_sport;

-- api.hitter_splits
DROP INDEX IF EXISTS api.idx_hitter_splits_batter;
DROP INDEX IF EXISTS api.idx_hitter_splits_hr_leaderboard;
DROP INDEX IF EXISTS api.idx_hitter_splits_leaderboard;

-- api.kalshi_markets
DROP INDEX IF EXISTS api.idx_kalshi_cached;
DROP INDEX IF EXISTS api.idx_kalshi_category;

-- api.kalshi_orders
DROP INDEX IF EXISTS api.kalshi_orders_status_idx;
DROP INDEX IF EXISTS api.kalshi_orders_ticker_idx;
DROP INDEX IF EXISTS api.kalshi_orders_user_id_idx;

-- api.kalshi_positions
DROP INDEX IF EXISTS api.kalshi_positions_ticker_idx;
DROP INDEX IF EXISTS api.kalshi_positions_user_id_idx;

-- api.line_movement
DROP INDEX IF EXISTS api.idx_line_movement_sport;
DROP INDEX IF EXISTS api.idx_line_movement_timestamp;
DROP INDEX IF EXISTS api.idx_line_movement_updated;

-- api.live_odds_cache
DROP INDEX IF EXISTS api.idx_live_odds_cache_cached_at;
DROP INDEX IF EXISTS api.idx_live_odds_cache_sport;
DROP INDEX IF EXISTS api.idx_live_odds_commence;

-- api.market_anomalies
DROP INDEX IF EXISTS api.idx_manom_cluster;
DROP INDEX IF EXISTS api.idx_manom_severity_time;

-- api.market_predictions
DROP INDEX IF EXISTS api.idx_market_predictions_event;
DROP INDEX IF EXISTS api.idx_mpred_event;

-- api.market_snapshots
DROP INDEX IF EXISTS api.idx_msnap_sport_time;

-- api.markets
DROP INDEX IF EXISTS api.idx_markets_game;

-- api.mlb_games
DROP INDEX IF EXISTS api.idx_mlb_games_away_team;
DROP INDEX IF EXISTS api.idx_mlb_games_home_team;
DROP INDEX IF EXISTS api.idx_mlb_games_status;

-- api.model_predictions
DROP INDEX IF EXISTS api.model_predictions_ev_threshold;
DROP INDEX IF EXISTS api.model_predictions_game_ev;

-- api.model_versions
DROP INDEX IF EXISTS api.idx_mver_active;

-- api.nfbc_adp
DROP INDEX IF EXISTS api.idx_nfbc_adp_display_name;
DROP INDEX IF EXISTS api.idx_nfbc_adp_player_name_trgm;
DROP INDEX IF EXISTS api.idx_nfbc_adp_uploaded_by;
DROP INDEX IF EXISTS api.idx_nfbc_adp_value_pick;

-- api.odds
DROP INDEX IF EXISTS api.idx_odds_game;
DROP INDEX IF EXISTS api.idx_odds_time;

-- api.odds_history
DROP INDEX IF EXISTS api.idx_api_odds_history_event_id;
DROP INDEX IF EXISTS api.idx_api_odds_history_timestamp;

-- api.odds_snapshots
DROP INDEX IF EXISTS api.odds_snapshots_captured_at;
DROP INDEX IF EXISTS api.odds_snapshots_game_market_time;

-- api.pick_outcomes
DROP INDEX IF EXISTS api.idx_pick_outcomes_date;
DROP INDEX IF EXISTS api.idx_pick_outcomes_pending;
DROP INDEX IF EXISTS api.idx_pick_outcomes_tier;

-- api.picks
DROP INDEX IF EXISTS api.idx_picks_created;
DROP INDEX IF EXISTS api.idx_picks_game;
DROP INDEX IF EXISTS api.idx_picks_player_name_trgm;
DROP INDEX IF EXISTS api.idx_picks_score;
DROP INDEX IF EXISTS api.idx_picks_type_date;

-- api.player_props_markets
DROP INDEX IF EXISTS api.idx_api_player_props_game_id;
DROP INDEX IF EXISTS api.idx_api_player_props_player;
DROP INDEX IF EXISTS api.idx_api_player_props_type;
DROP INDEX IF EXISTS api.idx_player_props_player_name_trgm;

-- api.players
DROP INDEX IF EXISTS api.idx_players_active;
DROP INDEX IF EXISTS api.idx_players_name_gin;
DROP INDEX IF EXISTS api.idx_players_team;

-- api.projections
DROP INDEX IF EXISTS api.idx_projections_game_date;
DROP INDEX IF EXISTS api.idx_projections_hr_rank;
DROP INDEX IF EXISTS api.idx_projections_player_date;
DROP INDEX IF EXISTS api.idx_projections_player_name_trgm;

-- api.sharp_signals
DROP INDEX IF EXISTS api.idx_sharp_signals_game;
DROP INDEX IF EXISTS api.idx_sharp_signals_player;
DROP INDEX IF EXISTS api.idx_sharp_signals_player_name_trgm;
DROP INDEX IF EXISTS api.idx_sharp_signals_recent;
DROP INDEX IF EXISTS api.idx_sharp_signals_type_sport;

-- api.statcast_daily
DROP INDEX IF EXISTS api.idx_statcast_daily_player_season;

-- api.statcast_events
DROP INDEX IF EXISTS api.idx_se_batter_id;
DROP INDEX IF EXISTS api.idx_se_events_outcome;
DROP INDEX IF EXISTS api.idx_se_game_date;
DROP INDEX IF EXISTS api.idx_se_game_pk;
DROP INDEX IF EXISTS api.idx_se_pitcher_id;
DROP INDEX IF EXISTS api.idx_se_pitcher_pitch_type;
DROP INDEX IF EXISTS api.idx_statcast_events_raw_ref_id;

-- api.statcast_pitches_raw
DROP INDEX IF EXISTS api.idx_statcast_batter_date;
DROP INDEX IF EXISTS api.idx_statcast_game_date;
DROP INDEX IF EXISTS api.idx_statcast_pitch_type;
DROP INDEX IF EXISTS api.idx_statcast_pitcher_date;

-- api.statcast_raw_events
DROP INDEX IF EXISTS api.idx_sre_event_dt;
DROP INDEX IF EXISTS api.idx_sre_inserted_at;
DROP INDEX IF EXISTS api.idx_sre_raw_gin;

-- api.teams
DROP INDEX IF EXISTS api.idx_teams_league_div;

-- api.user_alerts
DROP INDEX IF EXISTS api.idx_user_alerts_type;
DROP INDEX IF EXISTS api.idx_user_alerts_user_active;

-- api.user_profiles
DROP INDEX IF EXISTS api.idx_user_profiles_tier;

-- api.waiver_transactions
DROP INDEX IF EXISTS api.idx_waiver_transactions_league_id;
DROP INDEX IF EXISTS api.idx_waiver_transactions_status;
DROP INDEX IF EXISTS api.idx_waiver_transactions_team_id;
DROP INDEX IF EXISTS api.idx_waiver_transactions_week;

-- ---------------------------------------------------------------------------
-- public schema
-- ---------------------------------------------------------------------------

-- public.ai_audit_log
DROP INDEX IF EXISTS public.idx_audit_created_at;
DROP INDEX IF EXISTS public.idx_audit_event_type;
DROP INDEX IF EXISTS public.idx_audit_flagged;
DROP INDEX IF EXISTS public.idx_audit_model_name;
DROP INDEX IF EXISTS public.idx_audit_user_id;

-- public.ai_response_trust
DROP INDEX IF EXISTS public.idx_trust_created_at;
DROP INDEX IF EXISTS public.idx_trust_level;
DROP INDEX IF EXISTS public.idx_trust_message_id;
DROP INDEX IF EXISTS public.idx_trust_prompt_hash;

-- public.app_config
DROP INDEX IF EXISTS public.idx_config_category;
DROP INDEX IF EXISTS public.idx_config_is_public;

-- public.arbitrage_opportunities
DROP INDEX IF EXISTS public.idx_arb_live_odds_id;
DROP INDEX IF EXISTS public.idx_arb_profit;
DROP INDEX IF EXISTS public.idx_arb_sport;
DROP INDEX IF EXISTS public.idx_arb_valid;

-- public.college_baseball_odds
DROP INDEX IF EXISTS public.idx_college_baseball_odds_commence_time;
DROP INDEX IF EXISTS public.idx_college_baseball_odds_event_id;
DROP INDEX IF EXISTS public.idx_college_baseball_odds_expires_at;
DROP INDEX IF EXISTS public.idx_college_baseball_odds_fetched_at;

-- public.conversations  [ORPHANED subsystem — legacy chat, replaced by api.chat_threads]
DROP INDEX IF EXISTS public.idx_conversations_category;
DROP INDEX IF EXISTS public.idx_conversations_created_at;
DROP INDEX IF EXISTS public.idx_conversations_last_message;
DROP INDEX IF EXISTS public.idx_conversations_starred;
DROP INDEX IF EXISTS public.idx_conversations_updated_at;

-- public.dfs_lineups
DROP INDEX IF EXISTS public.idx_dfs_lineups_created_at;
DROP INDEX IF EXISTS public.idx_dfs_lineups_platform;
DROP INDEX IF EXISTS public.idx_dfs_lineups_slate_date;
DROP INDEX IF EXISTS public.idx_dfs_lineups_sport;
DROP INDEX IF EXISTS public.idx_dfs_lineups_user_id;

-- public.line_movement
DROP INDEX IF EXISTS public.idx_line_movement_event;
DROP INDEX IF EXISTS public.idx_line_movement_time;

-- public.live_odds_cache
DROP INDEX IF EXISTS public.idx_odds_cache_expires_at;
DROP INDEX IF EXISTS public.idx_odds_cache_fetched_at;
DROP INDEX IF EXISTS public.idx_odds_cache_market_type;
DROP INDEX IF EXISTS public.idx_odds_cache_sport_event;

-- public.message_attachments  [ORPHANED subsystem — legacy chat]
DROP INDEX IF EXISTS public.idx_attachments_message_id;
DROP INDEX IF EXISTS public.idx_attachments_type;

-- public.messages  [ORPHANED subsystem — legacy chat]
DROP INDEX IF EXISTS public.idx_messages_conversation_id;
DROP INDEX IF EXISTS public.idx_messages_created_at;
DROP INDEX IF EXISTS public.idx_messages_feedback;
DROP INDEX IF EXISTS public.idx_messages_role;
DROP INDEX IF EXISTS public.idx_messages_user_id;

-- public.mlb_odds
DROP INDEX IF EXISTS public.idx_mlb_odds_commence_time;
DROP INDEX IF EXISTS public.idx_mlb_odds_event_id;
DROP INDEX IF EXISTS public.idx_mlb_odds_expires_at;
DROP INDEX IF EXISTS public.idx_mlb_odds_fetched_at;
DROP INDEX IF EXISTS public.idx_mlb_odds_game_id;

-- public.nba_odds
DROP INDEX IF EXISTS public.idx_nba_odds_commence_time;
DROP INDEX IF EXISTS public.idx_nba_odds_event_id;
DROP INDEX IF EXISTS public.idx_nba_odds_expires_at;
DROP INDEX IF EXISTS public.idx_nba_odds_fetched_at;
DROP INDEX IF EXISTS public.idx_nba_odds_game_id;
DROP INDEX IF EXISTS public.idx_nba_odds_sportsbook;

-- public.ncaab_odds
DROP INDEX IF EXISTS public.idx_ncaab_odds_commence_time;
DROP INDEX IF EXISTS public.idx_ncaab_odds_event_id;
DROP INDEX IF EXISTS public.idx_ncaab_odds_expires_at;
DROP INDEX IF EXISTS public.idx_ncaab_odds_fetched_at;
DROP INDEX IF EXISTS public.idx_ncaab_odds_game_id;

-- public.ncaaf_odds
DROP INDEX IF EXISTS public.idx_ncaaf_odds_commence_time;
DROP INDEX IF EXISTS public.idx_ncaaf_odds_event_id;
DROP INDEX IF EXISTS public.idx_ncaaf_odds_expires_at;
DROP INDEX IF EXISTS public.idx_ncaaf_odds_fetched_at;
DROP INDEX IF EXISTS public.idx_ncaaf_odds_game_id;

-- public.nfl_odds
DROP INDEX IF EXISTS public.idx_nfl_odds_commence_time;
DROP INDEX IF EXISTS public.idx_nfl_odds_event_id;
DROP INDEX IF EXISTS public.idx_nfl_odds_expires_at;
DROP INDEX IF EXISTS public.idx_nfl_odds_fetched_at;
DROP INDEX IF EXISTS public.idx_nfl_odds_game_id;

-- public.nhl_odds
DROP INDEX IF EXISTS public.idx_nhl_odds_commence_time;
DROP INDEX IF EXISTS public.idx_nhl_odds_event_id;
DROP INDEX IF EXISTS public.idx_nhl_odds_expires_at;
DROP INDEX IF EXISTS public.idx_nhl_odds_fetched_at;
DROP INDEX IF EXISTS public.idx_nhl_odds_game_id;

-- public.odds
DROP INDEX IF EXISTS public.idx_odds_game_id;

-- public.odds_benford_baselines
DROP INDEX IF EXISTS public.idx_benford_last_updated;

-- public.odds_history
DROP INDEX IF EXISTS public.idx_odds_history_market_sportsbook;
DROP INDEX IF EXISTS public.idx_odds_history_recorded_at;
DROP INDEX IF EXISTS public.idx_odds_history_sport_event;

-- public.player_projections
DROP INDEX IF EXISTS public.idx_player_projections_created_at;
DROP INDEX IF EXISTS public.idx_player_projections_event_date;
DROP INDEX IF EXISTS public.idx_player_projections_player_name;
DROP INDEX IF EXISTS public.idx_player_projections_sport;

-- public.predictions  [ORPHANED subsystem — old prediction tracking, superseded by api schema]
DROP INDEX IF EXISTS public.idx_predictions_conversation_id;
DROP INDEX IF EXISTS public.idx_predictions_event_date;
DROP INDEX IF EXISTS public.idx_predictions_is_correct;
DROP INDEX IF EXISTS public.idx_predictions_market_type;
DROP INDEX IF EXISTS public.idx_predictions_message_id;
DROP INDEX IF EXISTS public.idx_predictions_sport;
DROP INDEX IF EXISTS public.idx_predictions_sport_market;
DROP INDEX IF EXISTS public.idx_predictions_user_id;

-- public.tenants  [ORPHANED — multi-tenancy never activated]
DROP INDEX IF EXISTS public.idx_tenants_owner_id;

-- public.user_alerts
DROP INDEX IF EXISTS public.idx_user_alerts_active;
DROP INDEX IF EXISTS public.idx_user_alerts_user_id;

-- public.user_bets  [ORPHANED subsystem — old bet tracking, superseded by api schema]
DROP INDEX IF EXISTS public.idx_user_bets_created_at;
DROP INDEX IF EXISTS public.idx_user_bets_event_date;
DROP INDEX IF EXISTS public.idx_user_bets_prediction_id;
DROP INDEX IF EXISTS public.idx_user_bets_sport;
DROP INDEX IF EXISTS public.idx_user_bets_status;
DROP INDEX IF EXISTS public.idx_user_bets_user_id;

-- public.user_predictions  [ORPHANED subsystem — old prediction tracking]
DROP INDEX IF EXISTS public.idx_predictions_event;
DROP INDEX IF EXISTS public.idx_predictions_user;
DROP INDEX IF EXISTS public.idx_userpred_live_odds_id;

-- public.user_profiles
DROP INDEX IF EXISTS public.idx_user_profiles_email;
DROP INDEX IF EXISTS public.idx_user_profiles_last_active;
DROP INDEX IF EXISTS public.idx_user_profiles_tier;
