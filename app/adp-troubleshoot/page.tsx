'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Terminal,
  Database,
  Upload,
  FileText,
  Settings,
  Search,
  HelpCircle,
  Info,
  Wrench,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Step {
  label: string;
  detail: string;
  code?: string;
  note?: string;
}

interface Section {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  accent: string;
  steps: Step[];
}

// ── Data ─────────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: 'overview',
    icon: Info,
    title: 'What the log message means',
    subtitle: 'Understanding the trigger point in the codebase',
    accent: 'blue',
    steps: [
      {
        label: 'Log origin',
        detail:
          'The message is emitted from lib/adp-data.ts → getADPData() at the final else-branch, after every higher-priority data source has returned nothing.',
        code: `// lib/adp-data.ts — line ~450
console.log(\`[ADP] No MLB ADP upload found — serving static fallback (\${STATIC_FALLBACK_PLAYERS.length} players)\`);
return STATIC_FALLBACK_PLAYERS;`,
      },
      {
        label: 'Call hierarchy that reaches this log',
        detail:
          'getADPData() is called by the AI analyze route and any card that renders ADP data. The function first checks the in-memory module-level cache, then queries Supabase (api.nfbc_adp WHERE sport = "mlb"), and only reaches the fallback when both are empty or null.',
        code: `getADPData()
  ├─ 1. In-memory cache (adpCache) — skipped if null or expired (5-min TTL)
  ├─ 2. loadADPFromSupabase("mlb", allowStale=true)
  │     ├─ Returns null if Supabase client is null (missing env vars)
  │     ├─ Returns null if query returns 0 rows
  │     └─ Returns null if data is malformed (>30% numeric display names)
  └─ 3. ← YOU ARE HERE: STATIC_FALLBACK_PLAYERS (120 players)`,
      },
      {
        label: 'Is this an error?',
        detail:
          'Not always. On first deployment before any admin has uploaded a TSV, this is the expected path. It becomes a problem when an upload was performed but the log keeps firing, or when fresh NFBC data is required for drafts that are in progress.',
        note: 'The fallback dataset is 2026 NFBC pre-season consensus (hardcoded in lib/adp-data.ts). It covers top-120 picks. It is safe to serve but never reflects live draft trends.',
      },
    ],
  },
  {
    id: 'causes',
    icon: Search,
    title: 'Root cause checklist',
    subtitle: 'Work through these in order — most common cause first',
    accent: 'amber',
    steps: [
      {
        label: 'Cause 1 — No TSV has ever been uploaded',
        detail:
          'The api.nfbc_adp table is empty for sport = "mlb". This is the expected initial state after a fresh deployment. No TSV file has been submitted via the Upload ADP modal (Settings → ADP Data).',
        note: 'Fix: perform an initial upload (see "Solutions" section below).',
      },
      {
        label: 'Cause 2 — Supabase env vars are missing or wrong',
        detail:
          'getADPSupabaseClient() returns null when NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) are not set. loadADPFromSupabase() short-circuits and returns null silently.',
        code: `// lib/supabase/adp-client.server.ts
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) return null;   // ← silent null, fallback fires`,
        note: 'Fix: ensure both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in Vercel → Project Settings → Environment Variables.',
      },
      {
        label: 'Cause 3 — nfbc_adp table does not exist in Supabase',
        detail:
          'If the master schema migration (scripts/master-schema.sql) was never run against the project\'s Supabase instance, the table does not exist. The .select() call will return a Postgres error, loadADPFromSupabase() catches it silently and returns null.',
        note: 'Fix: run POST /api/admin/migrate authenticated with the SUPABASE_SERVICE_ROLE_KEY to create all tables.',
      },
      {
        label: 'Cause 4 — RLS policy blocks the read',
        detail:
          'api.nfbc_adp has RLS enabled. The read policy ("nfbc_adp_read") grants SELECT to all roles including anon. If the policy was accidentally dropped or the table was recreated without re-applying policies, the query returns 0 rows.',
        code: `-- Expected RLS state
CREATE POLICY "nfbc_adp_read"
  ON api.nfbc_adp FOR SELECT USING (true);

CREATE POLICY "nfbc_adp_service_write"
  ON api.nfbc_adp FOR ALL TO service_role
  USING (true) WITH CHECK (true);`,
        note: 'Fix: re-run the RLS portion of master-schema.sql or apply the policies manually via the Supabase SQL editor.',
      },
      {
        label: 'Cause 5 — Upload succeeded but data was malformed',
        detail:
          'If >30% of display_name values in the uploaded file are purely numeric (i.e. NFBC player ID integers ended up in the name column), getADPData() automatically purges the bad rows from Supabase and falls back to static. A separate warning log fires just before the fallback log.',
        code: `// lib/adp-data.ts — malformed upload detection
const numericCount = dbData.filter(p =>
  /^\\d+$/.test((p.displayName ?? '').trim())
).length;
if (numericCount > dbData.length * 0.3) {
  // purge + fallback
}`,
        note: 'Fix: re-download the TSV from nfc.shgn.com/adp/baseball and ensure the "Player" column contains real names. See Upload Validation section below.',
      },
      {
        label: 'Cause 6 — Serverless cold start with an empty in-memory cache',
        detail:
          'The module-level adpCache variable resets to null on every cold start. If Supabase is reachable the cache refills from the DB on the first request. If you see the fallback log only on the very first request after idle time and not on subsequent ones, this is expected — the next warm invocation will serve from cache.',
        note: 'This is not a bug. Only investigate further if the fallback persists across multiple consecutive requests.',
      },
      {
        label: 'Cause 7 — Supabase schema mismatch (wrong schema or missing column)',
        detail:
          'The Supabase client is configured with db: { schema: "api" }. If the nfbc_adp table was accidentally created in the "public" schema, or a required column (display_name, sport) is missing, the query will fail silently.',
        code: `-- Verify the table is in the "api" schema
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name = 'nfbc_adp';
-- Expected result: table_schema = 'api'`,
      },
    ],
  },
  {
    id: 'diagnostics',
    icon: Terminal,
    title: 'Diagnostic steps',
    subtitle: 'Ordered sequence to identify the exact failure point',
    accent: 'violet',
    steps: [
      {
        label: 'Step 1 — Check Vercel logs for companion log lines',
        detail:
          'The fallback log always fires in isolation. Search the surrounding log lines for these patterns to identify which branch was taken:',
        code: `# Healthy path (upload exists, Supabase readable):
[ADP] Serving N MLB players from Supabase (user upload)

# Malformed upload (purge triggered):
[ADP] Supabase data has N/M numeric display names — upload malformed, purging...

# Supabase write failed during upload:
[ADP] Supabase delete failed (non-critical): ...
[ADP] Supabase insert batch failed: ...

# Upload succeeded — emitted by the upload route:
[ADP] User uploaded N MLB ADP players

# Supabase client built successfully:
# (no log — getADPSupabaseClient returns silently on success)

# Supabase client is null (env vars missing):
# (no log — returns null silently; fallback fires next)`,
        note: 'Filter Vercel function logs by "[ADP]" to see the full picture in sequence.',
      },
      {
        label: 'Step 2 — Verify environment variables in Vercel',
        detail:
          'Navigate to Vercel → Project → Settings → Environment Variables and confirm the following variables are set for the Production (and Preview) environments:',
        code: `NEXT_PUBLIC_SUPABASE_URL        # e.g. https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY       # service_role JWT (not anon key)
NEXT_PUBLIC_SUPABASE_ANON_KEY   # anon/public JWT (optional fallback)`,
        note: 'If env vars were added recently, re-deploy the project so the new values are picked up by the serverless runtime.',
      },
      {
        label: 'Step 3 — Verify the nfbc_adp table exists and has data',
        detail:
          'Run the following queries in the Supabase SQL editor (Database → SQL editor):',
        code: `-- 1. Confirm table exists in "api" schema
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_name = 'nfbc_adp';

-- 2. Count rows by sport
SELECT sport, COUNT(*) AS row_count, MAX(fetched_at) AS last_upload
FROM api.nfbc_adp
GROUP BY sport;

-- 3. Sample top-5 MLB rows
SELECT rank, display_name, adp, positions, team, fetched_at
FROM api.nfbc_adp
WHERE sport = 'mlb'
ORDER BY rank
LIMIT 5;`,
        note: 'If the table does not exist, run the migration (Step 4). If it exists but is empty, perform an upload (Step 5). If display_name values are integers, the upload was malformed (Step 6).',
      },
      {
        label: 'Step 4 — Verify RLS policies',
        detail:
          'Run in the Supabase SQL editor to confirm RLS is configured correctly:',
        code: `SELECT schemaname, tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'nfbc_adp'
ORDER BY policyname;

-- Expected rows:
-- nfbc_adp_read         | SELECT | {public}        | (true)
-- nfbc_adp_service_write| ALL    | {service_role}  | (true)`,
        note: 'If policies are missing, re-run the master-schema.sql RLS block or the migration endpoint.',
      },
      {
        label: 'Step 5 — Test the upload endpoint directly with curl',
        detail:
          'Download the TSV from nfc.shgn.com/adp/baseball and send it to the upload route to verify end-to-end without the UI:',
        code: `# Replace <your-domain> and <tsv-file-path>
curl -X POST https://<your-domain>/api/adp/upload \\
  -F "file=@/path/to/nfbc-adp.tsv" \\
  -F "sport=mlb"

# Expected 200 response:
# { "success": true, "count": 300, "sport": "mlb", "message": "..." }

# Common error responses:
# 400 — No file provided (form data not attached)
# 422 — File is empty
# 422 — File parsed to 0 players (wrong format / delimiter)
# 422 — Upload rejected: N/M player names are numeric IDs
# 500 — Internal error (check Vercel logs for the stack trace)`,
      },
      {
        label: 'Step 6 — Validate the TSV file format before uploading',
        detail:
          'The parser (lib/adp-data.ts → parseTSV) auto-detects tab vs comma delimiters from the header row and resolves column indices dynamically. Required columns (any name containing these strings):',
        code: `# Header column name matching (case-insensitive substring)
rank        → "rank"
player      → "player" or "name"
adp         → "overall adp", "adp", "overall", or "avg"
positions   → "position(s)", "positions", or "pos"
team        → "team"

# Validate with a quick shell preview:
head -3 nfbc-adp.tsv | cat -A   # -A shows tab chars as ^I

# A well-formed NFBC TSV header looks like:
# Rank\\tPlayer\\tTeam\\tPosition(s)\\tOverall ADP\\t...
# Row 2 should have a real name like "Witt, Bobby Jr." not "10231"`,
        note: 'If you downloaded the file and the "Player" column contains numeric IDs, use the "Download" button on the NFBC board page, not the copy-paste or API export.',
      },
      {
        label: 'Step 7 — Force a cache bust after a successful upload',
        detail:
          'The in-memory adpCache has a 5-minute TTL. After a successful upload the route calls clearADPCache(), which resets adpCache = null on that serverless instance. However, other warm instances will still serve stale cache for up to 5 minutes. To force immediate propagation:',
        code: `// clearADPCache() resets module-level state
// lib/adp-data.ts
export function clearADPCache(): void {
  adpCache = null;
  lastFetched = 0;
}

// The upload route calls this automatically on success:
// app/api/adp/upload/route.ts → clearADPCache()

// To manually trigger a fresh DB read on the next request,
// re-deploy the project (resets all serverless instances)
// or wait for the 5-min TTL to expire.`,
        note: 'Multi-instance cache inconsistency is expected and self-heals within 5 minutes. It is not a bug.',
      },
    ],
  },
  {
    id: 'solutions',
    icon: Wrench,
    title: 'Solutions',
    subtitle: 'Actionable fixes for each root cause',
    accent: 'emerald',
    steps: [
      {
        label: 'Fix A — Perform the initial ADP upload',
        detail:
          'This is the fix for the most common cause (no upload has ever been performed). The upload is shared — one admin uploads once and all users benefit.',
        code: `1. Go to app Settings panel → "ADP Data" section
2. Under "MLB · ADP Data", click the upload card
3. Download the TSV from: https://nfc.shgn.com/adp/baseball
   (click the blue "Download" button on that page)
4. Drag the .tsv file into the upload area or click to select it
5. Wait for "N players imported" confirmation
6. Ask any ADP question — the fallback log should no longer appear`,
        note: 'The upload route validates the file and rejects obviously malformed data before writing to Supabase. Check the UI error message if it fails.',
      },
      {
        label: 'Fix B — Add or correct environment variables',
        detail:
          'If Supabase env vars are missing the entire persistence layer is bypassed silently.',
        code: `# In Vercel Project → Settings → Environment Variables, add:
NEXT_PUBLIC_SUPABASE_URL      = https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY     = eyJhbGc...  (from Supabase → Project Settings → API)

# After adding, redeploy:
# Vercel dashboard → Deployments → Redeploy latest build`,
        note: 'The service role key bypasses RLS and is required for write operations. Never expose it to the client.',
      },
      {
        label: 'Fix C — Run the database migration',
        detail:
          'If the nfbc_adp table does not exist, trigger the admin migration endpoint:',
        code: `# The migration is protected by the SUPABASE_SERVICE_ROLE_KEY
curl -X POST https://<your-domain>/api/admin/migrate \\
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"

# Then verify the table was created:
# Run diagnostic Step 3 queries in the Supabase SQL editor`,
        note: 'This creates all tables including api.nfbc_adp, api.app_settings, and others. It is idempotent (uses CREATE TABLE IF NOT EXISTS).',
      },
      {
        label: 'Fix D — Re-apply RLS policies',
        detail:
          'If the nfbc_adp_read policy is missing, apply it directly via the Supabase SQL editor:',
        code: `ALTER TABLE api.nfbc_adp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nfbc_adp_read" ON api.nfbc_adp;
CREATE POLICY "nfbc_adp_read"
  ON api.nfbc_adp FOR SELECT USING (true);

DROP POLICY IF EXISTS "nfbc_adp_service_write" ON api.nfbc_adp;
CREATE POLICY "nfbc_adp_service_write"
  ON api.nfbc_adp FOR ALL TO service_role
  USING (true) WITH CHECK (true);`,
      },
      {
        label: 'Fix E — Re-upload after a malformed file rejection',
        detail:
          'If the upload succeeded (HTTP 200) but data was later auto-purged due to numeric display names, the table is now empty again. Re-download a fresh TSV and re-upload.',
        code: `# Signs of auto-purge in logs:
[ADP] Supabase data has N/M numeric display names — upload malformed, purging from DB and falling back to static

# Recovery:
1. Download a fresh TSV from https://nfc.shgn.com/adp/baseball
2. Open the file and verify column A header is "Rank" and column B header is "Player"
3. Spot-check row 2: should be "1  Witt, Bobby Jr.  ..." not "1  10231  ..."
4. Re-upload via the Settings ADP upload card`,
      },
      {
        label: 'Fix F — Move table to correct schema if misplaced',
        detail:
          'If nfbc_adp was accidentally created in the "public" schema, migrate it:',
        code: `-- Option 1: Move the table (preserves data)
ALTER TABLE public.nfbc_adp SET SCHEMA api;

-- Option 2: Drop and recreate in api schema (loses data, needs re-upload)
DROP TABLE IF EXISTS public.nfbc_adp;
-- Then run the migration endpoint (Fix C above)`,
        note: 'The Supabase client is hardcoded to db: { schema: "api" }. Tables in the "public" schema will not be found.',
      },
    ],
  },
  {
    id: 'validation',
    icon: CheckCircle,
    title: 'Validating correct system behavior',
    subtitle: 'How to confirm the fix worked end-to-end',
    accent: 'teal',
    steps: [
      {
        label: 'Validation 1 — Confirm the healthy log line replaces the fallback log',
        detail:
          'After a successful upload, the next getADPData() call should emit this log instead:',
        code: `# Success log (replaces the fallback log)
[ADP] Serving N MLB players from Supabase (user upload)

# Where N should match the count returned by the upload endpoint
# and the number of players in the TSV file.`,
      },
      {
        label: 'Validation 2 — Verify via Supabase SQL',
        detail:
          'Run the row count query from Step 3 of the diagnostics section. Confirm row_count matches the upload count and last_upload is recent (within the last few minutes).',
        code: `SELECT sport, COUNT(*) AS row_count, MAX(fetched_at) AS last_upload
FROM api.nfbc_adp
WHERE sport = 'mlb'
GROUP BY sport;

-- Expected result after a successful 300-player upload:
-- sport | row_count | last_upload
-- mlb   | 300       | 2026-03-17 14:32:00+00`,
      },
      {
        label: 'Validation 3 — Test the ADP query via the AI',
        detail:
          'Send an ADP question in the chat. The response should NOT include the warning about static fallback data. It should reference live NFBC ranks.',
        code: `# Test prompt:
"What is Aaron Judge's current ADP?"

# If static fallback is active, the AI prepends:
"⚠️ No live ADP data uploaded yet. The rankings below are 2026 pre-season..."

# If live data is serving correctly, the AI responds with
# the rank/ADP from the uploaded TSV without any warning.`,
      },
      {
        label: 'Validation 4 — Confirm the fallback mechanism still works when intentionally triggered',
        detail:
          'To verify the fallback is correctly activated when Supabase data is absent (e.g. after purging), you can temporarily clear the table and confirm the 120-player static set is returned without errors.',
        code: `-- Temporarily clear (restore with a re-upload immediately after)
DELETE FROM api.nfbc_adp WHERE sport = 'mlb';

-- Trigger a request — should see in logs:
[ADP] No MLB ADP upload found — serving static fallback (120 players)

-- Confirm 120 players are returned (not 0, not an error)
-- Then immediately re-upload the TSV to restore live data.`,
        note: 'The fallback is a safety net, not a bug. The system should never return 0 players or throw an exception — the 120-player static set must always be the floor.',
      },
    ],
  },
  {
    id: 'prevention',
    icon: Settings,
    title: 'Prevention & monitoring',
    subtitle: 'Operational practices to avoid missing ADP data',
    accent: 'orange',
    steps: [
      {
        label: 'Scheduled annual ADP refresh',
        detail:
          'NFBC ADP is meaningful only during draft season (Feb–Apr for MLB, Jul–Sep for NFL). The static fallback in lib/adp-data.ts must be updated annually. Update the STATIC_FALLBACK_PLAYERS array with the current pre-season consensus before each draft season starts.',
        note: 'Search for the comment "Update annually before each MLB draft season" in lib/adp-data.ts to find the update point.',
      },
      {
        label: 'Add a Vercel log alert for the fallback message',
        detail:
          'Configure a Vercel Log Drain or a monitoring service (Datadog, Sentry, etc.) to alert on the string "[ADP] No MLB ADP upload found" appearing more than N times per hour in production. This distinguishes cold-start cache misses (expected, 1 per serverless instance boot) from a persistent misconfiguration.',
        code: `# Alert pattern
"[ADP] No MLB ADP upload found"

# Alert threshold suggestion:
# > 5 occurrences within a 5-minute window → investigate`,
      },
      {
        label: 'Distinguish static fallback from live data in the UI',
        detail:
          'The AI prompt in lib/constants.ts already instructs the model to prepend a warning when is_static_fallback: true is returned by the ADP tool. Ensure this flag is always propagated correctly from getADPData() through the card generator to the AI tool result.',
        code: `// lib/constants.ts — AI instruction excerpt
// "If the tool result contains \`is_static_fallback: true\`, no NFBC/NFFC TSV
//  has been uploaded yet. You MUST begin your response with: '⚠️ No live ADP
//  data uploaded yet...'"`,
      },
      {
        label: 'Keep the Supabase service role key rotated and secured',
        detail:
          'The SUPABASE_SERVICE_ROLE_KEY is used by the upload route to bypass RLS. If the key is rotated in Supabase, update the Vercel env var immediately and redeploy — otherwise uploads will start failing silently and the fallback will activate.',
        note: 'The key rotation shows up in logs as: [ADP] Supabase delete failed (non-critical): JWT expired (or similar auth error).',
      },
    ],
  },
];

