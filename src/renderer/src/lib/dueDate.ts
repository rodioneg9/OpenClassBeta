import type { CourseWork } from '../types'

const DEFAULT_DUE_HOUR = 12
const DEFAULT_DUE_MINUTE = 0

export function getDueDateTime(assignment: CourseWork): Date | null {
  if (!assignment.dueDate) return null
  // Google Classroom dueDate months are 1-based (January = 1).
  return new Date(
    assignment.dueDate.year,
    assignment.dueDate.month - 1,
    assignment.dueDate.day,
    assignment.dueTime?.hours ?? DEFAULT_DUE_HOUR,
    assignment.dueTime?.minutes ?? DEFAULT_DUE_MINUTE
  )
}
