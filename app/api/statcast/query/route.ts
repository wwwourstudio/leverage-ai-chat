import { NextRequest, NextResponse } from 'next/server';
import { getRawStatcast, type StatcastFilters } from '@/lib/statcastQuery';

/**
 * POST /api/statcast/query
 *
 * Accepts a StatcastFilters body and returns raw Statcast pitch rows from
 * the api.statcast_pitches_raw table.
 *
 * Body (all optional):
 *   { batter?: number, pitcher?: number, start?: string, end?: string,
 *     pitch_type?: string, limit?: number }
 *
 * Response:
 *   200: { data: StatcastPitch[], count: number }
 *   400: { error: string }
 *   500: { error: string }
 *
 * Limit is capped server-side at 5 000 rows regardless of what the client
 * requests.  No auth required — public read (matches live_odds_cache policy).
 */
export async function POST(request: NextRequest) {
  try {
    let body: StatcastFilters = {};

    try {
      body = await request.json();
    } catch {
      // Empty body is fine — returns all rows up to limit
    }

    // Sanitise inputs
    const filters: StatcastFilters = {};

    if (body.batter !== undefined) {
      const b = Number(body.batter);
      if (!Number.isInteger(b) || b <= 0) {
        return NextResponse.json({ error: 'batter must be a positive integer (MLB player id)' }, { status: 400 });
      }
      filters.batter = b;
    }

    if (body.pitcher !== undefined) {
      const p = Number(body.pitcher);
      if (!Number.isInteger(p) || p <= 0) {
        return NextResponse.json({ error: 'pitcher must be a positive integer (MLB player id)' }, { status: 400 });
      }
      filters.pitcher = p;
    }

    if (body.pitch_type !== undefined) {
      filters.pitch_type = String(body.pitch_type).slice(0, 5).toUpperCase();
    }

    if (body.start !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.start))) {
        return NextResponse.json({ error: 'start must be a date in YYYY-MM-DD format' }, { status: 400 });
      }
      filters.start = String(body.start);
    }

    if (body.end !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.end))) {
        return NextResponse.json({ error: 'end must be a date in YYYY-MM-DD format' }, { status: 400 });
      }
      filters.end = String(body.end);
    }

    if (body.limit !== undefined) {
      const l = Number(body.limit);
      if (!Number.isInteger(l) || l < 1) {
        return NextResponse.json({ error: 'limit must be a positive integer' }, { status: 400 });
      }
      filters.limit = l; // getRawStatcast caps this at 5 000
    }

    const { data, error, count } = await getRawStatcast(filters);

    if (error) {
      const isMigrationError = error.includes('not yet migrated');
      return NextResponse.json(
        {
          error,
          ...(isMigrationError && {
            migration: 'Run scripts/statcast-schema.sql in Supabase SQL Editor to create the required tables',
          }),
        },
        { status: isMigrationError ? 503 : 500 },
      );
    }

    return NextResponse.json({ data, count: count ?? data.length });
  } catch (err) {
    console.error('[API/statcast/query] Unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

// Support GET for simple browser testing: ?batter=592450
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters: StatcastFilters = {};

    const batter = searchParams.get('batter');
    if (batter !== null) {
      const b = Number(batter);
      if (!Number.isInteger(b) || b <= 0) {
        return NextResponse.json({ error: 'batter must be a positive integer (MLB player id)' }, { status: 400 });
      }
      filters.batter = b;
    }

    const pitcher = searchParams.get('pitcher');
    if (pitcher !== null) {
      const p = Number(pitcher);
      if (!Number.isInteger(p) || p <= 0) {
        return NextResponse.json({ error: 'pitcher must be a positive integer (MLB player id)' }, { status: 400 });
      }
      filters.pitcher = p;
    }

    const pitchType = searchParams.get('pitch_type');
    if (pitchType !== null) {
      filters.pitch_type = pitchType.slice(0, 5).toUpperCase();
    }

    const start = searchParams.get('start');
    if (start !== null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
        return NextResponse.json({ error: 'start must be a date in YYYY-MM-DD format' }, { status: 400 });
      }
      filters.start = start;
    }

    const end = searchParams.get('end');
    if (end !== null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return NextResponse.json({ error: 'end must be a date in YYYY-MM-DD format' }, { status: 400 });
      }
      filters.end = end;
    }

    const limit = searchParams.get('limit');
    if (limit !== null) {
      const l = Number(limit);
      if (!Number.isInteger(l) || l < 1) {
        return NextResponse.json({ error: 'limit must be a positive integer' }, { status: 400 });
      }
      filters.limit = l; // getRawStatcast caps this at 5 000
    }

    const { data, error, count } = await getRawStatcast(filters);

    if (error) {
      const isMigrationError = error.includes('not yet migrated');
      return NextResponse.json(
        {
          error,
          ...(isMigrationError && {
            migration: 'Run POST /api/admin/migrate (Bearer <SUPABASE_SERVICE_ROLE_KEY>) to create the required tables',
          }),
        },
        { status: isMigrationError ? 503 : 500 },
      );
    }

    return NextResponse.json({ data, count: count ?? data.length });
  } catch (err) {
    console.error('[API/statcast/query] Unexpected GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
