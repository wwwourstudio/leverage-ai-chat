/**
 * Injury Impact Analyzer
 * Analyzes how injuries and trades affect player props across all major leagues
 */

export interface InjuryReport {
  playerId: string;
  playerName: string;
  team: string;
  league: 'NBA' | 'NHL' | 'MLB' | 'NFL';
  injuryType: string;
  status: 'Out' | 'Questionable' | 'Doubtful' | 'Day-to-Day' | 'Probable';
  estimatedReturn?: string;
  impactLevel: 'High' | 'Medium' | 'Low';
  affectedProps: string[];
  reportedDate: string;
}

export interface TradeImpact {
  playerId: string;
  playerName: string;
  fromTeam: string;
  toTeam: string;
  league: 'NBA' | 'NHL' | 'MLB' | 'NFL';
  tradeDate: string;
  expectedImpact: 'Positive' | 'Negative' | 'Neutral';
  reasoning: string;
  propAdjustments: {
    propType: string;
    oldValue: number;
    newValue: number;
    confidence: number;
  }[];
}

export interface PropAdjustment {
  propType: string;
  originalLine: number;
  adjustedLine: number;
  adjustmentReason: string;
  confidence: number;
}

/**
 * Analyze injury impact on player props
 */
export function analyzeInjuryImpact(
  injury: InjuryReport,
  currentProps: { type: string; line: number }[]
): PropAdjustment[] {
  const adjustments: PropAdjustment[] = [];

  // Status-based adjustment factors
  const statusAdjustment = {
    'Out': 1.0, // 100% impact - player not available
    'Doubtful': 0.75, // 75% impact - likely won't play or very limited
    'Questionable': 0.50, // 50% impact - uncertain availability
    'Day-to-Day': 0.25, // 25% impact - minor issue
    'Probable': 0.10  // 10% impact - expected to play
  };

  const impactFactor = statusAdjustment[injury.status];

  currentProps.forEach(prop => {
    let adjustment = 0;
    let reason = '';

    // League-specific prop adjustments
    switch (injury.league) {
      case 'NBA':
        adjustment = calculateNBAInjuryAdjustment(prop, injury, impactFactor);
        reason = `${injury.status} - ${injury.injuryType} affects ${prop.type}`;
        break;
      
      case 'NHL':
        adjustment = calculateNHLInjuryAdjustment(prop, injury, impactFactor);
        reason = `${injury.status} - ${injury.injuryType} affects ${prop.type}`;
        break;
      
      case 'MLB':
        adjustment = calculateMLBInjuryAdjustment(prop, injury, impactFactor);
        reason = `${injury.status} - ${injury.injuryType} affects ${prop.type}`;
        break;
      
      case 'NFL':
        adjustment = calculateNFLInjuryAdjustment(prop, injury, impactFactor);
        reason = `${injury.status} - ${injury.injuryType} affects ${prop.type}`;
        break;
    }

    if (adjustment !== 0) {
      adjustments.push({
        propType: prop.type,
        originalLine: prop.line,
        adjustedLine: prop.line + adjustment,
        adjustmentReason: reason,
        confidence: 1 - impactFactor
      });
    }
  });

  return adjustments;
}

/**
 * NBA injury adjustments
 */
function calculateNBAInjuryAdjustment(
  prop: { type: string; line: number },
  injury: InjuryReport,
  impactFactor: number
): number {
  const propType = prop.type.toLowerCase();
  
  if (propType.includes('points')) {
    return -prop.line * impactFactor * 0.3; // Points reduced by up to 30%
  }
  if (propType.includes('assists')) {
    return -prop.line * impactFactor * 0.25;
  }
  if (propType.includes('rebounds')) {
    return -prop.line * impactFactor * 0.20;
  }
  if (propType.includes('minutes')) {
    return -prop.line * impactFactor * 0.40; // Minutes most affected
  }
  
  return -prop.line * impactFactor * 0.15; // General reduction
}

/**
 * NHL injury adjustments
 */
