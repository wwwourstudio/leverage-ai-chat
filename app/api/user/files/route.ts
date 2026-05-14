import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  AuthRequiredError,
  unauthorized,
  internalError,
} from '@/lib/api/route-helpers';

/**
 * GET /api/user/files
 * Returns the authenticated user's saved files from Supabase user_preferences.
 * Files are stored as a JSON array in the `saved_files` column.
 */
export async function GET() {
  try {
    const { supabase, user } = await requireAuth();

    const { data } = await supabase
      .from('user_preferences')
      .select('saved_files')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({ success: true, files: data?.saved_files ?? [] });
  } catch (err) {
    if (err instanceof AuthRequiredError) return NextResponse.json({ success: true, files: [] });
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
    const { supabase, user } = await requireAuth();

    const body = await req.json();
    const files = Array.isArray(body.files) ? body.files.slice(0, 20) : [];

    // Strip large binary fields before storing (imageBase64 can be MBs)
    const sanitized = files.map((f: any) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      size: f.size,
      savedAt: f.savedAt,
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
    if (err instanceof AuthRequiredError) return unauthorized();
    console.error('[API/user/files POST]', err);
    return internalError('Failed to save files');
  }
}
