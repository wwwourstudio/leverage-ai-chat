'use client';

import { memo, useState, useEffect } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, ChevronRight, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlayerAvatar } from './PlayerAvatar';
import { getPlayerHeadshotUrl } from '@/lib/constants';

import type { BettingCardProps } from './betting/betting-utils';
import {
  parseTeams, fmtML, parseSpread, parseOU, sportTheme,
  calcVig, sportFromCategory, formatMarket, abbr, impliedProb,
} from './betting/betting-utils';
import { TeamLogo, SplitBar, TabBar } from './betting/betting-shared';
import { TabOdds }     from './betting/TabOdds';
import { TabProps }    from './betting/TabProps';
import { TabTeams }    from './betting/TabTeams';
import { TabHistory }  from './betting/TabHistory';
import { TabInjuries } from './betting/TabInjuries';
import { TabWatch }    from './betting/TabWatch';

export type { BettingCardProps };

export const BettingCard = memo(function BettingCard({
  title,
  category,
  subcategory,
  data,
  onAnalyze,
  onAsk,
  isHero = false,
}: BettingCardProps) {
  const teams = parseTeams(data.matchup || data.game);
  const homeML = fmtML(data.homeOdds);
  const awayML = fmtML(data.awayOdds);
  const spreadHome = parseSpread(data.homeSpread);
  const spreadAway = parseSpread(data.awaySpread);
  const ou = parseOU(data.overUnder);
  const hasOdds = !!(homeML || awayML || spreadHome || spreadAway || ou);
  const isFinal = data.status === 'FINAL' || !!data.finalScore;
  const isLiveGame = data.status === 'LIVE';
  const theme = sportTheme(data.sport);

  const isPlayerProp = !!(data.player) || subcategory.toLowerCase().includes('prop');
  const playerPhotoUrl = isPlayerProp && data.player
    ? (data.playerPhotoUrl ?? getPlayerHeadshotUrl(data.player))
    : null;

  const rawMove = data.lineMove ?? data.movement ?? data.lineChange ?? '';
  const moveNum = parseFloat(String(rawMove));
  const moveDir: 'up' | 'down' | 'flat' =
    !isNaN(moveNum) ? (moveNum > 0 ? 'up' : moveNum < 0 ? 'down' : 'flat')
    : String(rawMove).includes('+') ? 'up' : String(rawMove).includes('-') ? 'down' : 'flat';
  const hasLineMove = !!(rawMove && String(rawMove) !== '0');

  const sharpPct: number | null = typeof data.sharpPct === 'number' ? data.sharpPct
    : typeof data.sharpPct === 'string' ? parseFloat(data.sharpPct) || null
    : data.sharpMoney?.match?.(/(\d+)%/) ? parseFloat(data.sharpMoney.match(/(\d+)%/)![1])
    : null;

  const confPct: number | null = typeof data.confidence === 'number' ? data.confidence
    : typeof data.confidence === 'string' ? parseFloat(data.confidence) || null
    : null;

  const homeProb = impliedProb(data.homeOdds);
  const awayProb = impliedProb(data.awayOdds);

  const isExtremeOdds = (() => {
    const h = Number(data.homeOdds);
    const a = Number(data.awayOdds);
    if (isNaN(h) || isNaN(a) || h === 0 || a === 0) return false;
    const hProb = h < 0 ? (-h) / (-h + 100) : 100 / (h + 100);
    const aProb = a < 0 ? (-a) / (-a + 100) : 100 / (a + 100);
    return Math.max(hProb, aProb) > 0.97;
  })();

  const isBestHome = !!(data.bestHomeOdds && data.homeOdds && data.homeOdds === data.bestHomeOdds);
  const isBestAway = !!(data.bestAwayOdds && data.awayOdds && data.awayOdds === data.bestAwayOdds);
  const vigPct = calcVig(data.homeOdds, data.awayOdds);

  const books = Array.isArray(data.books) ? data.books : [];
  const hasBookComparison = books.length >= 2;

  const [activeTab, setActiveTab] = useState(0);
  const [marketView, setMarketView] = useState<'ml' | 'spread' | 'total'>('ml');

  // Lazy-load player props when the Props tab is first activated
  const [propsLoading, setPropsLoading] = useState(false);
  const [lazyProps, setLazyProps] = useState<any[] | null>(null);

  useEffect(() => {
    if (activeTab !== 1) return;
    if (lazyProps !== null) return;
    const sport = data.sport ?? sportFromCategory(data.category ?? '');
    if (!sport) { setLazyProps([]); return; }
    setPropsLoading(true);
    fetch(`/api/props?sport=${sport}`)
      .then(r => r.ok ? r.json() : { players: [] })
      .then((json: { players?: any[] }) => {
        const all: any[] = Array.isArray(json.players) ? json.players : [];
        const parsed = parseTeams(data.matchup ?? data.game ?? '');
        const lw = (s: string) => s.toLowerCase().split(/\s+/).pop() ?? '';
        const filtered = parsed && all.length
          ? all.filter((p: any) => {
              const t = (p.team ?? '').toLowerCase();
              const hw = lw(parsed.home); const aw = lw(parsed.away);
              return (hw.length > 3 && (t.includes(hw) || lw(t) === hw)) ||
                     (aw.length > 3 && (t.includes(aw) || lw(t) === aw));
            })
          : all.slice(0, 12);
        setLazyProps((filtered.length ? filtered : all.slice(0, 12)).map((p: any) => ({
          player: p.name, team: p.team, stat: formatMarket(p.market),
          line: `O/U ${p.line}`,
          odds: p.overOdds > 0 ? `+${p.overOdds}` : String(p.overOdds),
          hitRate: null,
        })));
      })
      .catch(() => setLazyProps([]))
      .finally(() => setPropsLoading(false));
  }, [activeTab, lazyProps, data.sport, data.category, data.matchup, data.game]);

  // Lazy-load Teams / History / Injuries context from MLB Stats API
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctx, setCtx] = useState<any | null>(null);

  useEffect(() => {
    if (![2, 3, 4].includes(activeTab)) return;
    if (ctx !== null) return;
    const sport = data.sport ?? sportFromCategory(data.category ?? '');
    if (!sport || !teams) { setCtx({}); return; }
    setCtxLoading(true);
    fetch(`/api/game-context?sport=${sport}&home=${encodeURIComponent(teams.home)}&away=${encodeURIComponent(teams.away)}`)
      .then(r => r.ok ? r.json() : {})
      .then(json => setCtx(json))
      .catch(() => setCtx({}))
      .finally(() => setCtxLoading(false));
  }, [activeTab, ctx, teams, data.sport, data.category]);

  return (
    <article className={cn(
      'group relative w-full rounded-2xl overflow-hidden bg-background border shadow-xl shadow-black/20 transition-all duration-300',
      isHero
        ? 'border-[var(--border-subtle)] shadow-[0_0_32px_oklch(0.3_0.06_260/0.12)]'
        : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:scale-[1.01] hover:shadow-[0_8px_32px_oklch(0.1_0.02_260/0.35)]',
    )}>

      {/* Full-bleed gradient header */}
      <div className={cn('relative px-3 pt-2.5 pb-2 pr-10 md:px-4 md:pt-3.5 md:pb-3 md:pr-10 bg-gradient-to-br', theme.headerGrad)}>
        {/* Category breadcrumb + status badge — inline, no absolute, clears bookmark overlay */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--foreground)]/70">{category}</span>
            <span className="text-[var(--foreground)]/30">·</span>
            <span className="text-[10px] text-[var(--foreground)]/50 truncate">{subcategory}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {(isLiveGame || isExtremeOdds) && !isFinal && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-[10px] font-black text-blue-300 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                LIVE
              </span>
            )}
            {data.realData && !isLiveGame && !isFinal && !isExtremeOdds && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400/80">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400/70" />
                LIVE
              </span>
            )}
            {isFinal && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-500/20 border border-slate-500/30 text-[10px] font-black text-slate-300 uppercase tracking-wider">
                FINAL
              </span>
            )}
          </div>
        </div>

        {/* Mini matchup hero — team logos + moneylines visible immediately in header */}
        {!isPlayerProp && teams && (
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              <TeamLogo name={teams.away} sport={data.sport} avatarCls={theme.avatarCls} isLarge={false} />
              <span className="font-black text-[var(--foreground)] text-xs tracking-wide">{abbr(teams.away)}</span>
            </div>
            {awayML && (
              <span className={cn('text-sm font-black tabular-nums', awayML.positive ? 'text-blue-400' : 'text-[var(--foreground)]/90')}>
                {awayML.display}
              </span>
            )}
            <span className="text-[9px] font-black text-[var(--foreground)]/40 mx-0.5">@</span>
            {homeML && (
              <span className={cn('text-sm font-black tabular-nums', homeML.positive ? 'text-blue-400' : 'text-[var(--foreground)]/90')}>
                {homeML.display}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="font-black text-[var(--foreground)] text-xs tracking-wide">{abbr(teams.home)}</span>
              <TeamLogo name={teams.home} sport={data.sport} avatarCls={theme.avatarCls} isLarge={false} />
            </div>
          </div>
        )}

        {/* Bottom row: game time + edge badge + line move pill */}
        <div className="flex items-center gap-2 flex-wrap mt-1">
          {data.gameTime && (
            <div className="flex items-center gap-1 text-[10px] text-[var(--foreground)]/60">
              <Clock className="w-3 h-3" />
              {data.gameTime}
            </div>
          )}
          {data.edge && (() => {
            const edgeNum = parseFloat(String(data.edge).replace(/[^0-9.-]/g, ''));
            const edgeCls = !isNaN(edgeNum) && edgeNum >= 5
              ? 'bg-blue-500/20 border-blue-500/35 text-blue-300'
              : !isNaN(edgeNum) && edgeNum >= 2
              ? 'bg-amber-500/20 border-amber-500/35 text-amber-300'
              : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--foreground)]/70';
            return (
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider', edgeCls)}>
                EDGE {data.edge}
              </span>
            );
          })()}
          {hasLineMove && (
            <span className={cn(
              'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border text-[10px] font-bold',
              moveDir === 'up'   ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
              : moveDir === 'down' ? 'bg-red-500/15 border-red-500/30 text-red-300'
              : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]',
            )}>
              {moveDir === 'up' ? <TrendingUp className="w-2.5 h-2.5" /> : moveDir === 'down' ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
              {!isNaN(moveNum) && moveNum !== 0 ? (moveNum > 0 ? `+${moveNum}` : String(moveNum)) : String(rawMove)}
            </span>
          )}
        </div>
      </div>

      <div className="px-3 pb-3 space-y-2 md:px-4 md:pb-4 md:space-y-3">

        {/* Player prop header */}
        {isPlayerProp && data.player && (
          <div className="flex items-center gap-3 mt-3 px-3 py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)]">
            <PlayerAvatar playerName={data.player} photoUrl={playerPhotoUrl} sport={data.sport} size={isHero ? 'lg' : 'md'} />
            <div className="min-w-0 flex-1">
              <p className={cn('font-black text-foreground truncate', isHero ? 'text-base' : 'text-sm')}>{data.player}</p>
              {data.stat && <p className="text-[11px] text-[var(--text-faint)] truncate">{data.stat}</p>}
            </div>
            {data.odds && (
              <span className={cn('font-black tabular-nums shrink-0 text-xl', Number(data.odds) > 0 ? 'text-blue-400' : 'text-red-400')}>
                {Number(data.odds) > 0 ? `+${data.odds}` : data.odds}
              </span>
            )}
          </div>
        )}

        {/* Player prop data strip */}
        {isPlayerProp && data.player && (data.line != null || data.hitRate != null || confPct !== null) && (
          <div className={cn('grid gap-1.5', [data.line != null, data.hitRate != null, confPct !== null].filter(Boolean).length === 3 ? 'grid-cols-3' : [data.line != null, data.hitRate != null, confPct !== null].filter(Boolean).length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
            {data.line != null && (
              <div className="flex flex-col items-center rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-2 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Line</span>
                <span className="text-base font-black text-foreground tabular-nums">{data.line}</span>
              </div>
            )}
            {data.hitRate != null && (
              <div className="flex flex-col items-center rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-2 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Hit Rate</span>
                <span className={cn('text-base font-black tabular-nums', Number(data.hitRate) >= 65 ? 'text-blue-400' : Number(data.hitRate) <= 35 ? 'text-red-400' : 'text-foreground')}>{data.hitRate}%</span>
              </div>
            )}
            {confPct !== null && (
              <div className="flex flex-col items-center rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] px-2 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Confidence</span>
                <span className={cn('text-base font-black tabular-nums', confPct >= 70 ? 'text-blue-400' : confPct >= 50 ? 'text-amber-400' : 'text-red-400')}>{confPct}%</span>
              </div>
            )}
          </div>
        )}

        {/* Team matchup block */}
        {!isPlayerProp && teams ? (
          <div className="mt-3 rounded-xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-overlay)]">
            <div className="flex items-center gap-2 px-4 py-3">
              {/* Away team */}
              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <TeamLogo name={teams.away} sport={data.sport} avatarCls={theme.avatarCls} isLarge={isHero} />
                <span className={cn('font-black text-foreground text-center leading-tight truncate w-full', isHero ? 'text-sm' : 'text-xs')}>{teams.away}</span>
                {awayML && (
                  <span className={cn('font-black tabular-nums', isHero ? 'text-xl' : 'text-lg', awayML.positive ? 'text-blue-400' : 'text-foreground', isBestAway && 'ring-1 ring-blue-400/40 rounded-md px-1 bg-blue-500/8')}>
                    {awayML.display}
                    {isBestAway && <span className="text-[10px] ml-0.5 text-blue-500 font-black">★</span>}
                  </span>
                )}
                {awayProb !== null && (
                  <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded-full tabular-nums', awayProb > 55 ? 'text-blue-400 bg-blue-500/12' : 'text-[var(--text-muted)] bg-[var(--bg-elevated)]')}>{awayProb}%</span>
                )}
              </div>

              {/* Centre divider */}
              <div className="flex flex-col items-center gap-1 shrink-0 px-1">
                {isFinal && data.finalScore ? (
                  <span className="text-sm font-black text-foreground tabular-nums">{data.finalScore}</span>
                ) : (
                  <span className={cn('text-xs font-black uppercase tracking-wider opacity-60', theme.accentColor)}>VS</span>
                )}
                {!isFinal && data.gameTime && (
                  <span className="text-[10px] text-[var(--text-faint)]">{data.gameTime}</span>
                )}
              </div>

              {/* Home team */}
              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <TeamLogo name={teams.home} sport={data.sport} avatarCls={theme.avatarCls} isLarge={isHero} />
                <span className={cn('font-black text-foreground text-center leading-tight truncate w-full', isHero ? 'text-sm' : 'text-xs')}>{teams.home}</span>
                {homeML && (
                  <span className={cn('font-black tabular-nums', isHero ? 'text-xl' : 'text-lg', homeML.positive ? 'text-blue-400' : 'text-foreground', isBestHome && 'ring-1 ring-blue-400/40 rounded-md px-1 bg-blue-500/8')}>
                    {homeML.display}
                    {isBestHome && <span className="text-[10px] ml-0.5 text-blue-500 font-black">★</span>}
                  </span>
                )}
                {homeProb !== null && (
                  <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded-full tabular-nums', homeProb > 55 ? 'text-blue-400 bg-blue-500/12' : 'text-[var(--text-muted)] bg-[var(--bg-elevated)]')}>{homeProb}%</span>
                )}
              </div>
            </div>

            {/* Win probability split bar */}
            {awayProb !== null && homeProb !== null && (
              <div className="px-4 pb-3">
                <SplitBar
                  leftPct={awayProb}
                  leftLabel={abbr(teams.away)}
                  rightLabel={abbr(teams.home)}
                  leftColor={cn('bg-gradient-to-r', theme.probBarColor, 'opacity-80')}
                  rightColor="bg-[var(--bg-elevated)]"
                />
              </div>
            )}
          </div>
        ) : !isPlayerProp && (
          <p className="text-sm font-semibold text-foreground mt-3 truncate">{title}</p>
        )}

        {/* Tab bar */}
        <TabBar activeTab={activeTab} onSelect={setActiveTab} accentCls={theme.avatarCls} />

        {/* Tab content — keyed div triggers re-mount animation on each tab switch */}
        <div key={activeTab} className="animate-tab-enter">
        {activeTab === 0 && (
          <TabOdds
            data={data}
            teams={teams}
            isFinal={isFinal}
            isExtremeOdds={isExtremeOdds}
            hasBookComparison={hasBookComparison}
            books={books}
            spreadHome={spreadHome}
            spreadAway={spreadAway}
            ou={ou}
            hasOdds={hasOdds}
            isBestHome={isBestHome}
            isBestAway={isBestAway}
            awayML={awayML}
            homeML={homeML}
            confPct={confPct}
            sharpPct={sharpPct}
            hasLineMove={hasLineMove}
            moveDir={moveDir}
            moveNum={moveNum}
            rawMove={String(rawMove)}
            vigPct={vigPct}
            marketView={marketView}
            setMarketView={setMarketView}
            accentCls={theme.avatarCls}
          />
        )}
        {activeTab === 1 && (
          <TabProps
            data={{ ...data, playerProps: lazyProps ?? data.playerProps }}
            loading={propsLoading}
            onAnalyze={onAnalyze}
            onAsk={onAsk}
          />
        )}
        {activeTab === 2 && (
          <TabTeams
            data={{
              ...data,
              homeRecord: ctx?.teams?.home?.record ?? data.homeRecord,
              awayRecord: ctx?.teams?.away?.record ?? data.awayRecord,
              teamComparison: ctx?.teams ? {
                home: { last10: ctx.teams.home?.last10, pointsPerGame: ctx.teams.home?.splitRecord, streak: ctx.teams.home?.streak },
                away: { last10: ctx.teams.away?.last10, pointsPerGame: ctx.teams.away?.splitRecord, streak: ctx.teams.away?.streak },
              } : data.teamComparison,
            }}
            teams={teams} theme={theme} onAnalyze={onAnalyze} onAsk={onAsk} loading={ctxLoading && ctx === null}
          />
        )}
        {activeTab === 3 && (
          <TabHistory
            data={{ ...data, h2hHistory: ctx?.history ?? data.h2hHistory }}
            onAnalyze={onAnalyze} onAsk={onAsk} loading={ctxLoading && ctx === null}
          />
        )}
        {activeTab === 4 && (
          <TabInjuries
            data={{
              ...data,
              injuries: ctx?.injuries
                ? ctx.injuries.map((p: any) => ({ ...p, team: p.team }))
                : data.injuries,
            }}
            onAnalyze={onAnalyze} onAsk={onAsk} loading={ctxLoading && ctx === null}
          />
        )}
        {activeTab === 5 && (
          <TabWatch
            data={{ ...data, playersToWatch: data.playersToWatch ?? (lazyProps ?? []).slice(0, 5).map((p: any) => ({ player: p.player, team: p.team, reason: `${p.stat} ${p.line} (${p.odds})` })) }}
            onAnalyze={onAnalyze}
            onAsk={onAsk}
          />
        )}
        </div>{/* end animate-tab-enter */}

        {/* Footer */}
        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
          <div className="flex items-center gap-2">
            {data.bookmaker && (
              <span className="text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--bg-surface)] px-2 py-0.5 rounded-md border border-[var(--border-subtle)]">
                {data.bookmaker}
              </span>
            )}
            {data.bookmakerCount && Number(data.bookmakerCount) > 1 && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
                <BookOpen className="w-3 h-3" />
                {Number(data.bookmakerCount)} books
              </span>
            )}
          </div>
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-faint)] hover:text-foreground hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] transition-all duration-150"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Full Analysis
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
});
