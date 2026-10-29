// Regras: só apostas ganhas/perdidas contam para as estatísticas.
export const totalOdd = (b) => b.legs.reduce((a, l) => a * l.odd, 1);
export const profitOf = (b) =>
  b.status === "won" ? b.stake * totalOdd(b) - b.stake : b.status === "lost" ? -b.stake : 0;
const sportOf = (b) => (new Set(b.legs.map((l) => l.sport)).size > 1 ? "Mistas" : b.legs[0].sport);

export function computeStats(bets) {
  const settled = bets.filter((b) => b.status === "won" || b.status === "lost");
  const won = settled.filter((b) => b.status === "won").length;
  const stake = settled.reduce((a, b) => a + b.stake, 0);
  const profit = settled.reduce((a, b) => a + profitOf(b), 0);

  let acc = 0;
  const series = [...settled]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .map((b) => ({ date: b.date, profit: (acc += profitOf(b)) }));

  const group = (keyFn) => {
    const m = new Map();
    for (const b of settled) {
      const k = keyFn(b);
      const o = m.get(k) ?? { key: k, bets: 0, won: 0, lost: 0, stake: 0, profit: 0 };
      o.bets++; o.stake += b.stake; o.profit += profitOf(b);
      b.status === "won" ? o.won++ : o.lost++;
      m.set(k, o);
    }
    return [...m.values()]
      .map((o) => ({ ...o, winRate: o.won / o.bets, roi: o.stake ? o.profit / o.stake : 0 }))
      .sort((a, b) => b.bets - a.bets);
  };

  return {
    profit, stake, returned: stake + profit, won, lost: settled.length - won,
    winRate: settled.length ? won / settled.length : 0,
    void: bets.filter((b) => b.status === "void").length,
    pending: bets.filter((b) => b.status === "pending").length,
    series, bySport: group(sportOf),
    byMonth: group((b) => b.date.slice(0, 7)).sort((a, b) => b.key.localeCompare(a.key)),
  };
}
