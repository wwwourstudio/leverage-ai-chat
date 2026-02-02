'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

type PositionCategory = 'betting' | 'fantasy' | 'dfs' | 'kalshi'
type PositionStatus = 'open' | 'closed' | 'pending'

interface Position {
  id: string
  category: PositionCategory
  description: string
  entryValue: number
  currentValue: number
  status: PositionStatus
  openedAt: Date
  closedAt?: Date
  metadata: {
    sport?: string
    league?: string
    team?: string
    player?: string
    bookmaker?: string
    odds?: number
  }
}

interface PortfolioTrackerProps {
  positions: Position[]
  userId: string
}

export function PortfolioTracker({ positions, userId }: PortfolioTrackerProps) {
  const [filter, setFilter] = useState<'all' | PositionCategory>('all')

  const filteredPositions =
    filter === 'all'
      ? positions
      : positions.filter((p) => p.category === filter)

  const stats = {
    totalValue: positions.reduce((sum, p) => sum + p.currentValue, 0),
    totalPnL: positions.reduce(
      (sum, p) => sum + (p.currentValue - p.entryValue),
      0
    ),
    openPositions: positions.filter((p) => p.status === 'open').length,
    closedPositions: positions.filter((p) => p.status === 'closed').length,
  }

  const pnlPercentage =
    stats.totalPnL /
    positions.reduce((sum, p) => sum + p.entryValue, 0) *
    100

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold">
                ${stats.totalValue.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                stats.totalPnL >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
              )}
            >
              {stats.totalPnL >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total P&L</p>
              <p
                className={cn(
                  'text-2xl font-bold',
                  stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
                )}
              >
                ${stats.totalPnL >= 0 ? '+' : ''}
                {stats.totalPnL.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Open</p>
              <p className="text-2xl font-bold">{stats.openPositions}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Closed</p>
              <p className="text-2xl font-bold">{stats.closedPositions}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All Positions
        </Button>
        <Button
          variant={filter === 'betting' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('betting')}
        >
          Betting
        </Button>
        <Button
          variant={filter === 'fantasy' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('fantasy')}
        >
          Fantasy
        </Button>
        <Button
          variant={filter === 'dfs' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('dfs')}
        >
          DFS
        </Button>
        <Button
          variant={filter === 'kalshi' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('kalshi')}
        >
          Kalshi
        </Button>
      </div>

      {/* Positions List */}
      <div className="space-y-3">
        {filteredPositions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No positions in this category yet
            </p>
          </Card>
        ) : (
          filteredPositions.map((position) => (
            <PositionCard key={position.id} position={position} />
          ))
        )}
      </div>
    </div>
  )
}

function PositionCard({ position }: { position: Position }) {
  const pnl = position.currentValue - position.entryValue
  const pnlPercentage = (pnl / position.entryValue) * 100

  const categoryColors = {
    betting: 'bg-blue-500',
    fantasy: 'bg-purple-500',
    dfs: 'bg-orange-500',
    kalshi: 'bg-green-500',
  }

  const statusColors = {
    open: 'bg-green-500',
    closed: 'bg-muted',
    pending: 'bg-amber-500',
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'h-2 w-2 rounded-full mt-2',
                categoryColors[position.category]
              )}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="capitalize">
                  {position.category}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn('capitalize', statusColors[position.status])}
                >
                  {position.status}
                </Badge>
                {position.metadata.sport && (
                  <span className="text-xs text-muted-foreground">
                    {position.metadata.sport}
                  </span>
                )}
              </div>
              <p className="font-medium mt-1">{position.description}</p>
              {position.metadata.bookmaker && (
                <p className="text-sm text-muted-foreground">
                  {position.metadata.bookmaker}
                  {position.metadata.odds && ` • ${position.metadata.odds}`}
                </p>
              )}
            </div>
          </div>

          {/* Values */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Entry</p>
              <p className="font-semibold">
                ${position.entryValue.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Current</p>
              <p className="font-semibold">
                ${position.currentValue.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">P&L</p>
              <p
                className={cn(
                  'font-semibold flex items-center gap-1',
                  pnl >= 0 ? 'text-green-600' : 'text-red-600'
                )}
              >
                {pnl >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                ${pnl >= 0 ? '+' : ''}
                {pnl.toFixed(2)} ({pnlPercentage.toFixed(1)}%)
              </p>
            </div>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              Opened: {position.openedAt.toLocaleDateString()}
            </span>
            {position.closedAt && (
              <span>
                Closed: {position.closedAt.toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
