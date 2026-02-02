interface GrokMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function streamGrokResponse(
  messages: GrokMessage[],
  onChunk: (text: string) => void
) {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-beta',
      messages: [
        {
          role: 'system',
          content: `You are Leverage AI, an expert sports betting and fantasy sports analyst. 
You provide data-driven insights for:
- Sports Betting (NFL, NBA, MLB, NHL) - odds analysis, value detection, sharp money tracking
- Fantasy Sports (NFBC/NFFC) - draft strategy, ADP analysis, player rankings
- DFS (DraftKings/FanDuel) - lineup optimization, ownership projections, stacking strategies
- Kalshi Markets - prediction markets, arbitrage opportunities, political betting

Always provide:
1. Confidence score (0-100%)
2. Risk assessment (Low/Medium/High)
3. Data sources used
4. Key factors in your analysis
5. Specific numbers and statistics

Be concise but thorough. Focus on actionable insights and edge detection.`,
        },
        ...messages,
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    throw new Error(`Grok API error: ${response.statusText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n').filter((line) => line.trim() !== '')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices[0]?.delta?.content
          if (content) {
            onChunk(content)
          }
        } catch (e) {
          // Skip parse errors
          console.error('[v0] Grok parse error:', e)
        }
      }
    }
  }
}
