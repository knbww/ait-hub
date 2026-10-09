export type CardId =
  | 'week'
  | 'deadlines'
  | 'events'
  | 'points'
  | 'leaderboard'
  | 'rating'
  | 'team'
  | 'projects'
  | 'joinCode'
  | 'review'

export interface CardConfig {
  id: CardId
  title: string
  visible: boolean
}
