import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchDKContests, fetchDKDraftables, getMainSlate } from '@/lib/mlb-projections/draftkings-api';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOnce(payload: unknown, status = 200) {
  vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () =>
    new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
  );
}

const todayIso = new Date().toISOString().slice(0, 10);
const eveningStart = new Date(`${todayIso}T23:05:00Z`).toISOString();   // ~7pm ET
const afternoonStart = new Date(`${todayIso}T18:05:00Z`).toISOString(); // ~2pm ET

describe('fetchDKContests', () => {
  it('parses .NET-style and ISO start dates and tags slates as classic vs showdown', async () => {
    mockFetchOnce({
      DraftGroups: [
        {
          DraftGroupId: 1001,
          ContestTypeId: 21,
          StartDate: eveningStart,
          GameCount: 11,
          DraftGroupTag: 'Main',
          Games: [{ GameId: 1, AwayTeamCity: 'MIA', HomeTeamCity: 'ATL', StartDate: eveningStart }],
        },
        {
          DraftGroupId: 1002,
          ContestTypeId: 96, // showdown
          StartDate: `/Date(${Date.parse(eveningStart)})/`,
          GameCount: 1,
          Games: [],
        },
      ],
    });

    const res = await fetchDKContests();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toHaveLength(2);
    expect(res.value[0]).toMatchObject({ draftGroupId: 1001, contestType: 'classic', slateLabel: 'Main' });
    expect(res.value[1].contestType).toBe('showdown');
    // Both startDates resolved to ISO strings
    expect(res.value[0].startDate).toBe(eveningStart);
    expect(res.value[1].startDate).toBe(eveningStart);
  });

  it('returns Err on non-2xx', async () => {
    mockFetchOnce({}, 503);
    const res = await fetchDKContests();
    expect(res.ok).toBe(false);
  });
});

describe('fetchDKDraftables', () => {
  it('dedupes a player listed across multiple roster slots and pulls projection / status', async () => {
    mockFetchOnce({
      draftables: [
        {
          draftableId: 50001,
          playerId: 7001,
          firstName: 'Sandy',
          lastName: 'Alcantara',
          displayName: 'Sandy Alcantara',
          position: 'SP',
          rosterSlotId: 65,
          salary: 9800,
          status: 'None',
          teamAbbreviation: 'MIA',
          teamId: 12,
          competition: { name: 'MIA @ ATL', startTime: eveningStart },
          draftStatAttributes: [{ id: 90, value: '21.5', sortValue: '21.5' }],
          playerGameAttributes: [{ id: 1, value: 'true' }],
        },
        {
          // duplicate slot — should be dropped
          draftableId: 50002,
          playerId: 7001,
          firstName: 'Sandy', lastName: 'Alcantara', displayName: 'Sandy Alcantara',
          position: 'SP', salary: 9800, teamAbbreviation: 'MIA', teamId: 12,
        },
        {
          draftableId: 50003,
          playerId: 7002,
          firstName: 'Mike', lastName: 'Trout', displayName: 'Mike Trout',
          position: 'OF', salary: 5300, status: 'OUT', teamAbbreviation: 'LAA', teamId: 1,
          draftStatAttributes: [{ id: 90, sortValue: '8.2' }],
        },
      ],
    });

    const res = await fetchDKDraftables(1001);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toHaveLength(2);
    const sandy = res.value.find(p => p.playerId === 7001)!;
    expect(sandy.salary).toBe(9800);
    expect(sandy.projectedFpts).toBe(21.5);
    expect(sandy.isStartingLineup).toBe(true);
    expect(sandy.status).toBe('Available');
    const trout = res.value.find(p => p.playerId === 7002)!;
    expect(trout.status).toBe('OUT');
    expect(trout.isStartingLineup).toBe(false);
  });
});

describe('getMainSlate', () => {
  it('picks the largest classic evening slate (≥ 20:00 UTC)', async () => {
    mockFetchOnce({
      DraftGroups: [
        { DraftGroupId: 1, ContestTypeId: 21, StartDate: afternoonStart, GameCount: 4, Games: [] },
        { DraftGroupId: 2, ContestTypeId: 21, StartDate: eveningStart,   GameCount: 11, Games: [] },
        { DraftGroupId: 3, ContestTypeId: 21, StartDate: eveningStart,   GameCount: 9,  Games: [] },
        { DraftGroupId: 4, ContestTypeId: 96, StartDate: eveningStart,   GameCount: 1,  Games: [] }, // showdown
      ],
    });

    const res = await getMainSlate();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.draftGroupId).toBe(2);
    expect(res.value.contestType).toBe('classic');
  });

  it('falls back to the largest classic slate of the day when no evening slate exists', async () => {
    mockFetchOnce({
      DraftGroups: [
        { DraftGroupId: 10, ContestTypeId: 21, StartDate: afternoonStart, GameCount: 6, Games: [] },
        { DraftGroupId: 11, ContestTypeId: 21, StartDate: afternoonStart, GameCount: 3, Games: [] },
      ],
    });
    const res = await getMainSlate();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.draftGroupId).toBe(10);
  });

  it('returns Err when no classic slates exist for the requested date', async () => {
    mockFetchOnce({ DraftGroups: [] });
    const res = await getMainSlate();
    expect(res.ok).toBe(false);
  });
});
