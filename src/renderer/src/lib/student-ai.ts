import type { StudentStateAssignment } from '../state/student-state'
import { getDueDateTime } from './dueDate'
import { hasNotebookContent } from './notebook'

export interface AIRecommendation {
  assignmentKey?: string
  courseId?: string
  action: string
  reason: string
}

export interface StudentAIAnalysis {
  workloadPrediction: {
    level: 'low' | 'moderate' | 'high'
    summary: string
  }
  weakTopics: string[]
  recommendations: AIRecommendation[]
  assignmentAnnotations: Record<string, { risk: number; note: string }>
  courseAnnotations: Record<string, { workload: number; note: string }>
}

const PENDING_HIGH_THRESHOLD = 8
const DUE_SOON_HIGH_THRESHOLD = 4
const PENDING_MODERATE_THRESHOLD = 4
const DUE_SOON_MODERATE_THRESHOLD = 2
const INCOMPLETE_RISK_WEIGHT = 0.8
const NOTEBOOK_RISK_PENALTY = -0.1
const NOTEBOOK_RISK_BONUS = 0.1

function detectTopic(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('algebra') || lower.includes('math')) return 'math'
  if (lower.includes('physics')) return 'physics'
  if (lower.includes('history')) return 'history'
  if (lower.includes('chem')) return 'chemistry'
  if (lower.includes('language') || lower.includes('essay')) return 'writing'
  return 'general'
}

export function analyzeStudentStateSnapshot(input: {
  assignments: StudentStateAssignment[]
  courseNamesById: Record<string, string>
}): StudentAIAnalysis {
  const pending = input.assignments.filter((item) => {
    const state = item.submission?.state
    return state !== 'TURNED_IN' && state !== 'RETURNED'
  })
  const dueSoonCount = pending.filter((item) => {
    const due = getDueDateTime(item.data)
    if (!due) return false
    return due.getTime() - Date.now() <= 1000 * 60 * 60 * 48
  }).length

  let level: 'low' | 'moderate' | 'high' = 'low'
  if (pending.length >= PENDING_HIGH_THRESHOLD || dueSoonCount >= DUE_SOON_HIGH_THRESHOLD) {
    level = 'high'
  } else if (pending.length >= PENDING_MODERATE_THRESHOLD || dueSoonCount >= DUE_SOON_MODERATE_THRESHOLD) {
    level = 'moderate'
  }

  const topicCounts: Record<string, number> = {}
  for (const assignment of pending) {
    const topic = detectTopic(`${assignment.data.title} ${assignment.data.description ?? ''}`)
    topicCounts[topic] = (topicCounts[topic] ?? 0) + 1
  }
  const weakTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic)

  const recommendations: AIRecommendation[] = pending.slice(0, 5).map((assignment) => ({
    assignmentKey: assignment.id,
    courseId: assignment.courseId,
    action: `Work on "${assignment.data.title}" next`,
    reason: assignment.data.dueDate ? 'Upcoming deadline and incomplete submission.' : 'Incomplete and needs progress.'
  }))

  const assignmentAnnotations: Record<string, { risk: number; note: string }> = {}
  const courseRiskTotals: Record<string, { total: number; count: number }> = {}
  for (const assignment of input.assignments) {
    const isIncomplete =
      assignment.submission?.state !== 'TURNED_IN' && assignment.submission?.state !== 'RETURNED'
    const incomplete = isIncomplete ? 1 : 0
    const notebookSignal = hasNotebookContent(assignment.notebook)
      ? NOTEBOOK_RISK_PENALTY
      : NOTEBOOK_RISK_BONUS
    const risk = Math.min(1, Math.max(0, incomplete * INCOMPLETE_RISK_WEIGHT + notebookSignal))
    assignmentAnnotations[assignment.id] = {
      risk,
      note: risk > 0.7 ? 'High risk: incomplete with limited notebook evidence.' : 'Progressing.'
    }
    if (!courseRiskTotals[assignment.courseId]) {
      courseRiskTotals[assignment.courseId] = { total: 0, count: 0 }
    }
    courseRiskTotals[assignment.courseId].total += risk
    courseRiskTotals[assignment.courseId].count += 1
  }

  const courseAnnotations: Record<string, { workload: number; note: string }> = {}
  for (const [courseId, value] of Object.entries(courseRiskTotals)) {
    const workload = value.count ? value.total / value.count : 0
    const courseName = input.courseNamesById[courseId] ?? courseId
    courseAnnotations[courseId] = {
      workload,
      note: workload > 0.7 ? `${courseName} needs immediate attention.` : `${courseName} is manageable.`
    }
  }

  return {
    workloadPrediction: {
      level,
      summary: `${pending.length} incomplete tasks, ${dueSoonCount} due within 48h.`
    },
    weakTopics,
    recommendations,
    assignmentAnnotations,
    courseAnnotations
  }
}
