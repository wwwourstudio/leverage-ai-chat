import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id') || 'anonymous';

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          profile: null,
          message: 'No profile found'
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      profile: data
    });
  } catch (error: any) {
    console.error('[v0] Profile fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id') || 'anonymous';
  const body = await req.json();

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        preferences: body.preferences || {},
        total_invested: body.total_invested || 0,
        total_profit: body.total_profit || 0,
        win_count: body.win_count || 0,
        loss_count: body.loss_count || 0,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      profile: data
    });
  } catch (error: any) {
    console.error('[v0] Profile update error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
