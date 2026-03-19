-- ============================================================================
-- api.process_odds_batch(p_payload jsonb)
--
-- Atomic single-call replacement for the N-loop upserts in the edge function.
-- Runs everything in one Postgres transaction:
--   1. Compares incoming odds against cached live_odds_cache rows
--   2. Inserts significant changes into line_movement
--   3. Upserts all games into live_odds_cache
--
-- Called by the ingest-odds edge function via:
--   supabase.rpc('process_odds_batch', { payload: events })
--
-- Performance: one round-trip regardless of how many games arrive.
-- Atomicity: either all games update + all movements record, or nothing.
--
-- Thresholds (mirror supabase/functions/ingest-odds/index.ts constants):
--   MIN_ODDS_CHANGE   3   (American odds cents)
--   MIN_LINE_CHANGE   0.5 (spread / total points)
-- ============================================================================

CREATE OR REPLACE FUNCTION api.process_odds_batch(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_game        jsonb;
  v_book        jsonb;
  v_market      jsonb;
  v_outcome     jsonb;
  v_old_book    jsonb;
  v_old_market  jsonb;
  v_old_outcome jsonb;
  v_old_price   numeric;
  v_new_price   numeric;
  v_old_point   numeric;
  v_new_point   numeric;
  v_old_bkmkrs  jsonb;
  v_upserted    int := 0;
  v_movements   int := 0;
  v_now         timestamptz := now();
  v_expires     timestamptz := now() + interval '5 minutes';
BEGIN
  FOR v_game IN SELECT value FROM jsonb_array_elements(p_payload) LOOP

    -- ── Load existing cached bookmakers for movement comparison ──────────────
    SELECT bookmakers INTO v_old_bkmkrs
    FROM api.live_odds_cache
    WHERE game_id = v_game->>'id';

    -- ── Detect line movements when we have a prior snapshot ──────────────────
    IF v_old_bkmkrs IS NOT NULL THEN
      FOR v_book IN SELECT value FROM jsonb_array_elements(v_game->'bookmakers') LOOP

        -- Find this bookmaker in the prior snapshot
        SELECT elem INTO v_old_book
        FROM jsonb_array_elements(v_old_bkmkrs) AS elem
        WHERE elem->>'key' = v_book->>'key'
        LIMIT 1;

        IF NOT FOUND THEN CONTINUE; END IF;

        FOR v_market IN SELECT value FROM jsonb_array_elements(v_book->'markets') LOOP

          SELECT elem INTO v_old_market
          FROM jsonb_array_elements(v_old_book->'markets') AS elem
          WHERE elem->>'key' = v_market->>'key'
          LIMIT 1;

          IF NOT FOUND THEN CONTINUE; END IF;

          FOR v_outcome IN SELECT value FROM jsonb_array_elements(v_market->'outcomes') LOOP

            SELECT elem INTO v_old_outcome
            FROM jsonb_array_elements(v_old_market->'outcomes') AS elem
            WHERE elem->>'name' = v_outcome->>'name'
            LIMIT 1;

            IF NOT FOUND THEN CONTINUE; END IF;

            v_new_price := (v_outcome->>'price')::numeric;
            v_old_price := (v_old_outcome->>'price')::numeric;
            v_new_point := NULLIF(v_outcome->>'point', 'null')::numeric;
            v_old_point := NULLIF(v_old_outcome->>'point', 'null')::numeric;

            -- Only record significant moves (filter noise)
            IF abs(v_new_price - v_old_price) >= 3
               OR abs(coalesce(v_new_point, 0) - coalesce(v_old_point, 0)) >= 0.5
            THEN
              INSERT INTO api.line_movement (
                game_id, sport, home_team, away_team,
                bookmaker, market_type,
                old_line, new_line, line_change,
                old_odds, new_odds,
                timestamp, created_at, updated_at
              ) VALUES (
                v_game->>'id',
                v_game->>'sport_key',
                v_game->>'home_team',
                v_game->>'away_team',
                v_book->>'key',
                (v_market->>'key') || '_' || lower(replace(v_outcome->>'name', ' ', '_')),
                v_old_point,
                v_new_point,
                CASE WHEN v_new_point IS NOT NULL AND v_old_point IS NOT NULL
                     THEN round(v_new_point - v_old_point, 2)
                     ELSE NULL END,
                v_old_price::integer,
                v_new_price::integer,
                v_now, v_now, v_now
              );
              v_movements := v_movements + 1;
            END IF;

          END LOOP; -- outcomes
        END LOOP; -- markets
      END LOOP; -- bookmakers
    END IF; -- had prior snapshot

    -- ── Upsert game into live_odds_cache ─────────────────────────────────────
    INSERT INTO api.live_odds_cache (
      game_id, sport, sport_key, home_team, away_team, commence_time,
      bookmakers, markets, cached_at, expires_at
    ) VALUES (
      v_game->>'id',
      coalesce(v_game->>'sport_title', split_part(v_game->>'sport_key', '_', 2)),
      v_game->>'sport_key',
      v_game->>'home_team',
      v_game->>'away_team',
      (v_game->>'commence_time')::timestamptz,
      v_game->'bookmakers',
      '{}'::jsonb,
      v_now,
      v_expires
    )
    ON CONFLICT (game_id) DO UPDATE SET
      bookmakers    = EXCLUDED.bookmakers,
      sport_key     = EXCLUDED.sport_key,
      cached_at     = EXCLUDED.cached_at,
      expires_at    = EXCLUDED.expires_at,
      commence_time = EXCLUDED.commence_time;

    v_upserted := v_upserted + 1;

  END LOOP; -- games

  RETURN jsonb_build_object(
    'upserted',  v_upserted,
    'movements', v_movements,
    'processed_at', v_now
  );
END;
$$;

-- Grant to service_role (the edge function runs as service_role)
GRANT EXECUTE ON FUNCTION api.process_odds_batch(jsonb) TO service_role;

-- ============================================================================
-- Verify: SELECT api.process_odds_batch('[]'::jsonb);
-- Expected: {"upserted": 0, "movements": 0, "processed_at": "..."}
-- ============================================================================
