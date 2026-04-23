import type { AchievementStats, Course, CourseWork, Student, StudentSubmission, StudyMaterialChunk } from '../types'
import { hasNotebookContent, type NotebookState } from '../lib/notebook'
import type { StudentAIAnalysis } from '../lib/student-ai'
import { getDueDateTime } from '../lib/dueDate'

export interface StudentStateAssignment {
  id: string
  assignmentId: string
  courseId: string
  data: CourseWork
  submission: StudentSubmission | null
  notebook: NotebookState
}

export type AssignmentStatus = 'completed' | 'overdue' | 'due-soon' | 'upcoming' | 'no-deadline'

export interface AssignmentSignal {
  assignmentKey: string
  courseId: string
  dueAt: string | null
  status: AssignmentStatus
  completion: number
  urgency: number
  risk: number
  priorityScore: number
}

export interface StudentState {
  entities: {
    coursesById: Record<string, Course>
    assignmentsByKey: Record<string, StudentStateAssignment>
    announcementsByCourseId: Record<string, string[]>
    studentsByCourseId: Record<string, Student[]>
  }
  indexes: {
    courseIds: string[]
    assignmentKeys: string[]
    assignmentKeysByCourseId: Record<string, string[]>
    assignmentKeysByStatus: Record<AssignmentStatus, string[]>
    assignmentKeysByDueDate: string[]
  }
  progress: AchievementStats
  studyMaterials: StudyMaterialChunk[]
  derived: {
    signalsByAssignmentKey: Record<string, AssignmentSignal>
  }
  ai: StudentAIAnalysis
}

export interface StudentStateInput {
  courses: Course[]
  assignments: StudentStateAssignment[]
  announcementsByCourseId: Record<string, string[]>
  studentsByCourseId: Record<string, Student[]>
  progress: AchievementStats
  studyMaterials: StudyMaterialChunk[]
  ai: StudentAIAnalysis
}

const URGENCY_DUE_SOON_BASE = 70
const URGENCY_DUE_SOON_BOOST_CAP = 28
const URGENCY_DUE_SOON_BOOST_DIVISOR = 2
const URGENCY_UPCOMING_BASE = 60
const URGENCY_UPCOMING_DIVISOR = 12
const URGENCY_UPCOMING_MIN = 10
const NOTEBOOK_RISK_BONUS_IF_EMPTY = 8
const NOTEBOOK_RISK_PENALTY_IF_PRESENT = -8
const MAX_RISK_SCORE = 100
const MAX_POINTS_RISK_WEIGHT = 0.2
const PRIORITY_URGENCY_WEIGHT = 0.7
const PRIORITY_RISK_WEIGHT = 0.3

function getAssignmentDueAt(assignment: CourseWork): Date | null {
  return getDueDateTime(assignment)
}

