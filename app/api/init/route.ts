/**
 * GET /api/init
 *
 * Batches the four page-load API calls into a single serverless invocation,
 * eliminating 3 cold-start round-trips on every visit.
 *
 * Returns:
 *   { instructions, credits, insights, chats }
 *
 * Each field is null if the underlying fetch fails, so a single downstream
 * failure never blocks the entire page load.
 */

import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/config';

export const runtime  = 'nodejs';
export const maxDuration = 10;

const DEFAULT_INSIGHTS = {
  totalValue: 0,
  winRate: 0,
  roi: 0,
  activeContests: 0,
  totalInvested: 0,
  dataSource: 'default',
  message: 'No historical data yet. Start analyzing to build your track record.',
};

async function fetchInstructions(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server')['createClient']>>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return '';

    const { data } = await supabase
      .from('user_preferences')
      .select('custom_instructions')
      .eq('user_id', user.id)
      .maybeSingle();

    return data?.custom_instructions ?? '';
  } catch {
    return '';
  }
}

async function fetchCredits(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server')['createClient']>>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { credits: 0, source: 'guest' as const };

    const { data } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (!data) {
      const DEFAULT_CREDITS = 10;
      await supabase
        .from('user_credits')
        .upsert({ user_id: user.id, balance: DEFAULT_CREDITS, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      return { credits: DEFAULT_CREDITS, source: 'initialized' as const };
    }

    return { credits: data.balance, source: 'database' as const };
  } catch {
    return { credits: 0, source: 'guest' as const };
  }
}

async function fetchInsights(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server')['createClient']>>) {
  if (!isSupabaseConfigured()) return DEFAULT_INSIGHTS;

  try {
    const timeout = <T>(ms: number): Promise<T> =>
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

    const { data: { user } } = await Promise.race([
      supabase.auth.getUser(),
      timeout<{ data: { user: null } }>(4_000),
    ]);

    if (!user) return DEFAULT_INSIGHTS;

    const { data } = await Promise.race([
      supabase.from('user_insights').select('*').eq('user_id', user.id).single(),
      timeout<{ data: null; error: null }>(4_000),
    ]);

    if (!data) return DEFAULT_INSIGHTS;
    return {
      totalValue: data.total_value ?? 0,
      winRate: data.win_rate ?? 0,
      roi: data.roi ?? 0,
      activeContests: data.active_contests ?? 0,
      totalInvested: data.total_invested ?? 0,
      dataSource: 'database',
      message: 'Historical insights loaded.',
    };
  } catch {
    return DEFAULT_INSIGHTS;
  }
}

async function fetchChats(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server')['createClient']>>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    return data ?? [];
  } catch {
    return [];
  }
}

export async function GET() {
  // 10s overall timeout — the route's maxDuration enforces this at the
  // infrastructure level, but we also resolve early if all parallel
  // fetches complete before the deadline.
  const deadline = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('init timeout')), 9_500),
  );

  try {
    const { createClient } = await import('@/lib/supabase/server');
    // Single shared Supabase client to reuse the same auth session across all 4 fetches.
    const supabase = await createClient();

    const [instructions, creditsData, insights, chats] = await Promise.race([
      Promise.all([
        fetchInstructions(supabase).catch(() => ''),
        fetchCredits(supabase).catch(() => ({ credits: 0, source: 'guest' as const })),
        fetchInsights(supabase).catch(() => DEFAULT_INSIGHTS),
        fetchChats(supabase).catch(() => [] as unknown[]),
      ]),
      deadline,
    ]);

    return NextResponse.json({
      success: true,
      instructions,
      credits: creditsData,
      insights,
      chats,
    });
  } catch (err) {
    console.error('[API/init] Error:', err);
    // Return safe defaults so the page still renders
    return NextResponse.json({
      success: false,
      instructions: '',
      credits: { credits: 0, source: 'guest' },
      insights: DEFAULT_INSIGHTS,
      chats: [],
    });
  }
}
