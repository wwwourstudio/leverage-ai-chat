'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserCredits } from '@/app/actions/credits'
import { Coins, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreditsDisplayProps {
  userId: string
  showDetails?: boolean
  className?: string
}

export function CreditsDisplay({
  userId,
  showDetails = false,
  className,
}: CreditsDisplayProps) {
  const [credits, setCredits] = useState<{
    balance: number
    purchased: number
    spent: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCredits() {
      try {
        const data = await getUserCredits(userId)
        setCredits({
          balance: data.credits_balance,
          purchased: data.total_credits_purchased,
          spent: data.total_credits_spent,
        })
      } catch (error) {
        console.error('[v0] Failed to load credits:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCredits()

    // Subscribe to real-time updates
    const supabase = createClient()
    const channel = supabase
      .channel('credits_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'credits_ledger',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[v0] Credits updated:', payload)
          // Reload credits when a transaction is recorded
          loadCredits()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  if (loading) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted animate-pulse',
          className
        )}
      >
        <div className="h-4 w-16 bg-muted-foreground/20 rounded" />
      </div>
    )
  }

  if (!credits) {
    return null
  }

  const getBalanceColor = () => {
    if (credits.balance >= 100) return 'text-green-600 dark:text-green-400'
    if (credits.balance >= 50) return 'text-amber-600 dark:text-amber-400'
    if (credits.balance >= 20) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
        <Coins className={cn('h-4 w-4', getBalanceColor())} />
        <span className={cn('font-semibold text-sm', getBalanceColor())}>
          {credits.balance.toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">credits</span>
      </div>

      {showDetails && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Purchased: {credits.purchased.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingDown className="h-3 w-3" />
            <span>Spent: {credits.spent.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function CreditsBalance({ balance }: { balance: number }) {
  const getColor = () => {
    if (balance >= 100) return 'text-green-600'
    if (balance >= 50) return 'text-amber-600'
    if (balance >= 20) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <div className="flex items-center gap-2">
      <Coins className={cn('h-5 w-5', getColor())} />
      <div className="flex items-baseline gap-1">
        <span className={cn('text-2xl font-bold', getColor())}>
          {balance.toLocaleString()}
        </span>
        <span className="text-sm text-muted-foreground">credits</span>
      </div>
    </div>
  )
}
