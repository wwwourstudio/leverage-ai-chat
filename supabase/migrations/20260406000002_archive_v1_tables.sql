-- =============================================================================
-- Migration: Archive orphaned public-schema v1 tables
-- Generated: 2026-04-06
-- Project:   Leverage2 (xvhdomnjhlbxzocayocg)
-- =============================================================================
--
-- BACKGROUND
-- These tables are remnants of the v1 schema, fully superseded by:
--   public.conversations      → api.chat_threads
--   public.messages           → api.chat_messages
--   public.predictions        → api.ai_predictions
--   public.user_bets          → api.bet_allocations
--   public.player_projections → api.fantasy_players
--   public.dfs_lineups        → api.fantasy_leagues / api.fantasy_players
--   public.message_attachments → api.chat_messages (attachments column)
--
-- VERIFICATION (confirmed before applying)
-- • Zero app-code references: grep of all *.ts/*.tsx files for
--   .from('conversations'), .from('messages'), .from('predictions'),
--   .from('user_bets'), .from('player_projections'), .from('dfs_lineups'),
--   .from('message_attachments') returned 0 matches.
-- • These tables still accumulate write overhead from indexes on every cron
--   insert cycle. Archiving frees that overhead immediately.
--
-- SAFETY
-- Tables are RENAMED, not dropped. A "_v1_archived" suffix makes them
-- invisible to the ORM (PostgREST exposes only unaffixed names) while
-- preserving data for forensic inspection. Drop them manually after 30 days
-- if no "relation does not exist" errors appear in Vercel logs.
--
-- ROLLBACK (if needed within same session)
--   ALTER TABLE public.conversations_v1_archived     RENAME TO conversations;
--   ALTER TABLE public.messages_v1_archived          RENAME TO messages;
--   ALTER TABLE public.predictions_v1_archived       RENAME TO predictions;
--   ALTER TABLE public.user_bets_v1_archived         RENAME TO user_bets;
--   ALTER TABLE public.player_projections_v1_archived RENAME TO player_projections;
--   ALTER TABLE public.dfs_lineups_v1_archived       RENAME TO dfs_lineups;
--   ALTER TABLE public.message_attachments_v1_archived RENAME TO message_attachments;
-- =============================================================================

ALTER TABLE IF EXISTS public.conversations       RENAME TO conversations_v1_archived;
ALTER TABLE IF EXISTS public.messages            RENAME TO messages_v1_archived;
ALTER TABLE IF EXISTS public.predictions         RENAME TO predictions_v1_archived;
ALTER TABLE IF EXISTS public.user_bets           RENAME TO user_bets_v1_archived;
ALTER TABLE IF EXISTS public.player_projections  RENAME TO player_projections_v1_archived;
ALTER TABLE IF EXISTS public.dfs_lineups         RENAME TO dfs_lineups_v1_archived;
ALTER TABLE IF EXISTS public.message_attachments RENAME TO message_attachments_v1_archived;
