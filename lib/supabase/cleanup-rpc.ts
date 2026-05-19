import { createClient } from './client';

/**
 * Cleanup RPC stubs for managing old data retention.
 * These functions are defined in the Supabase schema and exposed via RPC.
 */

export async function cleanupOddsSnapshots(retentionHours: number = 48): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('cleanup_odds_snapshots', {
    retention_hours: retentionHours,
  });

  if (error) {
    console.error('[v0] cleanup_odds_snapshots RPC error:', error.message);
    throw error;
  }

  return data as number;
}

export async function cleanupClosingLines(retentionDays: number = 90): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('cleanup_closing_lines', {
    retention_days: retentionDays,
  });

  if (error) {
    console.error('[v0] cleanup_closing_lines RPC error:', error.message);
    throw error;
  }

  return data as number;
}
