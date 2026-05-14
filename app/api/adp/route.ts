import { getADPData } from '@/lib/adp-data';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const position = searchParams.get('position')?.toUpperCase();
  const limit = parseInt(searchParams.get('limit') ?? '300');

  const players = await getADPData();

  const filtered = position
    ? players.filter(p => p.positions?.includes(position))
    : players;

  return Response.json({
    players: filtered.slice(0, limit),
    count: filtered.length,
    source: 'local_csv',
  });
}
