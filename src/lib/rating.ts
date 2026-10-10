// Rating history for charts: results in date order with the running total after each event.

export interface RatedResult {
  id: string
  place: number | null
  rating_delta: number
  event: { title: string; starts_at: string } | null
}

export interface RatingPointData {
  id: string
  date: string
  title: string
  place: number | null
  delta: number
  total: number
}

export function toRatingPoints(results: RatedResult[]): RatingPointData[] {
  const ordered = results.filter((r) => r.event)
    .sort((a, b) => a.event!.starts_at.localeCompare(b.event!.starts_at))
  const points: RatingPointData[] = []
  let total = 0
  for (const r of ordered) {
    total += r.rating_delta
    points.push({ id: r.id, date: r.event!.starts_at, title: r.event!.title, place: r.place, delta: r.rating_delta, total })
  }
  return points
}
