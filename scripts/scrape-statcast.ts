/**
 * =============================================================================
 * scripts/scrape-statcast.ts
 * =============================================================================
 * Production-ready Statcast / Baseball Savant historical backfill + daily
 * incremental ingestion script.
 *
 * Uses @supabase/supabase-js with service role key — no DB password needed.
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
 * ENVIRONMENT VARIABLES
 * ---------------------
 *   SUPABASE_URL          | Required. e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY | Required. Service role key (not anon key).
 *   START_DATE            | Default: 2015-03-01  (MLB Statcast era start)
 *   END_DATE              | Default: yesterday
 *   CONCURRENT_REQUESTS   | Default: 4
 *   BATCH_SIZE            | Default: 50 (RPC calls per parallel batch)
 *   DRY_RUN               | Default: false
 *   RESUME_FILE           | Default: .statcast_resume.json
 * =============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { URL } from 'url';
import { parse as csvParse } from 'csv-parse';
import type { Options as CsvOptions } from 'csv-parse';
import { createClient } from '@supabase/supabase-js';
import Bottleneck from 'bottleneck';
import pRetry from 'p-retry';
import type { FailedAttemptError } from 'p-retry';
import 'dotenv/config';

// =============================================================================
// ░░  SECTION 1 — CONFIGURATION  ░░
// =============================================================================

const SUPABASE_URL: string =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (() => { throw new Error('SUPABASE_URL is required'); })();

const SUPABASE_SERVICE_ROLE_KEY: string =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  (() => { throw new Error('SUPABASE_SERVICE_ROLE_KEY is required'); })();

const STATCAST_ERA_START = '2015-03-01';

const START_DATE: string = (() => {
  const raw = process.env.START_DATE || STATCAST_ERA_START;
  return raw === 'earliest' ? STATCAST_ERA_START : raw;
})();

const END_DATE: string = (() => {
  const raw = process.env.END_DATE;
  if (raw) return raw;
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
})();

const CONCURRENT_REQUESTS: number = parseInt(process.env.CONCURRENT_REQUESTS ?? '4', 10);
const BATCH_SIZE:          number = parseInt(process.env.BATCH_SIZE          ?? '50', 10);
const DRY_RUN:             boolean = process.env.DRY_RUN === 'true';
const RESUME_FILE:         string = process.env.RESUME_FILE ?? '.statcast_resume.json';

const MAX_DOWNLOAD_RETRIES = 5;
const MAX_DB_RETRIES       = 4;

// =============================================================================
// ░░  SECTION 2 — DOWNLOAD URL BUILDER  ░░
// =============================================================================

function buildSavantUrl(date: string): string {
  const base = 'https://baseballsavant.mlb.com/statcast_search/csv';
  const params = new URLSearchParams({
    all:          'true',
    type:         'details',
    csv:          'true',
    hfGT:         'R|',
    game_date_gt: date,
    game_date_lt: date,
  });
  return `${base}?${params.toString()}`;
}

// =============================================================================
// ░░  SECTION 3 — RESUME FILE  ░░
// =============================================================================

interface ResumeState {
  completed: string[];
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
            'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept':          'text/csv, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer':         'https://baseballsavant.mlb.com/statcast_search',
            'Cache-Control':   'no-cache',
          },
        };

        const req = https.get(options, (res) => {
          if (res.statusCode === 200) {
            const out = fs.createWriteStream(tmpPath);
            res.pipe(out);
            out.on('finish', () => out.close(() => resolve()));
            out.on('error', reject);
          } else if (res.statusCode === 404 || res.statusCode === 204) {
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

      if (!fs.existsSync(tmpPath)) return null;
      const stat = fs.statSync(tmpPath);
      if (stat.size < 50) {
        fs.unlinkSync(tmpPath);
        return null;
      }
      return tmpPath;
    },
    {
      retries:    MAX_DOWNLOAD_RETRIES,
      minTimeout: 2_000,
      maxTimeout: 32_000,
      factor:     2,
      onFailedAttempt: (err: FailedAttemptError) => {
        console.warn(`  ↺ Download retry ${err.attemptNumber}/${MAX_DOWNLOAD_RETRIES + 1} for ${label}: ${err.message}`);
      },
    }
  );
}

// =============================================================================
// ░░  SECTION 6 — CSV PARSING  ░░
// =============================================================================

type RawRow = Record<string, string>;

async function parseCsvFile(filePath: string): Promise<RawRow[]> {
  return new Promise((resolve, reject) => {
    const rows: RawRow[] = [];
    const opts: CsvOptions = {
      columns:            true,
      skip_empty_lines:   true,
      trim:               true,
      relax_column_count: true,
      cast:               false,
      bom:                true,   // strip UTF-8 BOM (﻿) that Baseball Savant sometimes emits
    };
    fs.createReadStream(filePath)
      .pipe(csvParse(opts))
      .on('data', (row: RawRow) => rows.push(row))
      .on('error', reject)
      .on('end', () => resolve(rows));
  });
}

function rowToJsonb(row: RawRow): Record<string, string> | null {
  const svId = (row['sv_id'] ?? '').trim();
  if (!svId) return null;
  return { ...row };
}

// =============================================================================
// ░░  SECTION 7 — DATABASE BATCH WRITER (Supabase RPC)  ░░
// =============================================================================

type SupabaseClient = ReturnType<typeof createClient>;

async function writeBatch(
  supabase: SupabaseClient,
  rows:     Record<string, string>[],
  label:    string
): Promise<number> {
  if (rows.length === 0) return 0;

  let written = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    // Call upsert_statcast_event RPC for each row in parallel within the batch
    const results = await Promise.allSettled(
      batch.map((row) =>
        pRetry(
          async () => {
            const { error } = await supabase.rpc('upsert_statcast_event', { p_row: row });
            if (error) throw new Error(error.message);
          },
          {
            retries:    MAX_DB_RETRIES,
            minTimeout: 1_000,
            maxTimeout: 16_000,
            factor:     2,
            onFailedAttempt: (err: FailedAttemptError) => {
              console.warn(`\n  ↺ DB retry ${err.attemptNumber}/${MAX_DB_RETRIES + 1}: ${err.message}`);
            },
          }
        )
      )
    );

    const batchErrors = results.filter((r) => r.status === 'rejected').length;
    written += batch.length - batchErrors;

    process.stdout.write(`\r  ✓ ${label}: ${written}/${rows.length} rows written`);
  }

  process.stdout.write('\n');
  return written;
}

// =============================================================================
// ░░  SECTION 8 — PER-DATE PIPELINE  ░░
// =============================================================================

async function processDate(date: string, supabase: SupabaseClient): Promise<void> {
  const url = buildSavantUrl(date);
  console.log(`→ ${date}  downloading...`);

  const tmpFile = await downloadToTemp(url, date);
  if (!tmpFile) {
    console.log(`  ⊘ ${date}  no data (off-season / no games)`);
    return;
  }

  const rawRows = await parseCsvFile(tmpFile);
  fs.unlinkSync(tmpFile);

  const jsonRows = rawRows
    .map(rowToJsonb)
    .filter((r): r is Record<string, string> => r !== null);

  console.log(`  ↓ ${date}  parsed ${rawRows.length} rows → ${jsonRows.length} with sv_id`);

  if (DRY_RUN) {
    console.log(`  ⚡ DRY_RUN — skipping DB write for ${date}`);
    return;
  }

  if (jsonRows.length === 0) return;

  await writeBatch(supabase, jsonRows, date);
}

// =============================================================================
// ░░  SECTION 9 — CONCURRENCY LIMITER  ░░
// =============================================================================

function makeLimiter(): Bottleneck {
  return new Bottleneck({
    maxConcurrent: CONCURRENT_REQUESTS,
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
  console.log(`  SUPABASE_URL        : ${SUPABASE_URL}`);
  console.log(`  START_DATE          : ${START_DATE}`);
  console.log(`  END_DATE            : ${END_DATE}`);
  console.log(`  CONCURRENT_REQUESTS : ${CONCURRENT_REQUESTS}`);
  console.log(`  BATCH_SIZE          : ${BATCH_SIZE}`);
  console.log(`  DRY_RUN             : ${DRY_RUN}`);
  console.log(`  RESUME_FILE         : ${RESUME_FILE}`);
  console.log('='.repeat(70));

  // ── Supabase client ────────────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Quick connectivity test — any response (even a DB error) means we're connected
  console.log('  Testing Supabase connection...');
  try {
    await supabase.rpc('upsert_statcast_event', { p_row: { sv_id: '__connection_test__' } });
  } catch (testErr) {
    console.error('FATAL: Cannot reach Supabase:', (testErr as Error).message);
    process.exit(1);
  }
  console.log('  DB connected ✓');

  // ── Build date list, apply resume filter ──────────────────────────────────
  const state      = loadResumeState();
  const allDates   = dateRange(START_DATE, END_DATE);
  const completedSet = new Set(state.completed);
  const pendingDates = allDates.filter((d) => !completedSet.has(d));

  console.log(`\n  Total dates in range : ${allDates.length}`);
  console.log(`  Already completed    : ${completedSet.size}`);
  console.log(`  To process           : ${pendingDates.length}\n`);

  if (pendingDates.length === 0) {
    console.log('  ✅ All dates already processed.  Nothing to do.');
    return;
  }

  // ── Process with concurrency limiter ──────────────────────────────────────
  const limiter = makeLimiter();
  let   errors  = 0;
  const startTs = Date.now();

  const tasks = pendingDates.map((date) =>
    limiter.schedule(async () => {
      try {
        await processDate(date, supabase);
        state.completed.push(date);
        saveResumeState(state);
      } catch (err) {
        errors++;
        console.error(`\n  ✗ ERROR on ${date}: ${(err as Error).message}`);
      }
    })
  );

  await Promise.allSettled(tasks);

  const elapsed   = ((Date.now() - startTs) / 1000).toFixed(1);
  const processed = pendingDates.length - errors;

  console.log('\n' + '='.repeat(70));
  console.log(`  Done.  ${processed} dates processed, ${errors} errors, ${elapsed}s elapsed`);
  if (errors > 0) {
    console.log(`  Failed dates will be retried on next run (see ${RESUME_FILE})`);
  }
  console.log('='.repeat(70));

  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