function calculateNHLInjuryAdjustment(
  prop: { type: string; line: number },
  injury: InjuryReport,
  impactFactor: number
): number {
  const propType = prop.type.toLowerCase();
  
  if (propType.includes('goals')) {
    return -prop.line * impactFactor * 0.35;
  }
  if (propType.includes('assists')) {
    return -prop.line * impactFactor * 0.30;
  }
  if (propType.includes('shots')) {
    return -prop.line * impactFactor * 0.25;
  }
  if (propType.includes('toi') || propType.includes('ice time')) {
    return -prop.line * impactFactor * 0.45;
  }
  
  return -prop.line * impactFactor * 0.20;
}

/**
 * MLB injury adjustments
 */
function calculateMLBInjuryAdjustment(
  prop: { type: string; line: number },
  injury: InjuryReport,
  impactFactor: number
): number {
  const propType = prop.type.toLowerCase();
  
  if (propType.includes('hits')) {
    return -prop.line * impactFactor * 0.30;
  }
  if (propType.includes('strikeouts') && injury.injuryType.includes('arm')) {
    return -prop.line * impactFactor * 0.40; // Arm injuries critical for pitchers
  }
  if (propType.includes('runs') || propType.includes('rbi')) {
    return -prop.line * impactFactor * 0.25;
  }
  
  return -prop.line * impactFactor * 0.20;
}

/**
 * NFL injury adjustments
 */
function calculateNFLInjuryAdjustment(
  prop: { type: string; line: number },
  injury: InjuryReport,
  impactFactor: number
): number {
  const propType = prop.type.toLowerCase();
  
  if (propType.includes('passing yards')) {
    return -prop.line * impactFactor * 0.35;
  }
  if (propType.includes('rushing yards')) {
    return -prop.line * impactFactor * 0.40;
  }
  if (propType.includes('receiving yards')) {
    return -prop.line * impactFactor * 0.35;
  }
  if (propType.includes('touchdowns')) {
    return -prop.line * impactFactor * 0.30;
  }
  
  return -prop.line * impactFactor * 0.25;
}

/**
 * Analyze trade impact on player props
 */
export function analyzeTradeImpact(
  trade: TradeImpact,
  currentProps: { type: string; line: number }[]
): PropAdjustment[] {
  const adjustments: PropAdjustment[] = [];

  trade.propAdjustments.forEach(adjustment => {
    const matchingProp = currentProps.find(p => 
      p.type.toLowerCase().includes(adjustment.propType.toLowerCase())
    );

    if (matchingProp) {
      const delta = adjustment.newValue - adjustment.oldValue;
      adjustments.push({
        propType: matchingProp.type,
        originalLine: matchingProp.line,
        adjustedLine: matchingProp.line + delta,
        adjustmentReason: `Trade to ${trade.toTeam}: ${trade.reasoning}`,
        confidence: adjustment.confidence
      });
    }
  });

  return adjustments;
}

/**
 * Get injury report summary for a league
 */
export function getLeagueInjuryReport(league: 'NBA' | 'NHL' | 'MLB' | 'NFL'): string {
  const messages = {
    'NBA': 'Injury reports updated daily at 5:30 PM ET. Check team injury reports 1 hour before game time.',
    'NHL': 'Injury reports typically released morning of game day. Monitor line combinations at morning skate.',
    'MLB': 'Injury reports updated throughout day. Check starting lineups 10 minutes before first pitch.',
    'NFL': 'Official injury reports: Wednesday (practice report), Friday (game status). Monitor inactive lists 90 minutes before kickoff.'
  };

  return messages[league];
}

/**
 * Calculate overall prop confidence with injury/trade adjustments
 */
export function calculateAdjustedConfidence(
  baseConfidence: number,
  adjustments: PropAdjustment[]
): number {
  if (adjustments.length === 0) return baseConfidence;

  // Average confidence from all adjustments
  const avgAdjustmentConfidence = 
    adjustments.reduce((sum, adj) => sum + adj.confidence, 0) / adjustments.length;

  // Reduce base confidence by severity of adjustments
  const severityFactor = Math.abs(
    adjustments.reduce((sum, adj) => 
      sum + (adj.adjustedLine - adj.originalLine) / adj.originalLine, 0
    ) / adjustments.length
  );

  return baseConfidence * (1 - severityFactor * 0.3) * avgAdjustmentConfidence;
}
