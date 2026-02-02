import { cn } from '@/lib/utils'
import { TrustBadge, TrustBar } from '@/components/trust-badge'
import { Bot, User, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'

type MessageRole = 'user' | 'assistant' | 'system'
type ConfidenceLevel = 'very_high' | 'high' | 'medium' | 'low' | 'very_low'

interface ChatMessageEnhancedProps {
  role: MessageRole
  content: string
  trustScore?: number
  confidenceLevel?: ConfidenceLevel
  model?: string
  tokensUsed?: number
  creditsCharged?: number
  timestamp: Date
  validationStatus?: 'pending' | 'validated' | 'flagged' | 'failed'
  showTrustMetrics?: boolean
}

export function ChatMessageEnhanced({
  role,
  content,
  trustScore,
  confidenceLevel,
  model,
  tokensUsed,
  creditsCharged,
  timestamp,
  validationStatus,
  showTrustMetrics = true,
}: ChatMessageEnhancedProps) {
  const isUser = role === 'user'
  const isAssistant = role === 'assistant'

  return (
    <div
      className={cn(
        'flex gap-3 group',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div
          className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          )}
        >
          {isUser ? (
            <User className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </div>
      </div>

      {/* Message Content */}
      <div className={cn('flex-1 space-y-2', isUser ? 'items-end' : 'items-start')}>
        {/* Message Bubble */}
        <Card
          className={cn(
            'p-4 max-w-[85%]',
            isUser
              ? 'bg-primary text-primary-foreground ml-auto'
              : 'bg-muted'
          )}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </Card>

        {/* Metadata */}
        <div
          className={cn(
            'flex items-center gap-3 text-xs text-muted-foreground px-1',
            isUser ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          <time>{timestamp.toLocaleTimeString()}</time>

          {isAssistant && creditsCharged && (
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {creditsCharged} credits
            </span>
          )}

          {isAssistant && model && (
            <span className="opacity-70">{model}</span>
          )}
        </div>

        {/* Trust Metrics (AI messages only) */}
        {isAssistant &&
          showTrustMetrics &&
          trustScore !== undefined &&
          confidenceLevel && (
            <div className="space-y-2 max-w-[85%]">
              <div className="flex items-center gap-2">
                <TrustBadge
                  trustScore={trustScore}
                  confidenceLevel={confidenceLevel}
                  size="sm"
                />
                {validationStatus === 'validated' && (
                  <span className="text-xs text-green-600 dark:text-green-400">
                    Validated
                  </span>
                )}
                {validationStatus === 'flagged' && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Flagged for review
                  </span>
                )}
              </div>
              <TrustBar trustScore={trustScore} showPercentage={false} />
            </div>
          )}
      </div>
    </div>
  )
}

interface ChatMessageListProps {
  messages: Array<{
    id: string
    role: MessageRole
    content: string
    trustScore?: number
    confidenceLevel?: ConfidenceLevel
    model?: string
    tokensUsed?: number
    creditsCharged?: number
    createdAt: Date
    validationStatus?: 'pending' | 'validated' | 'flagged' | 'failed'
  }>
  showTrustMetrics?: boolean
}

export function ChatMessageList({
  messages,
  showTrustMetrics = true,
}: ChatMessageListProps) {
  return (
    <div className="space-y-6">
      {messages.map((message) => (
        <ChatMessageEnhanced
          key={message.id}
          role={message.role}
          content={message.content}
          trustScore={message.trustScore}
          confidenceLevel={message.confidenceLevel}
          model={message.model}
          tokensUsed={message.tokensUsed}
          creditsCharged={message.creditsCharged}
          timestamp={message.createdAt}
          validationStatus={message.validationStatus}
          showTrustMetrics={showTrustMetrics}
        />
      ))}
    </div>
  )
}
