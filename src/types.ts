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

export interface Course {
  title: string
  instructor: string | null
  duration: string | null
  level: string | null
  progress: number
}

export interface Project {
  title: string
  progress: number
}

export interface Resource {
  title: string
  description: string
  icon: string
}

export interface ProfileLinks {
  github_url: string | null
  leetcode_url: string | null
  linkedin_url: string | null
}

export interface Mentor {
  id?: string
  name: string
  university: string
  year: string
  role: string
}

export interface GithubStats {
  openPrs: number
  lastCommitAt: string | null
  series: number[]
}
