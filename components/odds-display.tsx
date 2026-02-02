import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface OddsDisplayProps {
  odds: number
  format?: 'american' | 'decimal' | 'fractional'
  bookmaker?: string
  isBest?: boolean
  movement?: 'up' | 'down' | 'none'
  className?: string
}

export function OddsDisplay({
  odds,
  format = 'american',
  bookmaker,
  isBest = false,
  movement = 'none',
  className,
}: OddsDisplayProps) {
  const formatOdds = () => {
    switch (format) {
      case 'american':
        return odds > 0 ? `+${odds}` : `${odds}`
      case 'decimal':
        return odds.toFixed(2)
      case 'fractional':
        // Convert decimal to fractional
        const decimal = odds
        const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
        const numerator = Math.round((decimal - 1) * 100)
        const denominator = 100
        const divisor = gcd(numerator, denominator)
        return `${numerator / divisor}/${denominator / divisor}`
      default:
        return odds
    }
  }

  const getOddsColor = () => {
    if (format === 'american') {
      return odds > 0
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-600 dark:text-red-400'
    }
    return 'text-foreground'
  }

  const MovementIcon = {
    up: TrendingUp,
    down: TrendingDown,
    none: Minus,
  }[movement]

  const movementColor = {
    up: 'text-green-600',
    down: 'text-red-600',
    none: 'text-muted-foreground',
  }[movement]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-3 py-2',
        isBest && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20',
        className
      )}
    >
      <div className="flex flex-col">
        {bookmaker && (
          <span className="text-xs text-muted-foreground">{bookmaker}</span>
        )}
        <span className={cn('text-lg font-bold font-mono', getOddsColor())}>
          {formatOdds()}
        </span>
      </div>
      {movement !== 'none' && (
        <MovementIcon className={cn('h-4 w-4', movementColor)} />
      )}
      {isBest && (
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          BEST
        </span>
      )}
    </div>
  )
}

interface OddsComparisonProps {
  odds: Array<{
    bookmaker: string
    odds: number
    lastUpdate: Date
  }>
  format?: 'american' | 'decimal' | 'fractional'
  className?: string
}

export function OddsComparison({
  odds,
  format = 'american',
  className,
}: OddsComparisonProps) {
  if (odds.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No odds available</div>
    )
  }

  // Find best odds (highest for positive American, closest to 0 for negative)
  const bestOddsIndex =
    format === 'american'
      ? odds.reduce(
          (maxIdx, curr, idx, arr) =>
            curr.odds > arr[maxIdx].odds ? idx : maxIdx,
          0
        )
      : 0

  return (
    <div className={cn('space-y-2', className)}>
      <h4 className="text-sm font-medium text-muted-foreground">
        Odds Comparison
      </h4>
      <div className="grid gap-2">
        {odds.map((odd, index) => (
          <OddsDisplay
            key={odd.bookmaker}
            odds={odd.odds}
            format={format}
            bookmaker={odd.bookmaker}
            isBest={index === bestOddsIndex}
          />
        ))}
      </div>
    </div>
  )
}

interface LiveOddsProps {
  sport: string
  game: string
  odds: {
    homeTeam: { name: string; odds: number }
    awayTeam: { name: string; odds: number }
    draw?: { odds: number }
  }
  lastUpdate: Date
  className?: string
}

export function LiveOdds({
  sport,
  game,
  odds,
  lastUpdate,
  className,
}: LiveOddsProps) {
  const timeSinceUpdate = Date.now() - lastUpdate.getTime()
  const minutesAgo = Math.floor(timeSinceUpdate / 60000)

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', className)}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{game}</h3>
          <p className="text-xs text-muted-foreground">{sport}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {minutesAgo === 0 ? 'Just now' : `${minutesAgo}m ago`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium">{odds.homeTeam.name}</p>
          <OddsDisplay odds={odds.homeTeam.odds} format="american" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{odds.awayTeam.name}</p>
          <OddsDisplay odds={odds.awayTeam.odds} format="american" />
        </div>
        {odds.draw && (
          <div className="col-span-2 space-y-2">
            <p className="text-sm font-medium">Draw</p>
            <OddsDisplay odds={odds.draw.odds} format="american" />
          </div>
        )}
      </div>
    </div>
  )
}
