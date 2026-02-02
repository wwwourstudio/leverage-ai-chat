'use server'

import { createClient } from '@/lib/supabase/server'
import { streamText } from 'ai'
import { createStreamableValue } from 'ai/rsc'

export async function generateAIResponse(
  chatId: string,
  userId: string,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  const supabase = await createClient()

  // Get user info to check credits
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('credits_balance, subscription_tier')
    .eq('id', userId)
    .single()

  if (userError) throw userError

  // Check if user has enough credits
  const costPerMessage = 1
  if (user.credits_balance < costPerMessage) {
    throw new Error('Insufficient credits. Please purchase more credits to continue.')
  }

  // Build context-aware system prompt
  const systemPrompt = `You are an expert sports betting and fantasy sports AI assistant with deep knowledge of NFL, NBA, NHL, and other major sports.

Your role:
- Provide data-driven insights for sports betting decisions
- Analyze player performance, team statistics, and betting odds
- Help users make informed fantasy sports lineup decisions
- Explain betting strategies and odds calculations
- ALWAYS cite sources and express confidence levels
- Flag uncertain predictions clearly

Guidelines:
- Be transparent about limitations
- Never guarantee wins or outcomes
- Provide probabilistic reasoning
- Consider injuries, weather, historical matchups
- Explain your reasoning step-by-step

User tier: ${user.subscription_tier || 'free'}
Remember: Responsible gambling. Never bet more than you can afford to lose.`

  const stream = createStreamableValue('')

  ;(async () => {
    try {
      const { textStream } = await streamText({
        model: 'grok/grok-2-latest',
        system: systemPrompt,
        messages: [
          ...conversationHistory,
          {
            role: 'user',
            content: userMessage,
          },
        ],
        temperature: 0.7,
        maxTokens: 2000,
      })

      let fullResponse = ''

      for await (const delta of textStream) {
        fullResponse += delta
        stream.update(delta)
      }

      stream.done()

      // Save assistant message to database
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          user_id: userId,
          role: 'assistant',
          content: fullResponse,
        })
        .select()
        .single()

      if (messageError) {
        console.error('[v0] Error saving assistant message:', messageError)
      }

      // Deduct credits
      const { error: updateError } = await supabase
        .from('users')
        .update({ credits_balance: user.credits_balance - costPerMessage })
        .eq('id', userId)

      if (updateError) {
        console.error('[v0] Error updating credits:', updateError)
      }

      // Log credit transaction
      await supabase.from('credits_ledger').insert({
        user_id: userId,
        amount: -costPerMessage,
        transaction_type: 'debit',
        description: `AI message generation - Chat ${chatId}`,
      })

      // Call validation edge function for trust scoring (async, don't await)
      if (message) {
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/validate-ai-response`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            message_id: message.id,
            content: fullResponse,
            user_message: userMessage,
          }),
        }).catch((err) => {
          console.error('[v0] Error calling validation function:', err)
        })
      }
    } catch (error) {
      console.error('[v0] AI generation error:', error)
      stream.error(error instanceof Error ? error.message : 'AI generation failed')
    }
  })()

  return { stream: stream.value }
}
