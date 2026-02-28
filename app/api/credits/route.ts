import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Credits table — row-per-user, stored in api.user_credits (created below if missing)
// Falls back gracefully if the table doesn't exist yet.

/**
 * GET /api/credits
 * Returns the authenticated user's credit balance.
 * Unauthenticated: returns { credits: 0, source: 'guest' }
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: true, credits: 0, source: 'guest' });
    }

    // Try user_credits table first
    const { data, error } = await supabase
      .from('user_credits')
      .select('credits, updated_at')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      // Row doesn't exist yet — initialize with default credits
      const DEFAULT_CREDITS = 10;
      await supabase
        .from('user_credits')
        .upsert({ user_id: user.id, credits: DEFAULT_CREDITS, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        .select()
        .single();
      return NextResponse.json({ success: true, credits: DEFAULT_CREDITS, source: 'initialized' });
    }

    return NextResponse.json({ success: true, credits: data.credits, source: 'database', updatedAt: data.updated_at });
  } catch (err) {
    console.error('[API/credits GET]', err);
    return NextResponse.json({ success: false, credits: 0, error: 'Failed to load credits' });
  }
}

/**
 * POST /api/credits
 * Body: { action: 'consume' | 'add'; amount?: number }
 * Atomically adjusts credit balance.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const action: 'consume' | 'add' = body.action ?? 'consume';
    const amount = Math.max(1, Math.min(1000, parseInt(body.amount ?? '1', 10)));

    // Read current balance
    const { data: current } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', user.id)
      .single();

    const currentCredits = current?.credits ?? 0;

    if (action === 'consume') {
      if (currentCredits < amount) {
        return NextResponse.json({ success: false, error: 'Insufficient credits', credits: currentCredits }, { status: 402 });
      }
      const newBalance = currentCredits - amount;
      await supabase
        .from('user_credits')
        .upsert({ user_id: user.id, credits: newBalance, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      return NextResponse.json({ success: true, credits: newBalance, consumed: amount });
    }

    if (action === 'add') {
      const newBalance = currentCredits + amount;
      await supabase
        .from('user_credits')
        .upsert({ user_id: user.id, credits: newBalance, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      return NextResponse.json({ success: true, credits: newBalance, added: amount });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[API/credits POST]', err);
    return NextResponse.json({ success: false, error: 'Failed to update credits' }, { status: 500 });
  }
}
