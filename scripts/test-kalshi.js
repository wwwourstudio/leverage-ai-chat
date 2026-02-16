const BASE_URL = 'https://api.elections.kalshi.com/trade-api/v2';

async function testKalshi() {
  console.log('Testing Kalshi API with correct URL...');
  console.log('URL:', `${BASE_URL}/markets?limit=10&status=open`);
  
  try {
    const response = await fetch(`${BASE_URL}/markets?limit=10&status=open`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    
    console.log('Status:', response.status, response.statusText);
    
    if (!response.ok) {
      const text = await response.text();
      console.error('Error:', text.substring(0, 500));
      return;
    }
    
    const data = await response.json();
    console.log('Markets count:', data.markets?.length || 0);
    
    if (data.markets && data.markets.length > 0) {
      console.log('\nSample markets:');
      data.markets.slice(0, 5).forEach((m, i) => {
        console.log(`${i+1}. ${m.title}`);
        console.log(`   Category: ${m.category || m.series_ticker}`);
        console.log(`   Yes: ${m.yes_bid ?? m.yes_ask ?? m.last_price ?? 'N/A'}c`);
        console.log(`   No: ${m.no_bid ?? m.no_ask ?? 'N/A'}c`);
        console.log(`   Volume: ${m.volume ?? m.volume_24h ?? 0}`);
        console.log(`   Status: ${m.status}`);
      });
      
      console.log('\nAll categories:', [...new Set(data.markets.map(m => m.category || m.series_ticker))].join(', '));
    }
    
    // Also test scores endpoint for NBA
    console.log('\n\n--- Testing Odds API Scores Endpoint ---');
    const oddsKey = process.env.ODDS_API_KEY;
    if (!oddsKey) {
      console.log('ODDS_API_KEY not set, skipping');
      return;
    }
    
    const scoresUrl = `https://api.the-odds-api.com/v4/sports/basketball_nba/scores/?apiKey=${oddsKey}&daysFrom=3`;
    console.log('Fetching NBA scores...');
    
    const scoresResp = await fetch(scoresUrl);
    console.log('Scores status:', scoresResp.status);
    
    if (scoresResp.ok) {
      const scores = await scoresResp.json();
      console.log(`NBA scores: ${scores.length} games from last 3 days`);
      
      if (scores.length > 0) {
        scores.slice(0, 3).forEach((g, i) => {
          const completed = g.completed ? 'FINAL' : 'UPCOMING';
          let scoreText = '';
          if (g.scores) {
            const home = g.scores.find(s => s.name === g.home_team);
            const away = g.scores.find(s => s.name === g.away_team);
            scoreText = ` | ${away?.name} ${away?.score} - ${home?.score} ${home?.name}`;
          }
          console.log(`${i+1}. [${completed}] ${g.away_team} @ ${g.home_team}${scoreText}`);
        });
      }
    }
    
    // Also try NHL
    const nhlUrl = `https://api.the-odds-api.com/v4/sports/icehockey_nhl/scores/?apiKey=${oddsKey}&daysFrom=3`;
    const nhlResp = await fetch(nhlUrl);
    if (nhlResp.ok) {
      const nhlScores = await nhlResp.json();
      console.log(`\nNHL scores: ${nhlScores.length} games from last 3 days`);
      if (nhlScores.length > 0) {
        nhlScores.slice(0, 3).forEach((g, i) => {
          const completed = g.completed ? 'FINAL' : 'UPCOMING';
          console.log(`${i+1}. [${completed}] ${g.away_team} @ ${g.home_team}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testKalshi();
