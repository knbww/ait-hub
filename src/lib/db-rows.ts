// Hand-written row shapes for the columns the UI reads. Phase-1 convenience —
// replace with `npm run db:types` generated types once the project is linked.

export interface LeaderboardRow {
  profile_id: string
  full_name: string
  avatar_url: string
  xp: number
}

export interface ResearchPaperRow {
  id: string
  author_name: string | null
  title: string
  tags: string[]
  citations: number
}

export interface DeadlineRow {
  id: string
  title: string
  due_date: string
  scope: string
}

export interface SkillRow {
  id: string
  skill: string
  level: number
  category: string | null
}

export interface ProofOfWorkRow {
  id: string
  period: string
  task: string
  status: 'completed' | 'pending'
}
