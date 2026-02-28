import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/user/files
 * Returns the authenticated user's saved files from Supabase user_preferences.
 * Files are stored as a JSON array in the `saved_files` column.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: true, files: [] });

    const { data } = await supabase
      .from('user_preferences')
      .select('saved_files')
      .eq('user_id', user.id)
      .single();

    const files = data?.saved_files ?? [];
    return NextResponse.json({ success: true, files });
  } catch (err) {
    console.error('[API/user/files GET]', err);
    return NextResponse.json({ success: false, files: [], error: 'Failed to load files' });
  }
}

/**
 * POST /api/user/files
 * Body: { files: SavedFile[] }
 * Saves (overwrites) the user's file list in Supabase.
 * Max 20 files, limited to metadata only (no raw binary stored).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const files = Array.isArray(body.files) ? body.files.slice(0, 20) : [];

    // Strip large binary fields before storing (imageBase64 can be MBs)
    const sanitized = files.map((f: any) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      size: f.size,
      savedAt: f.savedAt,
      // Preserve text data (CSV headers/rows, txt/json content) but cap at 50KB
      data: f.data ?? null,
      textContent: typeof f.textContent === 'string' ? f.textContent.slice(0, 50_000) : null,
    }));

    await supabase
      .from('user_preferences')
      .upsert(
        { user_id: user.id, saved_files: sanitized, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    return NextResponse.json({ success: true, count: sanitized.length });
  } catch (err) {
    console.error('[API/user/files POST]', err);
    return NextResponse.json({ success: false, error: 'Failed to save files' }, { status: 500 });
  }
}
