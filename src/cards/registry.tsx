import type { ComponentType } from 'react'
import type { CardId } from '../types'
import { CoursesCard } from './CoursesCard'
import { ProofOfWorkCard } from './ProofOfWorkCard'
import { ProjectPulseCard } from './ProjectPulseCard'
import { LeaderboardCard } from './LeaderboardCard'
import { ProfileCard } from './ProfileCard'
import { ProjectBaseCard } from './ProjectBaseCard'
import { SkillMatrixCard } from './SkillMatrixCard'
import { WallOfProofCard } from './WallOfProofCard'
import { DeadlinesCard } from './DeadlinesCard'
import { ActivityHeatmapCard } from './ActivityHeatmapCard'

/** Default render order for the dashboard grid. */
export const CARD_ORDER: CardId[] = [
  'courses',
  'pow',
  'pulse',
  'leaderboard',
  'profile',
  'projectBase',
  'skills',
  'wallOfProof',
  'deadlines',
  'heatmap',
]

/** Human-readable titles, shown in the "Available widgets" re-add panel. */
export const CARD_TITLES: Record<CardId, string> = {
  courses: 'My Courses',
  pow: 'Proof of Work',
  pulse: 'Project Pulse',
  leaderboard: 'Leaderboard & XP',
  profile: 'Member Profile',
  projectBase: 'Project Base',
  skills: 'Skill Matrix',
  wallOfProof: 'Wall of Proof',
  deadlines: 'Upcoming Deadlines',
  heatmap: 'Activity Heatmap',
}

/** Maps each card id to the component that renders its body. */
export const CARD_COMPONENTS: Record<CardId, ComponentType> = {
  courses: CoursesCard,
  pow: ProofOfWorkCard,
  pulse: ProjectPulseCard,
  leaderboard: LeaderboardCard,
  profile: ProfileCard,
  projectBase: ProjectBaseCard,
  skills: SkillMatrixCard,
  wallOfProof: WallOfProofCard,
  deadlines: DeadlinesCard,
  heatmap: ActivityHeatmapCard,
}
