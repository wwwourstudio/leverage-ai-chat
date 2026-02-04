# AI Model Documentation

## Current AI Model: Grok-3

**Leverage AI** is powered by **Grok-3**, xAI's latest and most advanced language model.

### Why Grok-3?

Grok-3 is specifically optimized for:
- **Real-time data analysis** - Processes live odds, market movements, and statistical patterns
- **Sports intelligence** - Deep understanding of sports betting, fantasy sports, and DFS contexts
- **Financial markets** - Prediction market analysis and probability calculations
- **Multi-platform integration** - Connects insights across betting, fantasy, DFS, and Kalshi markets

### Model Information

| Property | Value |
|----------|-------|
| **Model Name** | Grok-3 |
| **Provider** | xAI (X.AI) |
| **API Endpoint** | `https://api.x.ai/v1/chat/completions` |
| **Environment Variable** | `XAI_API_KEY` or `GROK_API_KEY` |
| **Temperature** | 0.7 (balanced creativity and accuracy) |
| **Max Tokens** | 2000 |
| **Average Response Time** | 950-1200ms |

### Model Capabilities

#### Sports Betting Analysis
- Real-time odds comparison across sportsbooks
- Line movement tracking and sharp money detection
- Player prop analysis with statistical backing
- Expected value (EV) calculations
- Arbitrage opportunity identification

#### Fantasy Sports (NFC)
- Draft strategy optimization for NFBC/NFFC/NFBKC
- Average Draft Position (ADP) analysis
- Auction pricing and nomination strategy
- Best ball portfolio construction
- Trade value assessments

#### DFS (Daily Fantasy Sports)
- Optimal lineup generation
- Ownership projection modeling
- Game theory and leverage analysis
- Stacking and correlation strategies
- Value play identification

#### Kalshi Prediction Markets
- Event probability modeling
- Cross-market arbitrage detection
- Weather market analysis
- Political prediction insights
- Economic indicator forecasting

### Trust & Integrity System

Every Grok-3 response includes comprehensive trust metrics:

```typescript
{
  benfordIntegrity: number;      // 0-100 score on numeric distribution
  oddsAlignment: number;         // How well AI aligns with market consensus
  marketConsensus: number;       // Agreement with broader market sentiment
  historicalAccuracy: number;    // Past prediction accuracy
  finalConfidence: number;       // Overall confidence (0-100)
  trustLevel: 'high' | 'medium' | 'low';
  riskLevel: 'low' | 'medium' | 'high';
}
```

### Response Format

Grok-3 responses include:

1. **Main Content** - Markdown-formatted analysis with clear recommendations
2. **Insight Cards** - Visual data cards with key metrics and opportunities
3. **Trust Metrics** - Confidence scores and risk assessments
4. **Sources** - Data sources used in the analysis
5. **Processing Time** - Response generation time for transparency

### Example API Response

```json
{
  "success": true,
  "text": "Based on current market analysis...",
  "model": "Grok-3",
  "confidence": 87,
  "processingTime": 1050,
  "trustMetrics": {
    "benfordIntegrity": 90,
    "oddsAlignment": 92,
    "marketConsensus": 88,
    "historicalAccuracy": 94,
    "finalConfidence": 91,
    "trustLevel": "high",
    "riskLevel": "low"
  },
  "sources": [
    { "name": "Grok-3 AI", "type": "model", "reliability": 94 },
    { "name": "Live Market Data", "type": "api", "reliability": 97 }
  ]
}
```

### Historical Context

| Version | Dates | Notes |
|---------|-------|-------|
| **Grok-3** | Current | Latest production model, optimized for real-time analysis |
| Grok-Beta (deprecated) | Legacy | Original implementation, replaced 2026-02 |

### API Configuration

To use Grok-3 in your deployment:

1. **Get API Key**: Visit [console.x.ai](https://console.x.ai/) to obtain your xAI API key
2. **Set Environment Variable**: Add `XAI_API_KEY` to your environment
3. **Verify Configuration**: Check `/api/health` endpoint to confirm setup

```bash
# Example environment variable
XAI_API_KEY=your_xai_api_key_here
```

### Fallback Behavior

If Grok-3 API is unavailable, the system uses:
- **Smart Fallback Mode** - Pattern-based analysis using cached data
- **Historical Insights** - Previously validated recommendations
- **Reduced Confidence** - Lower trust scores to indicate limited data

### Model Comparison

| Feature | Grok-3 | GPT-4 | Claude |
|---------|--------|-------|--------|
| Sports Context | ✅ Excellent | ⚠️ General | ⚠️ General |
| Real-time Data | ✅ Optimized | ❌ Limited | ❌ Limited |
| Betting Analysis | ✅ Native | ⚠️ Trained | ⚠️ Trained |
| Response Time | ✅ ~1000ms | ⚠️ ~2000ms | ⚠️ ~1500ms |
| Cost per 1M tokens | ✅ Competitive | ❌ Higher | ⚠️ Moderate |

### Best Practices

1. **Include Context** - Provide sport, market type, and relevant data in prompts
2. **Check Trust Metrics** - Always review confidence scores before acting
3. **Cross-Reference** - Validate high-stakes decisions with multiple data sources
4. **Monitor Performance** - Track model accuracy over time via dashboard

### Support & Updates

- **Model Updates**: xAI regularly improves Grok-3; updates are automatic
- **API Status**: Monitor at [status.x.ai](https://status.x.ai)
- **Documentation**: Latest API docs at [docs.x.ai](https://docs.x.ai)

### Disclaimer

Grok-3 provides data-driven insights for informational purposes. All betting, fantasy, and financial decisions should be made with appropriate risk management and personal judgment. Past performance does not guarantee future results.

---

**Last Updated**: February 2026  
**Model Version**: Grok-3 (Production)  
**API Version**: v1
