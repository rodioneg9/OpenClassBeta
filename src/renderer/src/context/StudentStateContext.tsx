import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Course, CourseWork, Student, StudentSubmission } from '../types'
import { getAchievementStats, recordSubmissionAchievement } from '../lib/achievements'
import { getNotebookState } from '../lib/notebook'
import { loadStudyMaterialChunks } from '../lib/studyMaterials'
import { analyzeStudentStateSnapshot } from '../lib/student-ai'
import {
  buildStudentState,
  type StudentState,
  type StudentStateAssignment,
  selectRecommendedNextActions,
  selectTimeline,
  selectTopPriorityTasks,
  selectWeakTopics
} from '../state/student-state'

interface StudentStateContextValue {
  studentState: StudentState | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  submitAssignmentFromFocus: (assignmentKey: string) => Promise<void>
  selectors: {
    topPriorityTasks: ReturnType<typeof selectTopPriorityTasks>
    timeline: ReturnType<typeof selectTimeline> | null
    weakTopics: string[]
    recommendedNextActions: string[]
  }
}

const StudentStateContext = createContext<StudentStateContextValue | null>(null)

async function loadAssignmentsForCourse(courseId: string): Promise<CourseWork[]> {
  const data = (await window.electronAPI.classroom.getCourseWork(courseId)) as CourseWork[]
  return data
}

async function loadMySubmissionForAssignment(
  courseId: string,
  assignmentId: string
): Promise<StudentSubmission | null> {
  try {
    return (await window.electronAPI.classroom.getMySubmission(courseId, assignmentId)) as StudentSubmission | null
  } catch {
    return null
  }
}

export function StudentStateProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [studentState, setStudentState] = useState<StudentState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const courses = (await window.electronAPI.classroom.getCourses()) as Course[]
      const assignments: StudentStateAssignment[] = []
      const announcementsByCourseId: Record<string, string[]> = {}
      const studentsByCourseId: Record<string, Student[]> = {}

      await Promise.all(
        courses.map(async (course) => {
          const [courseAssignments, announcements, students] = await Promise.all([
            loadAssignmentsForCourse(course.id),
            window.electronAPI.classroom.getAnnouncements(course.id) as Promise<unknown[]>,
            window.electronAPI.classroom.getStudents(course.id) as Promise<unknown[]>
          ])
          announcementsByCourseId[course.id] = (announcements as Array<{ id: string }>).map((item) => item.id)
          studentsByCourseId[course.id] = students as Student[]

          const submissionEntries = await Promise.all(
            courseAssignments.map(async (assignment) => ({
              assignment,
              submission: await loadMySubmissionForAssignment(course.id, assignment.id)
            }))
          )

          submissionEntries.forEach(({ assignment, submission }) => {
            assignments.push({
              id: `${course.id}:${assignment.id}`,
              assignmentId: assignment.id,
              courseId: course.id,
              data: assignment,
              submission,
              notebook: getNotebookState(course.id, assignment.id)
            })
          })
        })
      )

      const courseNamesById = Object.fromEntries(courses.map((course) => [course.id, course.name]))
      const ai = analyzeStudentStateSnapshot({ assignments, courseNamesById })
      const nextState = buildStudentState({
        courses,
        assignments,
        announcementsByCourseId,
        studentsByCourseId,
        progress: getAchievementStats(),
        studyMaterials: loadStudyMaterialChunks(),
        ai
      })
      setStudentState(nextState)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const submitAssignmentFromFocus = useCallback(
    async (assignmentKey: string) => {
      if (!studentState) return
      const assignment = studentState.entities.assignmentsByKey[assignmentKey]
      const submission = assignment?.submission
      if (!assignment || !submission) return
      await window.electronAPI.classroom.submitAssignment(
        assignment.courseId,
        assignment.assignmentId,
        submission.id
      )
      recordSubmissionAchievement(assignment.data, new Date().toISOString())
      await refresh()
    },
    [refresh, studentState]
  )

  const selectors = useMemo(
    () => ({
      topPriorityTasks: studentState ? selectTopPriorityTasks(studentState, 6) : [],
      timeline: studentState ? selectTimeline(studentState) : null,
      weakTopics: studentState ? selectWeakTopics(studentState) : [],
      recommendedNextActions: studentState ? selectRecommendedNextActions(studentState) : []
    }),
    [studentState]
  )

  return (
    <StudentStateContext.Provider
      value={{
        studentState,
        loading,
        error,
        refresh,
        submitAssignmentFromFocus,
        selectors
      }}
    >
      {children}
    </StudentStateContext.Provider>
  )
}

export function useStudentState(): StudentStateContextValue {
  const context = useContext(StudentStateContext)
  if (!context) {
    throw new Error('useStudentState must be used inside StudentStateProvider')
  }
  return context
}
