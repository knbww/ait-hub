import { rpc } from './mutate'
import type { PointsCategory } from './db'

/** Staff add an AIT Points entry by hand (there is no automatic price list yet). */
export const awardPoints = (profileId: string, amount: number, category: PointsCategory, note: string) =>
  rpc<string>('award_points', { p_profile: profileId, p_amount: amount, p_category: category, p_note: note.trim() }, [
    ['points'],
  ])
