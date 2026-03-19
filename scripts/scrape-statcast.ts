/**
 * =============================================================================
 * scripts/scrape-statcast.ts
 * =============================================================================
 * Production-ready Statcast / Baseball Savant historical backfill + daily
 * incremental ingestion script.
 *
 * USAGE
 * -----
 *   # One-shot (uses env vars or defaults):
 *   pnpm scrape
 *
 *   # Single day test:
 *   START_DATE=2024-04-01 END_DATE=2024-04-01 pnpm scrape
 *
 *   # Dry-run (no DB writes):
 *   DRY_RUN=true START_DATE=2024-04-01 END_DATE=2024-04-02 pnpm scrape
 *
 *   # Resume after failure (auto-detected via RESUME_FILE):
 *   pnpm scrape
 *
 * ENVIRONMENT VARIABLES
 * ---------------------
 *   DATABASE_URL          | Required. Postgres connection string.
 *                         | Also accepted as SUPABASE_DB_URL.
 *   START_DATE            | Default: 2015-03-01  (MLB Statcast era start)
 *                         | Accept ISO date string or "earliest".
 *   END_DATE              | Default: yesterday (ISO date string).
 *   CONCURRENT_REQUESTS   | Default: 4. Max parallel CSV downloads.
 *   BATCH_SIZE            | Default: 500. Rows per DB transaction.
 *   DRY_RUN               | Default: false. Set to "true" to skip DB writes.
 *   RESUME_FILE           | Default: .statcast_resume.json
 *
 * REPLACING THE DOWNLOAD URL
 * --------------------------
 *   The function `buildSavantUrl(date)` at the top of this file is the
 *   SINGLE place to change the download URL pattern.  The placeholder below
 *   uses the Baseball Savant search CSV endpoint which is publicly documented,
 *   but you should verify the current URL pattern against:
 *     https://baseballsavant.mlb.com/statcast_search
 *   before running a full backfill.
 *
 * PERFORMANCE NOTES
 * -----------------
 *   Full MLB history (2015–present) ≈ 8–12 million pitch rows (~3-6 GB CSV).
 *   At CONCURRENT_REQUESTS=4 with Savant rate-limits, expect 12–24 h for a
 *   full backfill on a fast server.  See README for faster alternatives
 *   (bulk S3 dumps, COPY, Supabase Storage staging).
 *
 * DEPENDENCIES
 *   npm: pg  csv-parse  bottleneck  p-retry  node-fetch  dotenv
 *   types: @types/pg  @types/node
 * =============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { URL } from 'url';
import { parse as csvParse, Options as CsvOptions } from 'csv-parse';
import { Pool, PoolClient } from 'pg';
import Bottleneck from 'bottleneck';
import pRetry, { FailedAttemptError } from 'p-retry';
import 'dotenv/config';

// =============================================================================
// ░░  SECTION 1 — CONFIGURATION  ░░
// =============================================================================

const DATABASE_URL: string =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  (() => { throw new Error('DATABASE_URL (or SUPABASE_DB_URL) is required'); })();

/** Earliest date in the Statcast era.  Change if Savant extends coverage. */
const STATCAST_ERA_START = '2015-03-01';

const START_DATE: string = (() => {
  const raw = process.env.START_DATE || STATCAST_ERA_START;
  return raw === 'earliest' ? STATCAST_ERA_START : raw;
})();

const END_DATE: string = (() => {
  const raw = process.env.END_DATE;
  if (raw) return raw;
  // Default: yesterday (avoid partial-day issues with today's games)
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
})();

const CONCURRENT_REQUESTS: number = parseInt(process.env.CONCURRENT_REQUESTS ?? '4', 10);
const BATCH_SIZE:          number = parseInt(process.env.BATCH_SIZE          ?? '500', 10);
const DRY_RUN:             boolean = process.env.DRY_RUN === 'true';
const RESUME_FILE:         string = process.env.RESUME_FILE ?? '.statcast_resume.json';

