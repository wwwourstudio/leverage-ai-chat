# Statcast / Baseball Savant Postgres Pipeline

End-to-end guide for the Statcast backfill and incremental ingestion system.

---

## Architecture Overview

```
Baseball Savant CSV endpoint
        │
        │  HTTPS  (scripts/scrape-statcast.ts)
        ▼
.statcast_resume.json          ← resume state persisted after each date
        │
        │  node-postgres  (upsert_statcast_event)
        ▼
api.statcast_raw_events        ← full JSONB, insert-once, re-normalizable
api.statcast_events            ← typed columns, indexed for analytics
```

---

## Step 1 — Run the Database Migration

### Via Supabase Dashboard (recommended)

1. Open your project → **SQL Editor → New query**.
2. Paste the entire contents of `migrations/0001_create_statcast_tables.sql`.
3. Click **Run**.
4. Verify with:

```sql
SELECT table_name,
       pg_size_pretty(pg_total_relation_size(
         ('"api"."' || table_name || '"')::regclass
       )) AS size
FROM   information_schema.tables
WHERE  table_schema = 'api'
  AND  table_name IN ('statcast_raw_events', 'statcast_events')
ORDER  BY table_name;

-- Confirm function exists and is SECURITY DEFINER
SELECT routine_name, security_type
FROM   information_schema.routines
WHERE  routine_schema = 'public'
  AND  routine_name   = 'upsert_statcast_event';
```

### Via psql

```bash
psql "$DATABASE_URL" -f migrations/0001_create_statcast_tables.sql
```

---

## Step 2 — Install Dependencies

```bash
# Always use pnpm for the Next.js project
pnpm install

# The scraper uses npm packages declared in devDependencies;
# they are installed by the pnpm install above via the workspace.
```

---

## Step 3 — Configure Environment Variables

Create (or update) `.env.local`:

```bash
# Required — use the Supabase "direct connection" string (port 5432), NOT the
# pooler/transaction URL, because the scraper uses long-lived transactions.
# Found in: Supabase Dashboard → Project Settings → Database → Connection string
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# Optional overrides (all have sensible defaults — see scrape-statcast.ts)
# START_DATE=2015-03-01        # or "earliest"
# END_DATE=2024-10-31
# CONCURRENT_REQUESTS=4
# BATCH_SIZE=500
# DRY_RUN=false
# RESUME_FILE=.statcast_resume.json
```

> **Important:** Use the **direct connection** string (port **5432**), not the
> transaction pooler (port 6543). The scraper calls a PL/pgSQL function inside
> explicit transactions; the transaction pooler breaks that.

---

## Step 4 — Test a One-Day Dry Run

```bash
# Dry-run: download CSV, parse, print counts — no DB writes
DRY_RUN=true START_DATE=2024-04-05 END_DATE=2024-04-05 pnpm scrape
```

Expected output:
```
→ 2024-04-05  downloading...
  ↓ 2024-04-05  parsed 742 rows → 742 with sv_id
  ⚡ DRY_RUN — skipping DB write for 2024-04-05
```

---

## Step 5 — Test a One-Day Real Write

```bash
START_DATE=2024-04-05 END_DATE=2024-04-05 pnpm scrape
```

Verify rows landed:

```sql
-- Via Supabase SQL Editor or psql
SELECT COUNT(*),
       MIN(game_date),
       MAX(game_date)
FROM   api.statcast_events
WHERE  game_date = '2024-04-05';

-- Spot-check a row
SELECT event_id, pitcher_name, batter_name, pitch_type,
       release_speed, events, launch_speed
FROM   api.statcast_events
WHERE  game_date = '2024-04-05'
LIMIT  5;
```

---

## Step 6 — Run the Full Historical Backfill

```bash
# Statcast era: 2015-03-01 → yesterday
START_DATE=earliest pnpm scrape
```

This will take **12–24 hours** at default concurrency (4 downloads in parallel).
The script checkpoints after every date; if it crashes, re-run the same command
and it will skip already-completed dates automatically.

Monitor progress via the resume file:

```bash
# How many dates are done?
node -e "const s = require('./.statcast_resume.json'); console.log(s.completed.length, 'dates done, last:', s.completed.at(-1))"
```

