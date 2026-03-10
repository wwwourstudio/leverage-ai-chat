import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/alerts/[id]
 * Update an alert. Supports: is_active, title, description, threshold, max_triggers, trigger_count (reset).
 * Only the owning user may update their alert.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing alert id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Only allow safe fields to be updated
  const allowedFields = ['is_active', 'title', 'description', 'threshold', 'max_triggers', 'trigger_count'];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  const { data, error } = await supabase
    .from('user_alerts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id) // enforce ownership
    .select()
    .single();

  if (error) {
    console.error('[Alerts] PATCH failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

/**
 * DELETE /api/alerts/[id]
 * Delete an alert. Only the owning user may delete.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing alert id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_alerts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id); // enforce ownership

  if (error) {
    console.error('[Alerts] DELETE failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
