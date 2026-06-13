import type { ComponentType } from 'react'
import type { CardId } from '../types'
import { SeasonProgressCard } from './SeasonProgressCard'
import { ChallengeCard } from './ChallengeCard'
import { HelpBoardCard } from './HelpBoardCard'
import { ReferralCard } from './ReferralCard'
import { CoursesCard } from './CoursesCard'
import { LeaderboardCard } from './LeaderboardCard'
import { ProfileCard } from './ProfileCard'
import { ProjectBaseCard } from './ProjectBaseCard'
import { DeadlinesCard } from './DeadlinesCard'
import { ActivityHeatmapCard } from './ActivityHeatmapCard'

/** Default render order for the dashboard grid. */
export const CARD_ORDER: CardId[] = [
  'season',
  'challenge',
  'help',
  'referral',
  'courses',
  'leaderboard',
  'profile',
  'projectBase',
  'deadlines',
  'heatmap',
]

/** i18n keys for card titles, shown in the "Available widgets" re-add panel. */
export const CARD_TITLES: Record<CardId, string> = {
  season: 'card.season',
  challenge: 'card.challenge',
  help: 'card.help',
  referral: 'card.referral',
  courses: 'card.courses',
  leaderboard: 'card.leaderboard',
  profile: 'card.profile',
  projectBase: 'card.projectBase',
  deadlines: 'card.deadlines',
  heatmap: 'card.heatmap',
}

/** Maps each card id to the component that renders its body. */
export const CARD_COMPONENTS: Record<CardId, ComponentType> = {
  season: SeasonProgressCard,
  challenge: ChallengeCard,
  help: HelpBoardCard,
  referral: ReferralCard,
  courses: CoursesCard,
  leaderboard: LeaderboardCard,
  profile: ProfileCard,
  projectBase: ProjectBaseCard,
  deadlines: DeadlinesCard,
  heatmap: ActivityHeatmapCard,
}
