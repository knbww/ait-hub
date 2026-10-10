import type { ComponentType } from 'react'
import type { CardId } from '../types'
import { WeekCard } from './WeekCard'
import { DeadlinesCard } from './DeadlinesCard'
import { EventsCard } from './EventsCard'
import { LeaderboardCard, MyPointsCard } from './PointsCards'
import { RatingCard } from './RatingCard'
import { ProjectsCard, TeamCard } from './TeamProjectCards'
import { JoinCodeCard, ReviewCard } from './StaffCards'
import { NewsCard } from './NewsCard'
import { ProgressCard } from './ProgressCard'

/** Default order for members; staff get their tools first and no personal-progress cards. */
export const MEMBER_CARDS: CardId[] = ['week', 'progress', 'news', 'deadlines', 'events', 'points', 'leaderboard', 'rating', 'team', 'projects']
export const STAFF_CARDS: CardId[] = ['joinCode', 'review', 'progress', 'news', 'events', 'week', 'leaderboard', 'rating', 'projects']

/** i18n keys for card titles, shown in the "hidden cards" panel of layout mode. */
export const CARD_TITLES: Record<CardId, string> = {
  week: 'card.week',
  deadlines: 'card.deadlines',
  events: 'card.events',
  points: 'card.points',
  leaderboard: 'card.leaderboard',
  rating: 'card.ratingShort',
  team: 'card.team',
  projects: 'card.projects',
  joinCode: 'card.joinCode',
  review: 'card.review',
  news: 'card.news',
  progress: 'card.progress',
}

export const CARD_COMPONENTS: Record<CardId, ComponentType> = {
  week: WeekCard,
  deadlines: DeadlinesCard,
  events: EventsCard,
  points: MyPointsCard,
  leaderboard: LeaderboardCard,
  rating: RatingCard,
  team: TeamCard,
  projects: ProjectsCard,
  joinCode: JoinCodeCard,
  review: ReviewCard,
  news: NewsCard,
  progress: ProgressCard,
}
