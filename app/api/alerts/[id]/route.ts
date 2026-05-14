import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  AuthRequiredError,
  unauthorized,
  badRequest,
  notFound,
  parseJsonBody,
  JsonParseError,
  internalError,
} from '@/lib/api/route-helpers';

/**
 * PATCH /api/alerts/[id]
 * Update an alert. Supports: is_active, title, description, threshold, max_triggers, trigger_count (reset).
 * Only the owning user may update their alert.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, user } = await requireAuth();
    const { id } = await params;
    if (!id) return badRequest('Missing alert id');

    const body = await parseJsonBody(req);

    const allowedFields = ['is_active', 'title', 'description', 'threshold', 'max_triggers', 'trigger_count', 'notify_channels'];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (field in body) updates[field] = (body as Record<string, unknown>)[field];
    }

    const { data, error } = await supabase
      .from('user_alerts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[Alerts] PATCH failed:', error);
      return internalError(error.message);
    }
    if (!data) return notFound('Alert not found');

    return NextResponse.json({ success: true, data });
  } catch (err) {
    if (err instanceof AuthRequiredError) return unauthorized();
    if (err instanceof JsonParseError) return badRequest(err.message);
    console.error('[Alerts] PATCH error:', err);
    return internalError();
  }
}

/**
 * DELETE /api/alerts/[id]
 * Delete an alert. Only the owning user may delete.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, user } = await requireAuth();
    const { id } = await params;
    if (!id) return badRequest('Missing alert id');

    const { error } = await supabase
      .from('user_alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Alerts] DELETE failed:', error);
      return internalError(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthRequiredError) return unauthorized();
    if (err instanceof JsonParseError) return badRequest(err.message);
    console.error('[Alerts] DELETE error:', err);
    return internalError();
  }
}
