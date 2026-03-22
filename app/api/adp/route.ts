import { loadADP } from '@/lib/adp';

export const dynamic = 'force-static';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const position = searchParams.get('position')?.toUpperCase();
  const limit = parseInt(searchParams.get('limit') ?? '300');

  const players = loadADP();

  const filtered = position
    ? players.filter(p => p.position === position)
    : players;

  return Response.json({
    players: filtered.slice(0, limit),
    count: filtered.length,
    source: 'local_csv',
  });
}
