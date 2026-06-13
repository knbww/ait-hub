export type CardId =
  | 'courses'
  | 'leaderboard'
  | 'profile'
  | 'projectBase'
  | 'deadlines'
  | 'heatmap'
  | 'season'
  | 'referral'
  | 'challenge'
  | 'help'

export interface CardConfig {
  id: CardId
  title: string
  visible: boolean
}

export interface LeaderboardEntry {
  name: string
  aip: number
  avatar: string
  profileId?: string
}

export interface AipJournalEntry {
  id: string
  profileId: string
  memberName: string
  source: string
  delta: number
  note: string | null
  awarderName: string | null
  createdAt: string
}

export interface ResearchPaper {
  title: string
  author: string
  tags: string[]
  citations: number
}

export interface Deadline {
  event: string
  date: string
  daysLeft: number
}

export interface Course {
  courseId: string
  title: string
  instructor: string | null
  duration: string | null
  level: string | null
  syllabusUrl: string | null
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
  url: string
}

export interface Mentor {
  id?: string
  name: string
  university: string
  year: string
  role: string
}

/** Per-week progress through the season's submission lifecycle. */
export type WeekStatus = 'not_started' | 'submitted' | 'reviewed'

export interface SeasonWeek {
  id: string
  weekNumber: number
  topic: string
  description: string | null
  links: { label: string; url: string }[]
  assignmentBrief: string | null
  dueDate: string | null
}

export interface Season {
  id: string
  title: string
  description: string | null
  status: string
  weekCount: number
  weeks: SeasonWeek[]
}

export interface Submission {
  id: string
  weekId: string
  link: string
  comment: string | null
  status: 'submitted' | 'reviewed'
  passed: boolean | null
  feedback: string | null
}

export interface Challenge {
  id: string
  title: string
  description: string | null
  rules: string | null
  starterUrl: string | null
  startsAt: string | null
  deadline: string | null
  status: string
}

export interface ChallengeEntry {
  id: string
  profileId: string
  memberName: string
  link: string
  comment: string | null
  score: number | null
  place: number | null
  prizeAwarded: boolean
}

export interface TeamMemberLite {
  profileId: string
  name: string
  role: string
}

export interface Team {
  id: string
  name: string
  goal: string | null
  founderId: string
  neededRoles: string[]
  status: string
  members: TeamMemberLite[]
}

export interface TeamRequest {
  id: string
  teamId: string
  profileId: string
  name: string
  role: string
  note: string | null
}

export interface HelpRequest {
  id: string
  requesterId: string
  requesterName: string
  title: string
  description: string | null
  status: 'open' | 'claimed' | 'done'
  helperId: string | null
  helperName: string | null
}
