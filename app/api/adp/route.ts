/**
 * GET /api/adp
 *
 * Reads the local ADP CSV file and returns the parsed player list as JSON.
 * Tries the following paths in order:
 *   1. public/adp/ADP.csv
 *   2. public/adp - ADP.csv   (space-in-filename variant)
 *
 * This endpoint is used by client-side components that need ADP data without
 * going through the full getADPData() server function. It does NOT hit Supabase
 * or any external API — CSV only.
 */
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parseTSV } from '@/lib/adp-data';

export const runtime = 'nodejs';

const CSV_CANDIDATES = [
  path.join(process.cwd(), 'public', 'adp', 'ADP.csv'),
  path.join(process.cwd(), 'public', 'adp - ADP.csv'),
];

export async function GET() {
  for (const csvPath of CSV_CANDIDATES) {
    let text: string;
    try {
      text = fs.readFileSync(csvPath, 'utf-8');
    } catch {
      continue; // file not found — try next candidate
    }

    if (!text.trim()) continue;

    const players = parseTSV(text);
    if (players.length === 0) {
      console.warn(`[v0] [ADP] GET /api/adp: ${path.basename(csvPath)} parsed to 0 players — check column headers`);
      continue;
    }

    console.log(`[v0] [ADP] GET /api/adp: serving ${players.length} players from ${path.basename(csvPath)}`);
    return NextResponse.json({
      success: true,
      count: players.length,
      source: path.basename(csvPath),
      players,
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: 'ADP CSV not found. Place your file at public/adp/ADP.csv or public/adp - ADP.csv',
      tried: CSV_CANDIDATES,
    },
    { status: 404 },
  );
}
