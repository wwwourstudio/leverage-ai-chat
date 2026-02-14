/**
 * Historical Data Backfill Script
 * Imports past seasons of game results and odds data
 */

import { scrapeESPNGameResults, importHistoricalOdds } from '@/lib/historical-data-scraper';

const SPORTS = ['NFL', 'NBA', 'MLB', 'NHL'];
const START_DATE = '2021-01-01';
const END_DATE = '2026-01-01';

async function backfillHistoricalData() {
  console.log('Starting historical data backfill...');
  console.log(`Date range: ${START_DATE} to ${END_DATE}`);
  console.log(`Sports: ${SPORTS.join(', ')}`);
  
  for (const sport of SPORTS) {
    console.log(`\n=== Processing ${sport} ===`);
    
    try {
      // Scrape game results from ESPN
      console.log(`Fetching ${sport} game results...`);
      const results = await scrapeESPNGameResults(
        sport,
        new Date(START_DATE),
        new Date(END_DATE)
      );
      console.log(`✓ Scraped ${results.length} ${sport} games`);
      
      // Import historical odds if available
      console.log(`Fetching ${sport} historical odds...`);
      const odds = await importHistoricalOdds(
        sport,
        new Date(START_DATE),
        new Date(END_DATE)
      );
      console.log(`✓ Imported ${odds.length} ${sport} odds records`);
      
    } catch (error) {
      console.error(`✗ Error processing ${sport}:`, error);
    }
  }
  
  console.log('\n=== Backfill Complete ===');
}

// Run if called directly
if (require.main === module) {
  backfillHistoricalData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { backfillHistoricalData };
