import type {
  Alumnus,
  Badge,
  Course,
  Deadline,
  LeaderboardEntry,
  ProofOfWorkItem,
  Project,
  ResearchPaper,
  Resource,
  SkillNode,
} from '../types'

// NOTE: Phase 1 replaces every export below with live Supabase queries.
// Until then these typed fixtures preserve the prototype's content.

export const proofOfWork: ProofOfWorkItem[] = [
  { date: 'Dec 2025', task: 'Started NLP Research', status: 'completed' },
  { date: 'Jan 2026', task: '50th GitHub Commit', status: 'completed' },
  { date: 'Feb 2026', task: 'Submit to ISEF', status: 'pending' },
]

export const leaderboardData: LeaderboardEntry[] = [
  { name: 'Akylbek Eslambek', xp: 2200, avatar: '' },
  { name: 'Steve Smith', xp: 300, avatar: '' },
  { name: 'Jom Daser', xp: 200, avatar: '' },
  { name: 'Mary Joe', xp: 120, avatar: '' },
  { name: 'Allen Winor', xp: 50, avatar: '' },
]

export const badges: Badge[] = [
  { icon: '🏆', label: 'Hackathon Winner' },
  { icon: '💻', label: '50+ LeetCode' },
  { icon: '🎯', label: '7-Week Cycle' },
]

export const researchPapers: ResearchPaper[] = [
  {
    title: 'Neural Networks in Computer Vision',
    author: 'Team Alpha',
    tags: ['Computer Vision', 'Deep Learning'],
    citations: 12,
  },
  { title: 'Ethics in AI Development', author: 'Anna Name', tags: ['Ethics', 'AI'], citations: 8 },
  { title: 'NLP for Kazakh Language', author: 'Marc Name', tags: ['NLP', 'Research'], citations: 15 },
]

export const skillNodes: SkillNode[] = [
  { skill: 'Python', level: 90, category: 'Programming' },
  { skill: 'PyTorch', level: 75, category: 'ML Framework' },
  { skill: 'Linear Algebra', level: 85, category: 'Math' },
  { skill: 'Git', level: 95, category: 'Tools' },
  { skill: 'OpenCV', level: 70, category: 'Computer Vision' },
]

export const alumni: Alumnus[] = [
  { name: 'John Doe', university: 'MIT', year: '2024', role: 'ML Engineer' },
  { name: 'Sarah Smith', university: 'Stanford', year: '2023', role: 'Research Scientist' },
]

export const deadlines: Deadline[] = [
  { event: 'ISEF Registration', date: '2026-02-15', daysLeft: 29 },
  { event: 'MIT Early Action', date: '2026-11-01', daysLeft: 288 },
  { event: 'AI Hackathon', date: '2026-03-20', daysLeft: 62 },
]

export const courses: Course[] = [
  {
    title: 'Harvard CS50 AI',
    instructor: 'David J. Malan',
    duration: '12 Weeks',
    level: 'Intermediate',
    progress: 60,
  },
]

export const projects: Project[] = [
  { title: 'Sample Project Title', progress: 75 },
  { title: 'Sample Project Title', progress: 40 },
]

export const resources: Resource[] = [
  { title: 'Cloud Credits', description: 'Google Colab Pro, AWS Credits', icon: 'zap' },
  { title: 'Templates', description: 'LaTeX, Notion Dashboards', icon: 'file-text' },
  { title: 'Datasets', description: 'Verified Research Data', icon: 'database' },
]