// Retry configuration
const MAX_DOWNLOAD_RETRIES = 5;
const MAX_DB_RETRIES       = 4;

// =============================================================================
// ░░  SECTION 2 — DOWNLOAD URL BUILDER  ░░
// =============================================================================
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  THIS IS THE SINGLE PLACE TO CHANGE THE SAVANT CSV ENDPOINT.            │
// │  Current pattern fetches all pitches for a given calendar date.         │
// │  Verify against https://baseballsavant.mlb.com/statcast_search before   │
// │  running a full historical backfill.                                    │
// └─────────────────────────────────────────────────────────────────────────┘

function buildSavantUrl(date: string): string {
  // date must be YYYY-MM-DD
  const base = 'https://baseballsavant.mlb.com/statcast_search/csv';
  const params = new URLSearchParams({
    all:           'true',
    type:          'details',
    game_date_gt:  date,
    game_date_lt:  date,
    // Add additional filters here (e.g. player_type, hfGT) as needed
    // hfGT: 'R%7C',  // Regular season only
  });
  return `${base}?${params.toString()}`;
}

// =============================================================================
// ░░  SECTION 3 — RESUME FILE  ░░
// =============================================================================

interface ResumeState {
  /** ISO date strings that have been fully ingested (all rows committed). */
  completed: string[];
  /** Last date that was only partially processed (re-run from here). */
  inProgress?: string;
  updatedAt: string;
}

function loadResumeState(): ResumeState {
  try {
    const raw = fs.readFileSync(RESUME_FILE, 'utf8');
    return JSON.parse(raw) as ResumeState;
  } catch {
    return { completed: [], updatedAt: new Date().toISOString() };
  }
}

