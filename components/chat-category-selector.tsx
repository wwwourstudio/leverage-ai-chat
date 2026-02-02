'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  TrendingUp,
  Trophy,
  Target,
  BarChart3,
  MessageSquare,
} from 'lucide-react'

type ChatCategory = 'betting' | 'fantasy' | 'dfs' | 'kalshi' | 'general'

interface ChatCategorySelectorProps {
  selected: ChatCategory
  onSelect: (category: ChatCategory) => void
  className?: string
}

const categories = [
  {
    id: 'betting' as const,
    label: 'Sports Betting',
    description: 'Lines, props, parlays',
    icon: TrendingUp,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
  },
  {
    id: 'fantasy' as const,
    label: 'Fantasy Sports',
    description: 'Season-long leagues',
    icon: Trophy,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
  },
  {
    id: 'dfs' as const,
    label: 'DFS',
    description: 'Daily fantasy lineups',
    icon: Target,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
  },
  {
    id: 'kalshi' as const,
    label: 'Kalshi Markets',
    description: 'Prediction markets',
    icon: BarChart3,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
  },
  {
    id: 'general' as const,
    label: 'General',
    description: 'Ask anything',
    icon: MessageSquare,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
]

export function ChatCategorySelector({
  selected,
  onSelect,
  className,
}: ChatCategorySelectorProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 md:grid-cols-5 gap-3',
        className
      )}
    >
      {categories.map((category) => {
        const Icon = category.icon
        const isSelected = selected === category.id

        return (
          <button
            key={category.id}
            onClick={() => onSelect(category.id)}
            className={cn(
              'relative p-4 rounded-xl border-2 transition-all duration-200 text-left',
              'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
              isSelected
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-background hover:border-primary/50'
            )}
          >
            <div className="space-y-2">
              <div
                className={cn(
                  'inline-flex p-2 rounded-lg',
                  isSelected ? category.bgColor : 'bg-muted'
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5',
                    isSelected ? category.color : 'text-muted-foreground'
                  )}
                />
              </div>
              <div>
                <p
                  className={cn(
                    'font-semibold text-sm',
                    isSelected ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {category.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {category.description}
                </p>
              </div>
            </div>

            {isSelected && (
              <div className="absolute top-2 right-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function ChatCategoryBadge({ category }: { category: ChatCategory }) {
  const config = categories.find((c) => c.id === category)
  if (!config) return null

  const Icon = config.icon

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        config.color,
        config.bgColor
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </div>
  )
}
