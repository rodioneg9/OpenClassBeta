import { useState, useEffect, useCallback, useRef } from 'react'
import type { Course, CourseWork, StudentSubmission, Announcement, Student } from '../types'

// Simple in-memory cache keyed by a string
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function fromCache<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function toCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() })
}

export function useCoursesCache(): {
  courses: Course[]
  loading: boolean
  error: string | null
  reload: () => void
} {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetch = useCallback(async (force = false) => {
    const key = 'courses'
    if (!force) {
      const cached = fromCache<Course[]>(key)
      if (cached) { setCourses(cached); return }
    }
    setLoading(true)
    setError(null)
    try {
      const data = (await window.electronAPI.classroom.getCourses()) as Course[]
      toCache(key, data)
      if (mountedRef.current) setCourses(data)
    } catch (err) {
      if (mountedRef.current) setError(String(err))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetch()
    return () => { mountedRef.current = false }
  }, [fetch])

  return { courses, loading, error, reload: () => fetch(true) }
}

export function useCourseWork(courseId: string | null): {
  courseWork: CourseWork[]
  loading: boolean
  error: string | null
} {
  const [courseWork, setCourseWork] = useState<CourseWork[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) return
    const key = `courseWork:${courseId}`
    const cached = fromCache<CourseWork[]>(key)
    if (cached) { setCourseWork(cached); return }

    let active = true
    setLoading(true)
    setError(null)
    window.electronAPI.classroom
      .getCourseWork(courseId)
      .then((data) => {
        const typed = data as CourseWork[]
        toCache(key, typed)
        if (active) setCourseWork(typed)
      })
      .catch((err) => { if (active) setError(String(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [courseId])

  return { courseWork, loading, error }
}

export function useSubmissions(courseId: string | null, courseWorkId: string | null): {
  submissions: StudentSubmission[]
  loading: boolean
  error: string | null
} {
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId || !courseWorkId) return
    const key = `submissions:${courseId}:${courseWorkId}`
    const cached = fromCache<StudentSubmission[]>(key)
    if (cached) { setSubmissions(cached); return }

    let active = true
    setLoading(true)
    setError(null)
    window.electronAPI.classroom
      .getSubmissions(courseId, courseWorkId)
      .then((data) => {
        const typed = data as StudentSubmission[]
        toCache(key, typed)
        if (active) setSubmissions(typed)
      })
      .catch((err) => { if (active) setError(String(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [courseId, courseWorkId])

  return { submissions, loading, error }
}

export function useMySubmission(courseId: string | null, courseWorkId: string | null): {
  submission: StudentSubmission | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
} {
  const [submission, setSubmission] = useState<StudentSubmission | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSubmission = useCallback(async () => {
    if (!courseId || !courseWorkId) return
    const key = `mySubmission:${courseId}:${courseWorkId}`
    setLoading(true)
    setError(null)
    try {
      const data = (await window.electronAPI.classroom.getMySubmission(
        courseId,
        courseWorkId
      )) as StudentSubmission | null
      toCache(key, data)
      setSubmission(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [courseId, courseWorkId])

  useEffect(() => {
    if (!courseId || !courseWorkId) return
    const key = `mySubmission:${courseId}:${courseWorkId}`
    const cached = fromCache<StudentSubmission | null>(key)
    if (cached !== null) {
      setSubmission(cached)
      return
    }
    void fetchSubmission()
  }, [courseId, courseWorkId, fetchSubmission])

  return {
    submission,
    loading,
    error,
    reload: fetchSubmission
  }
}

export function useAnnouncements(courseId: string | null): {
  announcements: Announcement[]
  loading: boolean
  error: string | null
} {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) return
    const key = `announcements:${courseId}`
    const cached = fromCache<Announcement[]>(key)
    if (cached) { setAnnouncements(cached); return }

    let active = true
    setLoading(true)
    setError(null)
    window.electronAPI.classroom
      .getAnnouncements(courseId)
      .then((data) => {
        const typed = data as Announcement[]
        toCache(key, typed)
        if (active) setAnnouncements(typed)
      })
      .catch((err) => { if (active) setError(String(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [courseId])

  return { announcements, loading, error }
}

export function useStudents(courseId: string | null): {
  students: Student[]
  loading: boolean
  error: string | null
} {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) return
    const key = `students:${courseId}`
    const cached = fromCache<Student[]>(key)
    if (cached) { setStudents(cached); return }

    let active = true
    setLoading(true)
    setError(null)
    window.electronAPI.classroom
      .getStudents(courseId)
      .then((data) => {
        const typed = data as Student[]
        toCache(key, typed)
        if (active) setStudents(typed)
      })
      .catch((err) => { if (active) setError(String(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [courseId])

  return { students, loading, error }
}
