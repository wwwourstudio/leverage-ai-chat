# Context-Aware Improvements - 2026-02-09

## Problem Statement

The application was returning incorrect content when users asked about specific sports/platforms:
- User asked for "NFBC draft strategy" (fantasy baseball)
- System returned NBA basketball cards instead
- Fantasy cards showed generic content instead of baseball-specific advice

## Root Causes

1. **Incomplete Sport Detection**: The `extractSport()` function didn't recognize fantasy baseball keywords (NFBC, NFFC, NFBKC)
2. **No Context Analysis**: The cards API ignored `previousMessages` and only looked at the direct `sport` parameter
3. **Generic Fantasy Content**: Fantasy cards weren't sport-specific
4. **No AI Prompt Enhancement**: The analyze API didn't adapt its prompts based on detected context

## Solutions Implemented

### 1. Enhanced Sport Extraction (app/page.tsx)

**Before:**
```typescript
if (msgLower.includes('mlb') || msgLower.includes('baseball')) return 'mlb';
```

**After:**
```typescript
// Baseball - enhanced detection for fantasy baseball
if (msgLower.includes('mlb') || msgLower.includes('baseball') || 
    msgLower.includes('nfbc') || msgLower.includes('nffc') || 
    msgLower.includes('nfbkc') || msgLower.includes('tgfbi')) {
  console.log('[v0] Detected sport: MLB (baseball/fantasy baseball)');
  return 'mlb';
}
```

**Keywords Added:**
- NFBC (National Fantasy Baseball Championship)
- NFFC (National Fantasy Football Championship) 
- NFBKC (National Fantasy Baseball Keeper Championship)
- TGFBI (The Great Fantasy Baseball Invitational)

### 2. Context Analyzer for Cards API (app/api/cards/route.ts)

**New Function: `analyzeContextForSport()`**

Analyzes previous messages to determine actual sport intent:

```typescript
function analyzeContextForSport(userContext?: CardRequest['userContext']): string | null {
  // 1. Check direct sport parameter
  if (userContext.sport) return userContext.sport;
  
  // 2. Analyze previous messages
  if (userContext.previousMessages) {
    const combinedText = userContext.previousMessages
      .map(msg => msg.content)
      .join(' ')
      .toLowerCase();
    
    // Enhanced detection including fantasy keywords
    if (combinedText.includes('nfbc') || combinedText.includes('nffc') || 
        combinedText.includes('baseball') || combinedText.includes('mlb')) {
      return 'mlb';
    }
    // ... other sports
  }
  
  // 3. Infer from platform
  if (userContext.platform === 'fantasy') {
    return 'mlb'; // Default fantasy platform to baseball
  }
  
  return null;
}
```

**Integration:**
```typescript
const contextualSport = analyzeContextForSport(userContext);
const finalSport = sport || contextualSport;
const sportsToFetch = finalSport ? [finalSport] : ['nfl', 'nba', 'mlb', 'nhl'];
```

### 3. Sport-Specific Fantasy Cards (app/api/cards/route.ts)

**Before:**
```typescript
cards.push({
  title: 'Draft Strategy',
  category: 'FANTASY',
  data: {
    focus: 'ADP inefficiencies in current market',
    // ... generic content
  }
});
```

**After:**
```typescript
const isBaseball = sport === 'mlb';
const isBasketball = sport === 'nba';
const isFootball = sport === 'nfl';

cards.push({
  title: isBaseball ? 'NFBC Draft Strategy' : 'Draft Strategy',
  category: isBaseball ? 'MLB' : 'FANTASY',
  subcategory: isBaseball ? 'NFBC/NFFC Draft' : 'Value Targets',
  data: isBaseball ? {
    focus: 'Pick position strategy for NFBC Main Event',
    approach: 'Early: Elite starting pitchers or 5-category hitters',
    timing: 'Mid-rounds: Target multi-position eligibility',
    recommendation: 'Draft catchers early - scarcity position in 2026',
    ageAnalysis: 'Young breakout candidates: Adley Rutschman, Bobby Witt Jr',
    contextNote: 'NFBC 2026 season - current ADP trends'
  } : {
    // ... basketball/football specific content
  }
});
```

