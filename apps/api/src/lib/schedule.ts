/** Round-robin pairings (circle method). rounds=2 gives home & away legs. */
export function roundRobin(teamIds: string[], rounds: number) {
  const t = [...teamIds];
  if (t.length % 2) t.push('BYE');
  const n = t.length;
  const pairs: [string, string][] = [];
  for (let leg = 0; leg < rounds; leg++) {
    const arr = [...t];
    for (let round = 0; round < n - 1; round++) {
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        if (a === 'BYE' || b === 'BYE') continue;
        const home = (round + i + leg) % 2 === 0;
        pairs.push(home ? [a, b] : [b, a]);
      }
      arr.splice(1, 0, arr.pop()!);
    }
  }
  return pairs;
}
