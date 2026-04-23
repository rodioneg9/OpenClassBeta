import type { AchievementStats, CourseWork } from '../types'

const STORAGE_KEY = 'openclass:achievements:v1'

const DEFAULT_STATS: AchievementStats = {
  submittedCount: 0,
  deadlinesMet: 0,
  currentStreak: 0,
  bestStreak: 0,
  subjects: {},
  unlocked: []
}

function safeParse(raw: string | null): AchievementStats {
  if (!raw) return { ...DEFAULT_STATS }
  try {
    const parsed = JSON.parse(raw) as AchievementStats
    return {
      ...DEFAULT_STATS,
      ...parsed,
      subjects: parsed.subjects ?? {},
      unlocked: parsed.unlocked ?? []
    }
  } catch {
    return { ...DEFAULT_STATS }
  }
}

function persist(stats: AchievementStats): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
}

function detectSubject(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('geometry')) return 'geometry'
  if (lower.includes('math') || lower.includes('algebra')) return 'math'
  if (lower.includes('physics')) return 'physics'
  if (lower.includes('history')) return 'history'
  if (lower.includes('chem')) return 'chemistry'
  return 'general'
}

function unlock(stats: AchievementStats, id: string): void {
  if (!stats.unlocked.includes(id)) {
    stats.unlocked.push(id)
  }
}

export function getAchievementStats(): AchievementStats {
  return safeParse(localStorage.getItem(STORAGE_KEY))
}

export function recordSubmissionAchievement(courseWork: CourseWork, submittedAtIso: string): AchievementStats {
  const stats = getAchievementStats()
  stats.submittedCount += 1

  const dueDate = courseWork.dueDate
  if (dueDate) {
    const due = new Date(
      dueDate.year,
      dueDate.month - 1,
      dueDate.day,
      courseWork.dueTime?.hours ?? 23,
      courseWork.dueTime?.minutes ?? 59
    )
    if (new Date(submittedAtIso) <= due) {
      stats.deadlinesMet += 1
    }
  }

  const last = stats.lastSubmittedAt ? new Date(stats.lastSubmittedAt) : null
  const current = new Date(submittedAtIso)
  if (last) {
    const diffMs = current.getTime() - last.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 1) {
      stats.currentStreak += 1
    } else if (diffDays > 1) {
      stats.currentStreak = 1
    }
  } else {
    stats.currentStreak = 1
  }
  stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak)
  stats.lastSubmittedAt = submittedAtIso

  const subject = detectSubject(`${courseWork.title} ${courseWork.description ?? ''}`)
  stats.subjects[subject] = (stats.subjects[subject] ?? 0) + 1

  if (stats.submittedCount >= 1) unlock(stats, 'first-submission')
  if (stats.deadlinesMet >= 3) unlock(stats, 'deadline-survivor')
  if (stats.currentStreak >= 5) unlock(stats, 'consistent-student')
  Object.entries(stats.subjects).forEach(([name, count]) => {
    if (count >= 3) unlock(stats, `subject-mastery:${name}`)
  })

  persist(stats)
  return stats
}
