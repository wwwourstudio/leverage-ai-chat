import { cn } from '@/lib/utils'
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'

type ConfidenceLevel = 'very_high' | 'high' | 'medium' | 'low' | 'very_low'

interface TrustBadgeProps {
  trustScore: number // 0.0000 to 1.0000
  confidenceLevel: ConfidenceLevel
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const confidenceConfig = {
  very_high: {
    label: 'Very High',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: ShieldCheck,
  },
  high: {
    label: 'High',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800',
    icon: ShieldCheck,
  },
  medium: {
    label: 'Medium',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    icon: Shield,
  },
  low: {
    label: 'Low',
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    icon: ShieldAlert,
  },
  very_low: {
    label: 'Very Low',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    icon: ShieldAlert,
  },
}

const sizeConfig = {
  sm: {
    icon: 'h-3 w-3',
    text: 'text-xs',
    padding: 'px-1.5 py-0.5',
  },
  md: {
    icon: 'h-4 w-4',
    text: 'text-sm',
    padding: 'px-2 py-1',
  },
  lg: {
    icon: 'h-5 w-5',
    text: 'text-base',
    padding: 'px-3 py-1.5',
  },
}

export function TrustBadge({
  trustScore,
  confidenceLevel,
  size = 'md',
  showLabel = true,
  className,
}: TrustBadgeProps) {
  const config = confidenceConfig[confidenceLevel]
  const sizeStyles = sizeConfig[size]
  const Icon = config.icon
  const percentage = Math.round(trustScore * 100)

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        config.color,
        config.bg,
        config.border,
        sizeStyles.padding,
        sizeStyles.text,
        className
      )}
    >
      <Icon className={sizeStyles.icon} />
      <span className="font-semibold">{percentage}%</span>
      {showLabel && <span className="opacity-90">{config.label}</span>}
    </div>
  )
}

interface TrustBarProps {
  trustScore: number
  showPercentage?: boolean
  className?: string
}

export function TrustBar({
  trustScore,
  showPercentage = true,
  className,
}: TrustBarProps) {
  const percentage = Math.round(trustScore * 100)

  const getColor = () => {
    if (trustScore >= 0.9) return 'bg-emerald-500'
    if (trustScore >= 0.75) return 'bg-green-500'
    if (trustScore >= 0.6) return 'bg-amber-500'
    if (trustScore >= 0.4) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div className={cn('space-y-1', className)}>
      {showPercentage && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Trust Score</span>
          <span className="font-semibold">{percentage}%</span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full transition-all duration-500', getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
