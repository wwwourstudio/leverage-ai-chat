/**
 * Server Component Wrapper for Main Chat Interface
 * 
 * Fetches initial data server-side for better performance and SEO.
 * Passes pre-fetched data to client component for hydration.
 * 
 * @module app/page-wrapper
 */

import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { validateServerEnv, logEnvValidation, getMissingAPIKeys } from '@/lib/env-validator';
import UnifiedAIPlatform from './page-client';

export interface ServerDataProps {
  initialCards?: any[];
  initialInsights?: any;
  userSession?: any;
  serverTime: string;
  missingKeys?: string[];
  envErrors?: string[];
}

async function fetchInitialServerData(): Promise<ServerDataProps> {
  console.log('[v0] Server: Fetching initial data for page load...');
  
  // Validate environment variables first
  const envValidation = validateServerEnv();
  logEnvValidation(envValidation, 'server');
  
  const missingKeys = getMissingAPIKeys();
  if (missingKeys.length > 0) {
    console.warn('[v0] Server: Missing API keys:', missingKeys.join(', '));
  }
  
  try {
    // Fetch initial cards from server-side API
    const cardsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/cards?category=all&limit=12`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    let initialCards = [];
    if (cardsResponse.ok) {
      const cardsData = await cardsResponse.json();
      initialCards = cardsData.cards || [];
      console.log('[v0] Server: Pre-fetched', initialCards.length, 'cards');
    }

    // Get user session server-side
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log('[v0] Server: User session:', session ? 'authenticated' : 'anonymous');

    return {
      initialCards,
      userSession: session ? {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
        }
      } : null,
      serverTime: new Date().toISOString(),
      missingKeys,
      envErrors: envValidation.errors,
    };
  } catch (error) {
    console.error('[v0] Server: Error fetching initial data:', error);
    return {
      initialCards: [],
      userSession: null,
      serverTime: new Date().toISOString(),
      missingKeys,
      envErrors: envValidation.errors,
    };
  }
}

export default async function Page() {
  const serverData = await fetchInitialServerData();

  return (
    <Suspense fallback={<PageSkeleton />}>
      <UnifiedAIPlatform serverData={serverData} />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex h-screen bg-gray-950 text-white animate-pulse">
      <div className="flex-1 flex flex-col">
        <div className="h-16 bg-gray-900/50 border-b border-gray-800/50" />
        <div className="flex-1 p-6 space-y-4">
          <div className="h-20 bg-gray-900/30 rounded-lg" />
          <div className="h-20 bg-gray-900/30 rounded-lg" />
          <div className="h-20 bg-gray-900/30 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
