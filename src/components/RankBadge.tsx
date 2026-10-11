const MEDALS: Record<number, string> = {
  1: 'bg-amber-400/30 text-amber-900 ring-1 ring-amber-500/40',
  2: 'bg-slate-300/60 text-slate-800 ring-1 ring-slate-400/50',
  3: 'bg-orange-300/40 text-orange-900 ring-1 ring-orange-400/40',
}

/** A place in a leaderboard; the first three get medal colours. */
export function RankBadge({ n }: { n: number }) {
  const medal = MEDALS[n]
  return (
    <span className={`w-6 h-6 shrink-0 rounded-full inline-flex items-center justify-center text-xs tabular-nums ${medal ?? 'text-gray-500'}`}>
      {n}
    </span>
  )
}