---

## Step 7 — Automating Daily Ingestion (GitHub Actions)

1. Add `DATABASE_URL` as a repository secret:
   **Settings → Secrets and variables → Actions → New repository secret**

2. The workflow (`.github/workflows/statcast-backfill.yml`) runs automatically
   at **04:00 UTC** every day, fetching yesterday's games.

3. To run a manual backfill for a specific date range:
   **Actions → Statcast Backfill / Daily Ingest → Run workflow**
   Fill in `start_date` and `end_date`.

---

## Verifying on Failure / Resume

```bash
# Check what's been completed
cat .statcast_resume.json | jq '.completed | length'

# Remove a specific date to force re-processing
node -e "
  const fs = require('fs');
  const s = JSON.parse(fs.readFileSync('.statcast_resume.json'));
  s.completed = s.completed.filter(d => d !== '2024-06-15');
  fs.writeFileSync('.statcast_resume.json', JSON.stringify(s, null, 2));
  console.log('Removed 2024-06-15 from completed list');
"

# Re-run
START_DATE=2024-06-15 END_DATE=2024-06-15 pnpm scrape
```

---

## Performance and Scale Estimates

| Metric | Estimate |
|---|---|
| Full Statcast era (2015–present) | ~9–12 million pitch rows |
| Raw CSV download (all years) | ~3–6 GB compressed |
| Row size in Postgres (raw + normalized) | ~2–4 KB avg → ~20–40 GB total |
| Full backfill time (4 concurrent) | 12–24 h |
| Daily incremental (1 day ≈ 1–2 k rows) | 1–3 min |

---

## Recommended Next Improvements

### 1. Faster bulk load via COPY

For the initial full backfill, downloading all CSVs to disk and using
`COPY FROM` is 5–10× faster than row-by-row upserts:

```sql
-- After downloading and deduplicating to a local file:
\COPY api.statcast_raw_events (event_id, event_dt, raw)
FROM '/tmp/statcast_2024.csv' CSV HEADER;
```

Use `ON CONFLICT DO NOTHING` for idempotency.

### 2. Stage through Supabase Storage

Upload daily CSVs to a Supabase Storage bucket, then process from there using
a Supabase Edge Function or `pg_net` — avoids re-downloading on retry.

### 3. Larger GitHub Actions runners

The default Ubuntu runner is slow for I/O-heavy workloads. A
`ubuntu-latest-8-core` runner (Actions billing: ~$0.10/h) cuts backfill time
significantly. Use `runs-on: ubuntu-latest-8-core` and raise
`CONCURRENT_REQUESTS=16`.

### 4. Partition statcast_events by year

For tables > 50 million rows, add declarative range partitioning on `game_date`
by year.  This enables partition pruning for season-scoped queries and makes
archiving old seasons trivial.

```sql
-- Example skeleton (do not run against existing data without a migration plan)
CREATE TABLE api.statcast_events_2024
  PARTITION OF api.statcast_events
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

### 5. Materialized views for leaderboards

Pre-aggregate xwOBA, barrel rate, and pitch-type breakdowns nightly:

```sql
CREATE MATERIALIZED VIEW api.statcast_pitcher_season AS
SELECT pitcher_id, pitcher_name,
       date_part('year', game_date)::int AS season,
       COUNT(*)                          AS pitches,
       AVG(release_speed)                AS avg_velo,
       AVG(CASE pitch_type WHEN 'FF' THEN release_speed END) AS avg_ff_velo
FROM   api.statcast_events
WHERE  pitcher_id IS NOT NULL
GROUP  BY 1, 2, 3
WITH   NO DATA;

REFRESH MATERIALIZED VIEW CONCURRENTLY api.statcast_pitcher_season;
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `ERROR: sv_id is missing` | Row has blank sv_id (spring training/exhibition) | Normal — rows are skipped |
| HTTP 503 from Savant | Rate limited or server down | Retry automatically; add `--wait` |
| `SSL SYSCALL error` | Pooler URL used instead of direct | Switch to port 5432 direct URL |
| `permission denied for function` | EXECUTE not granted | Re-run migration; check service_role |
| Duplicate key violations | None — upsert handles this | N/A — idempotent by design |
