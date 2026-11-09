/** Date du jour à Paris (AAAA-MM-JJ), quel que soit le fuseau du serveur. */
export function localToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);
}