// ── Accent color map ─────────────────────────────────────────────────────────

const ACCENT: Record<string, { bg: string; border: string; text: string; badge: string; dot: string }> = {
  blue:   { bg: 'bg-blue-500/5',    border: 'border-blue-500/20',   text: 'text-blue-400',   badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20',   dot: 'bg-blue-400'   },
  amber:  { bg: 'bg-amber-500/5',   border: 'border-amber-500/20',  text: 'text-amber-400',  badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',  dot: 'bg-amber-400'  },
  violet: { bg: 'bg-violet-500/5',  border: 'border-violet-500/20', text: 'text-violet-400', badge: 'bg-violet-500/10 text-violet-300 border-violet-500/20', dot: 'bg-violet-400' },
  emerald:{ bg: 'bg-emerald-500/5', border: 'border-emerald-500/20',text: 'text-emerald-400',badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',dot: 'bg-emerald-400'},
  teal:   { bg: 'bg-teal-500/5',    border: 'border-teal-500/20',   text: 'text-teal-400',   badge: 'bg-teal-500/10 text-teal-300 border-teal-500/20',   dot: 'bg-teal-400'   },
  orange: { bg: 'bg-orange-500/5',  border: 'border-orange-500/20', text: 'text-orange-400', badge: 'bg-orange-500/10 text-orange-300 border-orange-500/20', dot: 'bg-orange-400' },
};

// ── Sub-components ───────────────────────────────────────────────────────────

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative mt-3 rounded-lg bg-black/40 border border-white/5 overflow-hidden">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors font-mono"
        aria-label="Copy code"
      >
        {copied ? 'copied' : 'copy'}
      </button>
      <pre className="p-4 pr-14 text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed whitespace-pre-wrap break-words">
        {code}
      </pre>
    </div>
  );
}

function SectionCard({ section }: { section: Section }) {
  const [expanded, setExpanded] = useState(true);
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});
  const ac = ACCENT[section.accent];
  const Icon = section.icon;

  function toggleStep(i: number) {
    setOpenSteps(prev => ({ ...prev, [i]: !prev[i] }));
  }

  return (
    <section
      id={section.id}
      className={`rounded-2xl border ${ac.border} ${ac.bg} overflow-hidden`}
      aria-labelledby={`section-${section.id}`}
    >
      {/* Section header */}
      <button
        className="w-full flex items-center gap-4 p-5 text-left"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${ac.border} ${ac.bg}`}>
          <Icon className={`h-4 w-4 ${ac.text}`} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2
            id={`section-${section.id}`}
            className="text-sm font-bold text-white leading-tight"
          >
            {section.title}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">{section.subtitle}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${ac.badge}`}>
          {section.steps.length} item{section.steps.length !== 1 ? 's' : ''}
        </span>
        {expanded
          ? <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" aria-hidden="true" />
          : <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" aria-hidden="true" />
        }
      </button>

      {/* Steps */}
      {expanded && (
        <div className="px-5 pb-5 space-y-2">
          {section.steps.map((step, i) => {
            const open = openSteps[i] ?? true;
            return (
              <div
                key={i}
                className="rounded-xl border border-white/5 bg-black/20 overflow-hidden"
              >
                <button
                  className="w-full flex items-center gap-3 p-4 text-left"
                  onClick={() => toggleStep(i)}
                  aria-expanded={open}
                >
                  <span className={`h-5 w-5 shrink-0 flex items-center justify-center rounded-full ${ac.bg} border ${ac.border}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${ac.dot}`} aria-hidden="true" />
                  </span>
                  <span className="flex-1 text-xs font-semibold text-gray-200 text-balance">
                    {step.label}
                  </span>
                  {open
                    ? <ChevronDown className="h-3.5 w-3.5 text-gray-600 shrink-0" aria-hidden="true" />
                    : <ChevronRight className="h-3.5 w-3.5 text-gray-600 shrink-0" aria-hidden="true" />
                  }
                </button>

                {open && (
                  <div className="px-4 pb-4 space-y-2">
                    <p className="text-xs text-gray-400 leading-relaxed">{step.detail}</p>
                    {step.code && <CodeBlock code={step.code} />}
                    {step.note && (
                      <div className="flex items-start gap-2 mt-2 rounded-lg bg-white/3 border border-white/5 p-3">
                        <HelpCircle className="h-3.5 w-3.5 text-gray-500 mt-0.5 shrink-0" aria-hidden="true" />
                        <p className="text-[11px] text-gray-500 leading-relaxed">{step.note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ADPTroubleshootPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Back</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">
                ADP Fallback Troubleshooting Guide
              </h1>
              <p className="text-[10px] text-muted-foreground">
                <code className="font-mono">[ADP] No MLB ADP upload found — serving static fallback (120 players)</code>
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 font-mono font-bold uppercase tracking-wider">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Ops Runbook
            </span>
          </div>
        </div>
      </header>

      {/* Quick-nav TOC */}
      <div className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-3xl px-6 py-3">
          <nav aria-label="Table of contents" className="flex flex-wrap gap-2">
            {SECTIONS.map(s => {
              const ac = ACCENT[s.accent];
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded border transition-colors ${ac.badge} hover:opacity-80`}
                >
                  {s.title.split(' ').slice(0, 3).join(' ')}
                </a>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Body */}
      <main className="mx-auto max-w-3xl px-6 py-8 space-y-5">

        {/* Summary banner */}
        <div className="flex items-start gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-300">Quick summary</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              This log fires when <code className="font-mono text-gray-300 bg-white/5 px-1 rounded">getADPData()</code> cannot find any MLB rows in the Supabase{' '}
              <code className="font-mono text-gray-300 bg-white/5 px-1 rounded">api.nfbc_adp</code> table and falls back to a 120-player
              hardcoded pre-season dataset. The most common cause is that no admin has uploaded a TSV yet. The second most
              common cause is missing Supabase environment variables. Work through the{' '}
              <a href="#causes" className="text-amber-400 underline underline-offset-2 hover:text-amber-300">root cause checklist</a>{' '}
              in order, then follow the matching fix in the{' '}
              <a href="#solutions" className="text-amber-400 underline underline-offset-2 hover:text-amber-300">solutions section</a>.
            </p>
          </div>
        </div>

        {/* Data flow diagram */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">ADP data flow</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {[
              {
                step: '1',
                label: 'Upload (admin once)',
                detail: 'Admin downloads TSV from nfc.shgn.com/adp/baseball and POSTs to /api/adp/upload',
                icon: Upload,
                color: 'text-blue-400',
                bg: 'bg-blue-500/5 border-blue-500/20',
              },
              {
                step: '2',
                label: 'Persist (Supabase)',
                detail: 'saveADPToSupabase() deletes old rows for sport=mlb and inserts new rows in batches of 50',
                icon: Database,
                color: 'text-violet-400',
                bg: 'bg-violet-500/5 border-violet-500/20',
              },
              {
                step: '3',
                label: 'Serve (all requests)',
                detail: 'loadADPFromSupabase() reads rows; in-memory cache (5-min TTL) prevents re-querying on every hit',
                icon: FileText,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/5 border-emerald-500/20',
              },
            ].map(item => {
              const ItemIcon = item.icon;
              return (
                <div key={item.step} className={`rounded-xl border ${item.bg} p-3 space-y-2`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-5 w-5 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-[10px] font-bold ${item.color}`}>
                      {item.step}
                    </span>
                    <ItemIcon className={`h-3.5 w-3.5 ${item.color}`} aria-hidden="true" />
                    <span className={`text-[11px] font-bold ${item.color}`}>{item.label}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{item.detail}</p>
                </div>
              );
            })}
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-red-500/5 border border-red-500/15 p-3">
            <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[10px] text-gray-500">
              <span className="text-red-300 font-semibold">Fallback activates</span> when step 2 never happened (empty table),
              or when the Supabase client returns null (missing env vars), or when uploaded data was auto-purged due to malformed player names.
            </p>
          </div>
        </div>

        {/* All sections */}
        {SECTIONS.map(section => (
          <SectionCard key={section.id} section={section} />
        ))}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border text-xs text-muted-foreground">
          <span>
            Source files:{' '}
            <code className="font-mono bg-secondary px-1.5 py-0.5 rounded">lib/adp-data.ts</code>{' '}
            <code className="font-mono bg-secondary px-1.5 py-0.5 rounded">app/api/adp/upload/route.ts</code>{' '}
            <code className="font-mono bg-secondary px-1.5 py-0.5 rounded">lib/supabase/adp-client.server.ts</code>
          </span>
          <Link href="/api-health" className="hover:text-foreground transition-colors">
            API Health →
          </Link>
        </div>
      </main>
    </div>
  );
}
