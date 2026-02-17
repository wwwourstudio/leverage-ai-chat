import { createClient } from '@/lib/supabase/client';

export interface DynamicCard {
  type: string;
  title: string;
  category: string;
  subcategory: string;
  gradient: string;
  data: Record<string, any>;
  status: string;
}

export interface UserInsights {
  totalValue: number;
  winRate: number;
  roi: number;
  activeContests: number;
  totalInvested: number;
  dataSource: string;
  message?: string;
}

export async function fetchDynamicCards(params: {
  sport?: string;
  category?: string;
  userContext?: any;
  limit?: number;
}): Promise<DynamicCard[]> {
  console.log('[DataService] Cards API not implemented, returning empty array');
  return [];
}

export async function fetchUserInsights(): Promise<UserInsights> {
  console.log('[DataService] Insights API not implemented, returning defaults');
  return {
    totalValue: 0,
    winRate: 0,
    roi: 0,
    activeContests: 0,
    totalInvested: 0,
    dataSource: 'default'
  };
}

export async function fetchOddsFromDB(
  sport: string,
  options: { limit?: number; from?: Date; to?: Date; team?: string } = {}
): Promise<any[]> {
  try {
    const supabase = createClient();
    const tableName = `${sport}_odds`;
    
    let query = supabase.from(tableName).select('*');
    
    if (options.limit) query = query.limit(options.limit);
    if (options.from) query = query.gte('commence_time', options.from.toISOString());
    if (options.to) query = query.lte('commence_time', options.to.toISOString());
    if (options.team) {
      query = query.or(`home_team.eq.${options.team},away_team.eq.${options.team}`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[DataService] DB fetch error:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('[DataService] Fetch error:', error);
    return [];
  }
}
