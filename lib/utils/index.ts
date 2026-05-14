/** Returns today's date in Eastern Time as YYYY-MM-DD. */
export function getTodayDateET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Returns the default Odds API sport key for the current calendar month.
 * MLB: Mar–Oct | NFL: Sep–Feb | NBA: all other times
 */
export function getDefaultSport(): string {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 3 && month <= 10) return 'baseball_mlb';
  if (month >= 9 || month <= 2) return 'americanfootball_nfl';
  return 'basketball_nba';
}
