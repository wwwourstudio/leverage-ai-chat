const apiKey = process.env.ODDS_API_KEY;
const baseUrl = 'https://api.the-odds-api.com/v4';

async function main() {
  // 1. Get ALL available sports
  console.log('=== FETCHING ALL AVAILABLE SPORTS ===');
  const sportsRes = await fetch(`${baseUrl}/sports/?apiKey=${apiKey}`);
  const sports = await sportsRes.json();
  
  console.log(`Total sports available: ${sports.length}\n`);
  
  const activeSports = sports.filter(s => s.active);
  const inactiveSports = sports.filter(s => !s.active);
  
  console.log(`Active sports (${activeSports.length}):`);
  activeSports.forEach(s => {
    console.log(`  [ACTIVE] ${s.key} - ${s.title} (group: ${s.group})`);
  });
  
  console.log(`\nInactive sports (${inactiveSports.length}):`);
  inactiveSports.forEach(s => {
    console.log(`  [OFF] ${s.key} - ${s.title} (group: ${s.group})`);
  });

  // 2. For each ACTIVE sport, fetch odds + scores
  console.log('\n\n=== FETCHING ODDS FOR ACTIVE SPORTS ===');
  for (const sport of activeSports.slice(0, 8)) {
    console.log(`\n--- ${sport.title} (${sport.key}) ---`);
    
    // Odds
    const oddsRes = await fetch(`${baseUrl}/sports/${sport.key}/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`);
    if (oddsRes.ok) {
      const odds = await oddsRes.json();
      console.log(`  Odds: ${odds.length} upcoming games`);
      if (odds.length > 0) {
        const game = odds[0];
        console.log(`    Sample: ${game.away_team} @ ${game.home_team} (${game.commence_time})`);
        if (game.bookmakers && game.bookmakers[0]) {
          const book = game.bookmakers[0];
          console.log(`    Bookmaker: ${book.title}, Markets: ${book.markets.map(m => m.key).join(', ')}`);
        }
      }
    } else {
      console.log(`  Odds ERROR: ${oddsRes.status}`);
    }
    
    // Scores
    const scoresRes = await fetch(`${baseUrl}/sports/${sport.key}/scores/?apiKey=${apiKey}&daysFrom=3`);
    if (scoresRes.ok) {
      const scores = await scoresRes.json();
      const completed = scores.filter(g => g.completed);
      const upcoming = scores.filter(g => !g.completed);
      console.log(`  Scores: ${scores.length} total (${completed.length} completed, ${upcoming.length} upcoming)`);
      if (completed.length > 0) {
        const g = completed[0];
        const hs = g.scores?.find(s => s.name === g.home_team);
        const as = g.scores?.find(s => s.name === g.away_team);
        console.log(`    Recent: ${g.away_team} ${as?.score || '?'} @ ${g.home_team} ${hs?.score || '?'} (FINAL)`);
      }
    }
  }

  // 3. Test player props for an active sport with games
  console.log('\n\n=== TESTING PLAYER PROPS ===');
  const nbaOdds = await fetch(`${baseUrl}/sports/basketball_nba/odds/?apiKey=${apiKey}&regions=us&markets=player_points,player_rebounds,player_assists,player_threes,player_blocks,player_steals,player_turnovers&oddsFormat=american`);
  if (nbaOdds.ok) {
    const nbaProps = await nbaOdds.json();
    console.log(`NBA Player Props: ${nbaProps.length} games with props`);
    if (nbaProps.length > 0 && nbaProps[0].bookmakers?.length > 0) {
      const book = nbaProps[0].bookmakers[0];
      console.log(`  Bookmaker: ${book.title}`);
      console.log(`  Prop markets: ${book.markets.map(m => m.key).join(', ')}`);
      if (book.markets[0]) {
        console.log(`  Sample prop (${book.markets[0].key}):`);
        book.markets[0].outcomes.slice(0, 3).forEach(o => {
          console.log(`    ${o.description}: ${o.name} ${o.point} (${o.price > 0 ? '+' : ''}${o.price})`);
        });
      }
    }
  } else {
    console.log(`NBA Props ERROR: ${nbaOdds.status}`);
  }
  
  // Also test NHL props
  const nhlOdds = await fetch(`${baseUrl}/sports/icehockey_nhl/odds/?apiKey=${apiKey}&regions=us&markets=player_points,player_goals,player_assists,player_shots_on_goal,player_blocked_shots&oddsFormat=american`);
  if (nhlOdds.ok) {
    const nhlProps = await nhlOdds.json();
    console.log(`\nNHL Player Props: ${nhlProps.length} games with props`);
    if (nhlProps.length > 0 && nhlProps[0].bookmakers?.length > 0) {
      const book = nhlProps[0].bookmakers[0];
      console.log(`  Prop markets: ${book.markets.map(m => m.key).join(', ')}`);
    }
  }

  // 4. Check remaining API quota
  console.log('\n\nRemaining requests header:', sportsRes.headers.get('x-requests-remaining'));
  console.log('Used requests header:', sportsRes.headers.get('x-requests-used'));
}

main().catch(console.error);