function saveResumeState(state: ResumeState): void {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(RESUME_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// =============================================================================
// ░░  SECTION 4 — DATE UTILITIES  ░░
// =============================================================================

/** Produce every calendar date in [start, end] as YYYY-MM-DD strings. */
function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T00:00:00Z');
  const fin = new Date(end   + 'T00:00:00Z');
  while (cur <= fin) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// =============================================================================
// ░░  SECTION 5 — CSV DOWNLOAD  ░░
// =============================================================================

/**
 * Download a URL to a temporary file path, with retries and exponential
 * backoff.  Returns the path of the written temp file, or null if the
 * server returned a non-200 status (e.g. no games on that date).
 */
async function downloadToTemp(url: string, label: string): Promise<string | null> {
  return pRetry(
    async (attemptNumber: number) => {
      const tmpPath = path.join(
        process.env.TMPDIR ?? '/tmp',
        `statcast_${Date.now()}_${Math.random().toString(36).slice(2)}.csv`
      );

      await new Promise<void>((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
          hostname: parsedUrl.hostname,
          path:     parsedUrl.pathname + parsedUrl.search,
          headers:  {
            'User-Agent':
              'Mozilla/5.0 (compatible; LeverageAI-Statcast-Scraper/1.0; +https://github.com/wwwourstudio/leverage-ai-chat)',
            'Accept': 'text/csv,*/*',
          },
        };

        const req = https.get(options, (res) => {
          if (res.statusCode === 200) {
            const out = fs.createWriteStream(tmpPath);
            res.pipe(out);
            out.on('finish', () => out.close(() => resolve()));
            out.on('error', reject);
          } else if (res.statusCode === 404 || res.statusCode === 204) {
            // No data for this date — not a retry-able error
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode} for ${label} (attempt ${attemptNumber})`));
          }
        });

        req.on('error', reject);
        req.setTimeout(120_000, () => {
          req.destroy(new Error(`Download timeout for ${label}`));
        });
      });

      // Return null if file is empty (no games that day)
      if (!fs.existsSync(tmpPath)) return null;
      const stat = fs.statSync(tmpPath);
      if (stat.size < 50) {
        fs.unlinkSync(tmpPath);
        return null;
      }
      return tmpPath;
    },
    {
      retries:   MAX_DOWNLOAD_RETRIES,
      minTimeout: 2_000,
      maxTimeout: 32_000,
      factor:     2,
      onFailedAttempt: (err: FailedAttemptError) => {
        console.warn(
          `  ↺ Download retry ${err.attemptNumber}/${MAX_DOWNLOAD_RETRIES + 1} for ${label}: ${err.message}`
        );
      },
    }
  );
}

// =============================================================================
// ░░  SECTION 6 — CSV PARSING  ░░
// =============================================================================

/** Row from csv-parse with headers enabled — all values are strings. */
type RawRow = Record<string, string>;

/** Parse a CSV file into an array of plain objects keyed by header names. */
async function parseCsvFile(filePath: string): Promise<RawRow[]> {
  return new Promise((resolve, reject) => {
    const rows: RawRow[] = [];
    const opts: CsvOptions = {
      columns:          true,   // use first row as header keys
      skip_empty_lines: true,
      trim:             true,
      relax_column_count: true, // Savant occasionally adds/removes columns
      cast:             false,  // keep everything as strings; DB does the casting
    };
    fs.createReadStream(filePath)
      .pipe(csvParse(opts))
      .on('data', (row: RawRow) => rows.push(row))
      .on('error', reject)
      .on('end', () => resolve(rows));
  });
}

/**
 * Convert a raw CSV row (all strings) into the JSONB payload expected by
 * public.upsert_statcast_event().  All values are kept as strings so Postgres
 * does the type coercion — this keeps the mapping fully generic.
 *
 * The only requirement: the row MUST contain a non-empty "sv_id" key.
 */
function rowToJsonb(row: RawRow): Record<string, string> | null {
  const svId = (row['sv_id'] ?? '').trim();
  if (!svId) return null;   // skip rows without a unique key
  return { ...row };        // pass-through; upsert function handles all casting
}

// =============================================================================
// ░░  SECTION 7 — DATABASE BATCH WRITER  ░░
// =============================================================================

/** Write up to BATCH_SIZE rows per transaction using the upsert function. */
async function writeBatch(
  client: PoolClient,
  rows:   Record<string, string>[],
  label:  string
): Promise<number> {
  if (rows.length === 0) return 0;

  let written = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    await pRetry(
      async () => {
        await client.query('BEGIN');
        try {
          for (const row of batch) {
            // Serialize to JSON string, then pass as a single $1 parameter.
            // node-postgres will send it as a properly-quoted literal — no
            // manual single-quote escaping needed.
            await client.query(
              'SELECT public.upsert_statcast_event($1::jsonb)',
              [JSON.stringify(row)]
            );
          }
          await client.query('COMMIT');
          written += batch.length;
          process.stdout.write(
            `\r  ✓ ${label}: ${written}/${rows.length} rows committed`
          );
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      },
      {
        retries:   MAX_DB_RETRIES,
        minTimeout: 1_000,
        maxTimeout: 16_000,
        factor:     2,
        shouldRetry: (err: Error) => {
          // Retry transient Postgres errors (deadlock, serialization failure, etc.)
          const pg = err as NodeJS.ErrnoException & { code?: string };
          const transient = ['40001', '40P01', '08006', '08001', '08003', 'ECONNRESET'];
          return transient.includes(pg.code ?? '');
        },
        onFailedAttempt: (err: FailedAttemptError) => {
          console.warn(
            `\n  ↺ DB retry ${err.attemptNumber}/${MAX_DB_RETRIES + 1} for batch: ${err.message}`
          );
        },
      }
    );
  }

  process.stdout.write('\n');
  return written;
}

// =============================================================================
// ░░  SECTION 8 — PER-DATE PIPELINE  ░░
// =============================================================================

async function processDate(date: string, pool: Pool): Promise<void> {
  const url = buildSavantUrl(date);
  console.log(`→ ${date}  downloading...`);

  const tmpFile = await downloadToTemp(url, date);
  if (!tmpFile) {
    console.log(`  ⊘ ${date}  no data (off-season / no games)`);
    return;
  }

  const rawRows = await parseCsvFile(tmpFile);
  fs.unlinkSync(tmpFile);   // clean up temp file immediately

  const jsonRows = rawRows
    .map(rowToJsonb)
    .filter((r): r is Record<string, string> => r !== null);

  console.log(`  ↓ ${date}  parsed ${rawRows.length} rows → ${jsonRows.length} with sv_id`);

  if (DRY_RUN) {
    console.log(`  ⚡ DRY_RUN — skipping DB write for ${date}`);
    return;
  }

  if (jsonRows.length === 0) return;

  const client = await pool.connect();
  try {
    await writeBatch(client, jsonRows, date);
  } finally {
    client.release();
  }
}

// =============================================================================
// ░░  SECTION 9 — CONCURRENCY LIMITER  ░░
// =============================================================================

function makeLimiter(): Bottleneck {
  return new Bottleneck({
    maxConcurrent: CONCURRENT_REQUESTS,
    // Add a minimum gap between requests to be polite to Savant servers.
    // Baseball Savant does not publish a formal rate-limit policy; 500 ms is
    // conservative enough to avoid triggering any soft block.
    minTime: 500,
  });
}

// =============================================================================
// ░░  SECTION 10 — MAIN  ░░
// =============================================================================

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('  Leverage AI — Statcast Backfill Scraper');
  console.log('='.repeat(70));
  console.log(`  START_DATE          : ${START_DATE}`);
  console.log(`  END_DATE            : ${END_DATE}`);
  console.log(`  CONCURRENT_REQUESTS : ${CONCURRENT_REQUESTS}`);
  console.log(`  BATCH_SIZE          : ${BATCH_SIZE}`);
  console.log(`  DRY_RUN             : ${DRY_RUN}`);
  console.log(`  RESUME_FILE         : ${RESUME_FILE}`);
  console.log('='.repeat(70));

  // ── Database pool ──────────────────────────────────────────────────────────
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max:              CONCURRENT_REQUESTS + 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  pool.on('error', (err) => {
    console.error('PG pool error:', err.message);
  });

  // Quick connection test
  try {
    const c = await pool.connect();
    const { rows } = await c.query('SELECT current_database(), current_schema()');
    console.log(`  DB connected: ${rows[0].current_database} / ${rows[0].current_schema}`);
    c.release();
  } catch (err) {
    console.error('FATAL: Cannot connect to database:', (err as Error).message);
    process.exit(1);
  }

  // ── Build date list, apply resume filter ──────────────────────────────────
  const state   = loadResumeState();
  const allDates = dateRange(START_DATE, END_DATE);
  const completedSet = new Set(state.completed);

  const pendingDates = allDates.filter((d) => !completedSet.has(d));

  console.log(`\n  Total dates in range : ${allDates.length}`);
  console.log(`  Already completed    : ${completedSet.size}`);
  console.log(`  To process           : ${pendingDates.length}\n`);

  if (pendingDates.length === 0) {
    console.log('  ✅ All dates already processed.  Nothing to do.');
    await pool.end();
    return;
  }

  // ── Process with concurrency limiter ──────────────────────────────────────
  const limiter  = makeLimiter();
  let   errors   = 0;
  const startTs  = Date.now();

  const tasks = pendingDates.map((date) =>
    limiter.schedule(async () => {
      try {
        await processDate(date, pool);
        state.completed.push(date);
        // Persist progress after every successful date so a crash is resumable
        saveResumeState(state);
      } catch (err) {
        errors++;
        console.error(`\n  ✗ ERROR on ${date}: ${(err as Error).message}`);
        // Continue — don't mark this date complete so it will be retried
      }
    })
  );

  await Promise.allSettled(tasks);

  // ── Summary ───────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);
  const processed = pendingDates.length - errors;

  console.log('\n' + '='.repeat(70));
  console.log(`  Done.  ${processed} dates processed, ${errors} errors, ${elapsed}s elapsed`);
  if (errors > 0) {
    console.log(`  Failed dates will be retried on next run (see ${RESUME_FILE})`);
  }
  console.log('='.repeat(70));

  await pool.end();
  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
