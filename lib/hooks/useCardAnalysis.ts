'use client';

import { useState, useCallback } from 'react';
import type { InsightCard } from '@/components/InsightCard';

interface CardAnalysisResponse {
  success: boolean;
  error?: string;
  text?: string;
  type?: string;
}

export function useCardAnalysis() {
  const [verifyStage, setVerifyStage] = useState<'analyzing' | 'reverifying'>('analyzing');
  const [cardAnalysisMap, setCardAnalysisMap] = useState<Record<string, { loading: boolean; content: string | null; error: string | null }>>({});

  const generateCardAnalysis = useCallback(async (card: InsightCard, cardKey: string) => {
    if (cardAnalysisMap[cardKey]?.content || cardAnalysisMap[cardKey]?.error) {
      setCardAnalysisMap((prev) => { const n = { ...prev }; delete n[cardKey]; return n; });
      return;
    }

    setCardAnalysisMap((prev) => ({ ...prev, [cardKey]: { loading: true, content: null, error: null } }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = card.data as any;
    const cardType = (card.type ?? '').toLowerCase();

    let prompt = '';
    if (cardType === 'kalshi' || cardType === 'prediction') {
      const yesPct = d.yesPct ?? 50;
      const noPct  = d.noPct  ?? (100 - yesPct);
      prompt = `Analyze this Kalshi prediction market contract. Be concise and actionable.

Market: "${card.title}"
Category: ${card.subcategory || card.category}
YES price: ${yesPct}¢ (${yesPct}% implied probability)
NO price: ${noPct}¢${d.volume ? `\nVolume: ${d.volume}` : ''}${d.expiresLabel ? `\nExpires: ${d.expiresLabel}` : ''}${d.ticker ? `\nTicker: ${d.ticker}` : ''}

Provide exactly these 5 sections:
**1. Market Assessment** – Is this price efficient or mispriced? What does ${yesPct}% imply about the event?
**2. Key Drivers** – 3 bullet points of the most important factors influencing this market
**3. Edge Analysis** – Where does edge exist (if any)? Lean YES or NO and why?
**4. Risk Factors** – What could move this market significantly?
**5. Recommendation** – Clear YES / NO / PASS with confidence level (Low/Medium/High)

No preamble. Start directly with section 1.`;
    } else if (['betting', 'odds', 'moneyline', 'spread', 'totals'].includes(cardType)) {
      const matchupStr = d.matchup ?? card.title ?? '';
      const matchupParts = matchupStr.includes('@') ? matchupStr.split('@').map((s: string) => s.trim()) : ['', ''];
      const awayTeamName = d.awayTeam ?? matchupParts[0] ?? '';
      const homeTeamName = d.homeTeam ?? matchupParts[1] ?? '';
      prompt = `Analyze this sports betting opportunity as a sharp bettor. Be concise.

Market: "${card.title}"
Sport: ${card.category}${awayTeamName ? `\nAway: ${awayTeamName}${d.awayOdds ? ` (ML: ${d.awayOdds})` : ''}` : ''}${homeTeamName ? `\nHome: ${homeTeamName}${d.homeOdds ? ` (ML: ${d.homeOdds})` : ''}` : ''}${(d.awaySpread || d.homeSpread) ? `\nSpread: ${awayTeamName} ${d.awaySpread ?? '—'} / ${homeTeamName} ${d.homeSpread ?? '—'}` : d.spread ? `\nSpread: ${d.spread}` : ''}${d.overUnder ? `\nTotal: ${d.overUnder}` : d.total ? `\nTotal: ${d.total}` : ''}${d.bookmakerCount ? `\nBooks covering: ${d.bookmakerCount}` : ''}${d.bestHomeOdds && d.bestHomeOdds !== d.homeOdds ? `\nBest home ML: ${d.bestHomeOdds}` : ''}${d.bestAwayOdds && d.bestAwayOdds !== d.awayOdds ? `\nBest away ML: ${d.bestAwayOdds}` : ''}${d.edge ? `\nDetected edge: ${d.edge}` : ''}${d.sharpMoney ? `\nSharp money signal: ${d.sharpMoney}` : ''}${d.sharpPct ? `\nSharp %: ${d.sharpPct}%` : ''}${d.confidence ? `\nModel confidence: ${d.confidence}` : ''}${d.lineMove ?? d.movement ?? d.lineChange ? `\nLine movement: ${d.lineMove ?? d.movement ?? d.lineChange}` : ''}${d.injuryAlert ? `\nInjury alert: ${d.injuryAlert}` : ''}${d.weatherNote ? `\nWeather: ${d.weatherNote}` : ''}${d.marketEfficiency ? `\nMarket efficiency: ${d.marketEfficiency}` : ''}

Provide exactly these 5 sections:
**1. Line Analysis** – Is this line sharp or public? Any steam, key numbers, or reverse line movement?
**2. Key Angles** – 3 bullet points of the strongest betting factors for this specific matchup
**3. Kelly Sizing** – Suggested bet size as % of bankroll based on edge and confidence
**4. Sharp Signal** – Where is sharp money leaning and why?
**5. Pick** – Clear recommendation (side/total) with one-line reasoning and confidence level

No preamble. Start directly with section 1.`;
    } else if (cardType === 'arbitrage') {
      prompt = `Analyze this sports betting arbitrage opportunity. Be precise.

Opportunity: "${card.title}"${d.profit ? `\nProfit margin: ${d.profit}` : ''}${d.bookmaker1 ? `\nBook 1: ${d.bookmaker1}` : ''}${d.bookmaker2 ? `\nBook 2: ${d.bookmaker2}` : ''}

Provide exactly these 5 sections:
**1. Opportunity Assessment** – Is this a genuine arb or key-number variance play?
**2. Execution Risk** – Account limits, line movement risk, timing window
**3. Profit Calculation** – Example stakes and profit with a $1,000 bankroll
**4. Execution Steps** – Step-by-step to lock in the profit
**5. Verdict** – Execute immediately / Proceed with caution / Avoid

No preamble. Start directly with section 1.`;
    } else if (cardType === 'dfs' || cardType === 'lineup') {
      prompt = `Analyze this DFS opportunity as a lineup optimizer. Be concise.

Player/Stack: "${card.title}"
Contest type: ${card.subcategory || card.category}${d.salary ? `\nSalary: ${d.salary}` : ''}${d.projection ? `\nProjection: ${d.projection}` : ''}${d.ownership ? `\nProjected ownership: ${d.ownership}` : ''}

Provide exactly these 5 sections:
**1. Value Assessment** – Is this good value at the salary? Salary efficiency score
**2. Ceiling Scenario** – What does a top-score game look like?
**3. Correlation Stacks** – Best teammates to pair for maximum upside
**4. Ownership Leverage** – GPP leverage potential (low/medium/high ownership)
**5. Recommendation** – Use in Cash / GPP / Both / Fade

No preamble. Start directly with section 1.`;
    } else if (cardType === 'prop-hit-rate' || cardType === 'player-prop' || cardType === 'prop') {
      const pct = d.hitRatePercentage ?? d.hitRate ?? '—';
      const propTrend = d.trend ?? '—';
      const diff = (typeof d.avgActual === 'number' && typeof d.avgLine === 'number')
        ? `${(d.avgActual - d.avgLine) >= 0 ? '+' : ''}${(d.avgActual - d.avgLine).toFixed(1)}`
        : d.edge ?? '—';
      prompt = `Analyze this player prop bet. Be concise and actionable.

Player: "${card.title}"
Stat/Line: ${d.statType ?? card.subcategory ?? '—'}
Hit rate: ${pct}% (${d.hits ?? '—'}/${d.totalGames ?? '—'} games)
Trend: ${propTrend}
Avg line: ${d.avgLine ?? '—'} | Avg actual: ${d.avgActual ?? '—'} | Edge: ${diff}
Recent form (last 7): ${d.recentForm ?? '—'}
Confidence: ${d.confidence ?? '—'}
Recommendation: ${d.recommendation ?? '—'}

Provide exactly these 5 sections:
**1. Hit Rate Assessment** – Is ${pct}% a significant edge or noise? Evaluate the sample size.
**2. Trend Analysis** – What does the ${propTrend} trend indicate going forward?
**3. Line Value** – Is the current line set correctly given recent performance?
**4. Risk Factors** – What could cause the trend to reverse or the prop to miss?
**5. Pick** – Over / Under / Pass with confidence level (Low/Medium/High)

No preamble. Start directly with section 1.`;
    } else if (cardType === 'fantasy' || cardType === 'draft') {
      prompt = `Analyze this fantasy sports opportunity. Be concise and actionable.

Player: "${card.title}"
Context: ${card.subcategory || card.category}${d.adp ? `\nADP: ${d.adp}` : ''}${d.value ? `\nValue: ${d.value}` : ''}

Provide exactly these 5 sections:
**1. Upside/Floor** – Best and worst realistic outcomes this season/week
**2. Key Factors** – 3 most important things to know right now
**3. Roster Decision** – Start / Sit / Trade for / Trade away / Waiver pickup
**4. Matchup Context** – Injury news, usage, schedule notes
**5. Verdict** – Clear action with confidence level

No preamble. Start directly with section 1.`;
    } else if (cardType === 'weather' || cardType === 'climate') {
      prompt = `Analyze this weather prediction market or weather-impacted game. Be concise.

Event: "${card.title}"${card.subcategory ? `\nType: ${card.subcategory}` : ''}

Provide exactly these 5 sections:
**1. Forecast Confidence** – How reliable is the current forecast for this event?
**2. Betting Implications** – How does weather impact totals, spreads, and specific props?
**3. Historical Context** – What typically happens to lines in these conditions?
**4. Key Thresholds** – Weather metrics that would trigger significant line movement
**5. Recommendation** – Actionable play (e.g., Under / Over / Fade game total)

No preamble. Start directly with section 1.`;
    } else {
      prompt = `Provide a focused analysis for this opportunity. Be concise and actionable.

Opportunity: "${card.title}"
Category: ${card.subcategory || card.category}

Provide exactly these 4 sections:
**1. Key Data Points** – Most important metrics supporting this opportunity
**2. Risk Assessment** – Potential downsides and how to mitigate them
**3. Recommended Action** – Clear action with one-line reasoning
**4. Position Sizing** – How much to allocate (% of bankroll)

No preamble. Start directly with section 1.`;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context: any = {
      isPoliticalMarket: cardType === 'kalshi' || cardType === 'prediction',
      hasBettingIntent: ['betting', 'odds', 'moneyline', 'spread', 'totals', 'arbitrage'].includes(cardType),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: prompt, context }),
        signal: controller.signal,
      });
      let result: CardAnalysisResponse;
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        result = { success: false, error: `Server error ${res.status}: ${text.slice(0, 150)}` };
      } else {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let donePayload: CardAnalysisResponse | null = null;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const parts = buf.split('\n\n');
            buf = parts.pop() ?? '';
            for (const part of parts) {
              if (!part.startsWith('data: ')) continue;
              try {
                const ev = JSON.parse(part.slice(6));
                if (ev.type === 'done') donePayload = ev as CardAnalysisResponse;
              } catch { /* ignore malformed chunks */ }
            }
          }
          if (buf.startsWith('data: ')) {
            try {
              const ev = JSON.parse(buf.slice(6));
              if (ev.type === 'done') donePayload = ev as CardAnalysisResponse;
            } catch { /* ignore */ }
          }
        } finally {
          reader.releaseLock();
        }
        result = donePayload ?? { success: false, error: 'No response from server' };
      }
      if (!result.success) {
        setCardAnalysisMap((prev) => ({ ...prev, [cardKey]: { loading: false, content: null, error: result.error ?? 'Analysis failed' } }));
        return;
      }
      setCardAnalysisMap((prev) => ({ ...prev, [cardKey]: { loading: false, content: result.text ?? null, error: null } }));
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      setCardAnalysisMap((prev) => ({
        ...prev,
        [cardKey]: { loading: false, content: null, error: isAbort ? 'Request timed out — please try again' : 'Network error — please try again' },
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  }, [cardAnalysisMap]);

  const generateDetailedAnalysis = useCallback((card: InsightCard) => {
    const cardKey = `insight-${card.type}-${(card.title || '').replace(/\s+/g, '-').toLowerCase().slice(0, 40)}`;
    generateCardAnalysis(card, cardKey);
  }, [generateCardAnalysis]);

  return {
    verifyStage,
    setVerifyStage,
    cardAnalysisMap,
    generateDetailedAnalysis,
  };
}
