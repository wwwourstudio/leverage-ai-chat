'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LeagueCreator, type LeagueFormData } from '@/components/fantasy/league-setup/LeagueCreator';

export default function NewLeaguePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (form: LeagueFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/fantasy/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          sport: form.sport,
          platform: form.platform,
          leagueSize: form.leagueSize,
          leagueType: form.leagueType,
          scoringType: form.scoringType,
          scoringSettings: form.scoringSettings,
          rosterSlots: form.rosterSlots,
          draftType: form.draftType,
          faabBudget: form.faabBudget,
          teams: form.teams,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/fantasy/leagues/${data.league.id}/draft`);
      } else {
        setError(data.error || 'Failed to create league');
      }
    } catch (err) {
      setError('Failed to create league. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-6">
          <Link href="/fantasy/leagues" className="text-sm text-muted-foreground hover:text-foreground">
            ← My Leagues
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-6">Create League</h1>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <LeagueCreator onCreateLeague={handleCreate} isLoading={isLoading} />
      </div>
    </div>
  );
}