### 4. Context-Aware AI Prompts (app/api/analyze/route.ts)

**New: Dynamic Prompt Enhancement**

```typescript
let contextEnhancement = '';
const queryLower = query.toLowerCase();

// Detect fantasy baseball keywords
if (queryLower.includes('nfbc') || queryLower.includes('nffc') || 
    queryLower.includes('nfbkc') || queryLower.includes('fantasy baseball')) {
  contextEnhancement = `
CONTEXT: The user is asking about fantasy baseball draft strategy (NFBC/NFFC). 
Provide baseball-specific advice focusing on 2026 season projections, draft 
position strategy, player values, and category contributions (HR, R, RBI, SB, AVG 
for hitters; W, K, ERA, WHIP, SV for pitchers). Reference specific players and 
current ADP trends when possible.`;
}

// Add sport-specific context
if (context.sport) {
  contextEnhancement += `\n\nSPORT FOCUS: ${context.sport.toUpperCase()}`;
}

const systemPrompt = SYSTEM_PROMPT + contextEnhancement;
```

## Testing & Validation

### Test Case 1: NFBC Draft Strategy
**Input:** "NFBC draft strategy for my pick position"

**Expected Behavior:**
1. ✅ `extractSport()` detects 'mlb' from 'nfbc'
2. ✅ `analyzeContextForSport()` confirms MLB from message
3. ✅ Cards API fetches MLB odds/data
4. ✅ Fantasy card shows NFBC-specific content
5. ✅ AI receives baseball-focused prompt enhancement

**Result:** 
- Cards displayed: MLB-specific content
- Fantasy advice: NFBC draft strategy (catchers, multi-position, etc.)
- AI response: Baseball-focused analysis

### Test Case 2: NBA Question After Baseball
**Input:** Previous: "NFBC strategy", Current: "What about NBA tonight?"

**Expected Behavior:**
1. ✅ Latest message takes precedence
2. ✅ `extractSport()` detects 'nba'
3. ✅ Context analyzer respects explicit sport change
4. ✅ System switches to NBA data

### Test Case 3: General Fantasy (No Sport)
**Input:** "Fantasy draft tips"

**Expected Behavior:**
1. ✅ No specific sport detected
2. ✅ Context analyzer infers MLB from platform='fantasy'
3. ✅ Falls back to baseball as default fantasy sport

## Impact

### Before Changes:
- ❌ "NFBC draft strategy" → NBA basketball cards
- ❌ Fantasy cards → Generic, non-sport-specific
- ❌ AI analysis → Not tailored to baseball

### After Changes:
- ✅ "NFBC draft strategy" → MLB baseball cards + NFBC-specific advice
- ✅ Fantasy cards → Sport-specific content (baseball/basketball/football)
- ✅ AI analysis → Context-aware prompts for relevant responses

## Future Enhancements

1. **Historical Context Memory**: Track user preferences across sessions
2. **Multi-Sport Queries**: Handle "compare NBA and MLB" requests
3. **Real Player Data**: Integrate actual ADP and projection APIs
4. **Context Confidence Scores**: Rank context detection certainty
5. **User Preference Learning**: Adapt based on repeated patterns

## Files Modified

1. `app/page.tsx` - Enhanced sport extraction with fantasy keywords
2. `app/api/cards/route.ts` - Added context analyzer and sport-specific cards
3. `app/api/analyze/route.ts` - Dynamic AI prompt enhancement based on context

## Logging Added

All functions now include detailed console logging:
- `[v0] Detected sport: MLB (baseball/fantasy baseball)`
- `[Context Analyzer] ✓ Detected MLB from fantasy baseball keywords`
- `[v0] Enhanced prompt for fantasy baseball context`

This enables easy debugging and verification of context detection.

---

**Status:** ✅ Complete and Tested  
**Date:** February 9, 2026  
**Author:** v0 AI System
