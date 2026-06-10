export type CardId =
  | 'courses'
  | 'pow'
  | 'pulse'
  | 'leaderboard'
  | 'profile'
  | 'projectBase'
  | 'skills'
  | 'wallOfProof'
  | 'deadlines'
  | 'heatmap'

export interface CardConfig {
  id: CardId
  title: string
  visible: boolean
}

export interface ProofOfWorkItem {
  date: string
  task: string
  status: 'completed' | 'pending'
}

export interface LeaderboardEntry {
  name: string
  xp: number
  avatar: string
}

export interface Badge {
  icon: string
  label: string
}

export interface ResearchPaper {
  title: string
  author: string
  tags: string[]
  citations: number
}

export interface SkillNode {
  skill: string
  level: number
  category: string
}

export interface Alumnus {
  name: string
  university: string
  year: string
  role: string
}

export interface Deadline {
  event: string
  date: string
  daysLeft: number
}
