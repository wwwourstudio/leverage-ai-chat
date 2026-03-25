/**
 * ingestOdds.ts
 *
 * Ingests live odds for a sport into the normalized Supabase schema:
 *   api.games, api.sportsbooks, api.odds, api.odds_history, api.line_movements
 *
 * Called by the cron job (/api/cron/odds) or on-demand ingestion.
 * Uses upsert semantics so it is safe to run repeatedly.
 */

import { fetchOdds, type NormalizedOdd } from './fetchOdds';
import { createClient } from '@/lib/supabase/server';
import { LOG_PREFIXES } from '@/lib/constants';

export interface IngestResult {
  sport: string;
  fetched: number;
  inserted: number;
  moved: number;
  durationMs: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** Deduplicate an array of objects by a composite string key. */
function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── main export ───────────────────────────────────────────────────────────────

/**
 * Fetch current odds for `sport` and persist them to the normalized schema.
 *
 * Steps:
 *  1. Fetch NormalizedOdd[] via fetchOdds()
 *  2. Upsert unique games → api.games
 *  3. Upsert unique sportsbooks → api.sportsbooks
 *  4. Look up the generated UUIDs for each game + sportsbook
 *  5. Read existing api.odds rows for the same keys
 *  6. Detect line movements (|old_line - new_line| ≥ 1) → api.line_movements
 *  7. Upsert all rows into api.odds (conflict: game_id+sportsbook_id+market+selection)
 *  8. Insert snapshots into api.odds_history
 */
export async function ingestOdds(sport: string): Promise<IngestResult> {
  const start = Date.now();

  const normalized = await fetchOdds(sport);
  if (normalized.length === 0) {
    return { sport, fetched: 0, inserted: 0, moved: 0, durationMs: Date.now() - start };
  }

  const supabase = await createClient();

  // ── Step 2: upsert games ────────────────────────────────────────────────────
  const uniqueGames = dedupeBy(normalized, n =>
    `${n.sport}|${n.home_team}|${n.away_team}|${n.start_time.slice(0, 10)}`
  ).map(n => ({
    sport: n.sport,
    home_team: n.home_team,
    away_team: n.away_team,
    start_time: n.start_time,
  }));

  const { error: gamesErr } = await supabase
    .schema('api')
    .from('games')
    .upsert(uniqueGames, { onConflict: 'sport,home_team,away_team,start_time', ignoreDuplicates: true });

  if (gamesErr) {
    console.error(`${LOG_PREFIXES.API} [ingestOdds] games upsert error:`, gamesErr.message);
  }

  // ── Step 3: upsert sportsbooks ─────────────────────────────────────────────
  const uniqueBooks = dedupeBy(normalized, n => n.sportsbook).map(n => ({
    key: n.sportsbook,
    name: n.sportsbook, // display name = key until enriched
  }));

  const { error: booksErr } = await supabase
    .schema('api')
    .from('sportsbooks')
    .upsert(uniqueBooks, { onConflict: 'key', ignoreDuplicates: true });

  if (booksErr) {
    console.error(`${LOG_PREFIXES.API} [ingestOdds] sportsbooks upsert error:`, booksErr.message);
  }

  // ── Step 4: fetch UUID maps ────────────────────────────────────────────────
  const { data: gamesRows } = await supabase
    .schema('api')
    .from('games')
    .select('id, sport, home_team, away_team, start_time')
    .eq('sport', sport);

  const { data: booksRows } = await supabase
    .schema('api')
    .from('sportsbooks')
    .select('id, key');

  const gameMap = new Map<string, string>();
  for (const g of gamesRows ?? []) {
    const k = `${g.sport}|${g.home_team}|${g.away_team}|${(g.start_time as string).slice(0, 10)}`;
    gameMap.set(k, g.id as string);
  }

  const bookMap = new Map<string, string>();
  for (const b of booksRows ?? []) {
    bookMap.set(b.key as string, b.id as string);
  }

  // ── Step 5: read existing odds for delta comparison ─────────────────────────
  const gameIds = [...new Set([...gameMap.values()])];
  const { data: existingOdds } = gameIds.length
    ? await supabase
        .schema('api')
        .from('odds')
        .select('game_id, sportsbook_id, market, selection, line')
        .in('game_id', gameIds)
    : { data: [] };

  // key → existing line
  const existingMap = new Map<string, number | null>();
  for (const row of existingOdds ?? []) {
    const k = `${row.game_id}|${row.sportsbook_id}|${row.market}|${row.selection}`;
    existingMap.set(k, row.line as number | null);
  }

  // ── Step 6 + 7 + 8: build rows ─────────────────────────────────────────────
  const oddsRows: object[] = [];
  const historyRows: object[] = [];
  const movementRows: object[] = [];

  for (const n of normalized) {
    const gameKey = `${n.sport}|${n.home_team}|${n.away_team}|${n.start_time.slice(0, 10)}`;
    const gameId = gameMap.get(gameKey);
    const sbId   = bookMap.get(n.sportsbook);

    if (!gameId || !sbId) continue; // shouldn't happen after upserts above

    const existingKey = `${gameId}|${sbId}|${n.market}|${n.selection}`;
    const oldLine = existingMap.get(existingKey);

    // Detect line movement ≥ 1 point
    if (
      oldLine !== undefined &&
      oldLine !== null &&
      n.line !== null &&
      Math.abs(oldLine - n.line) >= 1
    ) {
      movementRows.push({
        game_id:      gameId,
        market:       n.market,
        selection:    n.selection,
        opening_line: oldLine,
        current_line: n.line,
      });
    }

    const row = {
      game_id:       gameId,
      sportsbook_id: sbId,
      market:        n.market,
      selection:     n.selection,
      line:          n.line,
      price:         n.price,
      updated_at:    new Date().toISOString(),
    };

    oddsRows.push(row);
    historyRows.push({ ...row, updated_at: undefined, timestamp: new Date().toISOString() });
  }

  // Upsert current odds
  const { count: insertedCount, error: oddsErr } = await supabase
    .schema('api')
    .from('odds')
    .upsert(oddsRows as any[], {
      onConflict: 'game_id,sportsbook_id,market,selection',
      count: 'exact',
    });

  if (oddsErr) {
    console.error(`${LOG_PREFIXES.API} [ingestOdds] odds upsert error:`, oddsErr.message);
  }

  // Insert history snapshots
  if (historyRows.length > 0) {
    const { error: histErr } = await supabase
      .schema('api')
      .from('odds_history')
      .insert(historyRows as any[]);

    if (histErr) {
      console.error(`${LOG_PREFIXES.API} [ingestOdds] history insert error:`, histErr.message);
    }
  }

  // Insert line movements
  let moved = 0;
  if (movementRows.length > 0) {
    const { count: movedCount, error: moveErr } = await supabase
      .schema('api')
      .from('line_movements')
      .insert(movementRows as any[], { count: 'exact' });

    if (moveErr) {
      console.error(`${LOG_PREFIXES.API} [ingestOdds] line_movements insert error:`, moveErr.message);
    } else {
      moved = movedCount ?? 0;
    }
  }

  const result: IngestResult = {
    sport,
    fetched:     normalized.length,
    inserted:    insertedCount ?? oddsRows.length,
    moved,
    durationMs:  Date.now() - start,
  };

  console.log(
    `${LOG_PREFIXES.API} [ingestOdds] ${sport}: ` +
    `${result.fetched} fetched, ${result.inserted} upserted, ${result.moved} moves — ${result.durationMs}ms`
  );

  return result;
}