function evaluateSignal(assignment: StudentStateAssignment, now: Date): AssignmentSignal {
  const dueAtDate = getAssignmentDueAt(assignment.data)
  const dueAt = dueAtDate ? dueAtDate.toISOString() : null
  const submissionState = assignment.submission?.state
  const completed = submissionState === 'TURNED_IN' || submissionState === 'RETURNED'

  let status: AssignmentStatus = 'no-deadline'
  let urgency = 0
  if (completed) {
    status = 'completed'
    urgency = 0
  } else if (dueAtDate) {
    const diffHours = (dueAtDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (diffHours < 0) {
      status = 'overdue'
      urgency = 100
    } else if (diffHours <= 48) {
      status = 'due-soon'
      urgency =
        URGENCY_DUE_SOON_BASE +
        Math.max(0, URGENCY_DUE_SOON_BOOST_CAP - Math.floor(diffHours / URGENCY_DUE_SOON_BOOST_DIVISOR))
    } else {
      status = 'upcoming'
      urgency = Math.max(URGENCY_UPCOMING_MIN, URGENCY_UPCOMING_BASE - Math.floor(diffHours / URGENCY_UPCOMING_DIVISOR))
    }
  } else {
    status = 'no-deadline'
    urgency = 20
  }

  let completion = 0
  if (completed) {
    completion = 100
  } else if (submissionState === 'CREATED' || submissionState === 'RECLAIMED_BY_STUDENT') {
    completion = 40
  }
  const notebookBoost = hasNotebookContent(assignment.notebook)
    ? NOTEBOOK_RISK_PENALTY_IF_PRESENT
    : NOTEBOOK_RISK_BONUS_IF_EMPTY
  const risk =
    Math.max(0, MAX_RISK_SCORE - completion) +
    notebookBoost +
    (assignment.data.maxPoints ?? 0) * MAX_POINTS_RISK_WEIGHT
  const priorityScore = urgency * PRIORITY_URGENCY_WEIGHT + risk * PRIORITY_RISK_WEIGHT

  return {
    assignmentKey: assignment.id,
    courseId: assignment.courseId,
    dueAt,
    status,
    completion,
    urgency,
    risk,
    priorityScore
  }
}

export function buildStudentState(input: StudentStateInput): StudentState {
  const coursesById: Record<string, Course> = {}
  const assignmentsByKey: Record<string, StudentStateAssignment> = {}
  const assignmentKeysByCourseId: Record<string, string[]> = {}
  const assignmentKeysByStatus: Record<AssignmentStatus, string[]> = {
    completed: [],
    overdue: [],
    'due-soon': [],
    upcoming: [],
    'no-deadline': []
  }
  const signalsByAssignmentKey: Record<string, AssignmentSignal> = {}

  const now = new Date()
  for (const course of input.courses) {
    coursesById[course.id] = course
    assignmentKeysByCourseId[course.id] = []
  }

  for (const assignment of input.assignments) {
    assignmentsByKey[assignment.id] = assignment
    if (!assignmentKeysByCourseId[assignment.courseId]) {
      assignmentKeysByCourseId[assignment.courseId] = []
    }
    assignmentKeysByCourseId[assignment.courseId].push(assignment.id)
    const signal = evaluateSignal(assignment, now)
    signalsByAssignmentKey[assignment.id] = signal
    assignmentKeysByStatus[signal.status].push(assignment.id)
  }

  const assignmentKeysByDueDate = [...input.assignments]
    .sort((a, b) => {
      const aDue = getAssignmentDueAt(a.data)?.getTime() ?? Number.POSITIVE_INFINITY
      const bDue = getAssignmentDueAt(b.data)?.getTime() ?? Number.POSITIVE_INFINITY
      return aDue - bDue
    })
    .map((item) => item.id)

  const assignmentKeys = input.assignments.map((item) => item.id)

  return {
    entities: {
      coursesById,
      assignmentsByKey,
      announcementsByCourseId: input.announcementsByCourseId,
      studentsByCourseId: input.studentsByCourseId
    },
    indexes: {
      courseIds: input.courses.map((c) => c.id),
      assignmentKeys,
      assignmentKeysByCourseId,
      assignmentKeysByStatus,
      assignmentKeysByDueDate
    },
    progress: input.progress,
    studyMaterials: input.studyMaterials,
    derived: {
      signalsByAssignmentKey
    },
    ai: input.ai
  }
}

export interface PriorityTask {
  assignmentKey: string
  courseId: string
  title: string
  dueAt: string | null
  status: AssignmentStatus
  priorityScore: number
  completion: number
}

export function selectTopPriorityTasks(state: StudentState, limit = 5): PriorityTask[] {
  return state.indexes.assignmentKeys
    .map((assignmentKey) => {
      const assignment = state.entities.assignmentsByKey[assignmentKey]
      const signal = state.derived.signalsByAssignmentKey[assignmentKey]
      return {
        assignmentKey,
        courseId: assignment.courseId,
        title: assignment.data.title,
        dueAt: signal.dueAt,
        status: signal.status,
        priorityScore: signal.priorityScore,
        completion: signal.completion
      }
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit)
}

export interface TimelineBuckets {
  past: PriorityTask[]
  current: PriorityTask[]
  upcoming: PriorityTask[]
}

export function selectTimeline(state: StudentState): TimelineBuckets {
  const base = state.indexes.assignmentKeysByDueDate.map((assignmentKey) => {
    const assignment = state.entities.assignmentsByKey[assignmentKey]
    const signal = state.derived.signalsByAssignmentKey[assignmentKey]
    return {
      assignmentKey,
      courseId: assignment.courseId,
      title: assignment.data.title,
      dueAt: signal.dueAt,
      status: signal.status,
      priorityScore: signal.priorityScore,
      completion: signal.completion
    }
  })

  return {
    past: base.filter((task) => task.status === 'overdue' || task.status === 'completed'),
    current: base.filter((task) => task.status === 'due-soon'),
    upcoming: base.filter((task) => task.status === 'upcoming' || task.status === 'no-deadline')
  }
}

export function selectWeakTopics(state: StudentState): string[] {
  return state.ai.weakTopics
}

export function selectRecommendedNextActions(state: StudentState): string[] {
  return state.ai.recommendations.map((item) => item.action)
}
