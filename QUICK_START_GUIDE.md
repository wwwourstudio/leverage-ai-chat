# Quick Start Guide - Leverage AI

## 🚀 Getting Started in 3 Steps

### 1. Set Up API Keys
```bash
# Required environment variables
XAI_API_KEY=your_xai_api_key              # Get from console.x.ai
ODDS_API_KEY=your_odds_api_key            # Get from the-odds-api.com
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### 2. Choose Your Analysis Type
Click the platform buttons in the sidebar:
- **SPORTS BETTING** - For odds analysis and value bets
- **FANTASY (NFC)** - For NFBC/NFFC/NFBKC draft strategy
- **DFS** - (Coming soon) For optimal lineup construction
- **KALSHI** - (Coming soon) For prediction markets

### 3. Start a New Analysis
Click **"+ New Analysis"** button - you'll get a personalized welcome message based on your selected analysis type!

---

## 🤖 About the AI Model

### We Use Grok-3 (Not GPT-4)

**Grok-3** is xAI's latest AI model, specifically optimized for:
- ✅ Real-time sports data analysis
- ✅ Betting market intelligence
- ✅ Fantasy sports strategy
- ✅ DFS optimization
- ✅ Prediction market analysis

**Why Grok-3?**
- Faster response times (~1000ms vs ~2000ms)
- Better sports context understanding
- Optimized for real-time data integration
- Native support for odds and probability analysis

You'll see "Model: Grok-3" displayed at the bottom of every AI response.

---

## 💡 Dynamic Welcome Messages

When you click "New Analysis," the welcome message adapts to your selected platform:

### Sports Betting Selected:
> "Welcome to **Sports Betting Analysis** powered by **Grok-3 AI**..."
>
> Features live odds monitoring, value detection, sharp money tracking, and more.

### Fantasy Sports Selected:
> "Welcome to **Fantasy Sports (NFC) Strategy** powered by **Grok-3 AI**..."
>
> Provides draft strategy, ADP analysis, auction optimization, and best ball construction.

### All Platforms Selected (Default):
> "Welcome to **Leverage AI** - Your All-In-One Sports & Financial Intelligence Platform..."
>
> Comprehensive overview of all analysis capabilities.

**Each message is personalized to guide you through the specific features available for that analysis type!**

---

## 📊 Example Queries

### Sports Betting
```
"Show me value bets for NBA games tonight"
"What are the sharp money movements on the Lakers game?"
"Analyze player props for LeBron James"
```

### Fantasy Sports (NFC)
```
"NFBC Main Event draft strategy for pick 8"
"Show me ADP risers in the outfield"
"Auction values for premium pitchers"
```

### DFS
```
"Build an optimal DraftKings lineup for Sunday's slate"
"Find low-ownership value plays under $5K"
"Show me high-correlation stacks for tournament play"
```

### Kalshi Markets
```
"Analyze the probability of rain in NYC tomorrow"
"Show me arbitrage between Kalshi weather markets and sports totals"
"What's the edge on presidential election markets?"
```

---

## 🎯 Understanding Trust Metrics

Every Grok-3 response includes confidence scores:

```
Model: Grok-3
Processed in: 950ms

SOURCE CREDIBILITY (3 sources)
AI TRUST & INTEGRITY: 91% High Trust
```

**What this means:**
- **85%+ = High Trust** - Strong signal, low risk
- **60-84% = Medium Trust** - Moderate confidence
- **Below 60% = Low Trust** - High uncertainty, proceed with caution

---

## 🔧 Check Your Configuration

Visit `/api/health` to verify all services are configured:

```bash
curl https://your-domain.vercel.app/api/health | jq
```

**Expected response:**
```json
{
  "status": "healthy",
  "ready": true,
  "integrations": {
    "oddsAPI": { "configured": true },
    "grokAI": { "configured": true, "model": "grok-3" },
    "supabase": { "configured": true }
  }
}
```

---

## 📚 Additional Resources

### Essential Documentation
- **[AI_MODEL_DOCUMENTATION.md](./AI_MODEL_DOCUMENTATION.md)** - Complete Grok-3 details
- **[DYNAMIC_WELCOME_FEATURE.md](./DYNAMIC_WELCOME_FEATURE.md)** - How welcome messages work
- **[ENV_CONFIGURATION.md](./ENV_CONFIGURATION.md)** - Detailed setup instructions

### Troubleshooting
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and fixes
- **[API_FIX_SUMMARY.md](./API_FIX_SUMMARY.md)** - Recent bug fixes

### Need Help?
- Check the troubleshooting guide for common issues
- Verify your API keys are correctly set
- Test the `/api/health` endpoint
- Review the AI model documentation

---

## ⚡ Power User Tips

1. **Use Specific Queries** - The more context you provide, the better Grok-3's analysis
   - ❌ "What should I bet on?"
   - ✅ "Lakers vs Warriors, what's the value on the total?"

2. **Leverage Trust Metrics** - Always check the confidence score before acting on recommendations

3. **Cross-Platform Analysis** - Ask about correlations between different markets
   - "How does Kalshi weather data affect this game's total?"

4. **Follow-Up Questions** - Use suggested prompts to dive deeper into analysis

5. **Compare Sources** - When making high-stakes decisions, verify with multiple data points

---

## 🎉 You're Ready!

1. ✅ Environment variables configured
2. ✅ Analysis type selected
3. ✅ Understanding Grok-3 capabilities
4. ✅ Ready to receive personalized welcome messages

**Click "+ New Analysis" to get started!**

---

*Last Updated: February 2026*  
*Powered by Grok-3 AI*
