import React, { useEffect, useMemo, useState } from 'react'
import { useMySubmission } from '../hooks/useClassroom'
import { useStudentState } from '../context/StudentStateContext'
import type { Course, CourseWork, Material, SubmissionAttachment } from '../types'

interface AssignmentViewProps {
  courseId: string
  assignmentId: string
  onOpenCourse: (course: Course) => void
}

interface MaterialItem {
  url: string
  label: string
}

function formatDueDate(cw: CourseWork): string {
  if (!cw.dueDate) return 'No due date'
  const date = new Date(
    cw.dueDate.year,
    cw.dueDate.month - 1,
    cw.dueDate.day,
    cw.dueTime?.hours ?? 0,
    cw.dueTime?.minutes ?? 0
  )
  return `Due ${date.toLocaleDateString()}`
}

function getMaterialItems(materials?: Material[]): MaterialItem[] {
  return (
    materials
      ?.map((material) => {
        if (material.link?.url) return { url: material.link.url, label: material.link.title ?? material.link.url }
        if (material.driveFile?.driveFile?.alternateLink) {
          return {
            url: material.driveFile.driveFile.alternateLink,
            label: material.driveFile.driveFile.title ?? material.driveFile.driveFile.alternateLink
          }
        }
        if (material.youtubeVideo?.alternateLink) {
          return { url: material.youtubeVideo.alternateLink, label: material.youtubeVideo.title ?? 'Video' }
        }
        if (material.form?.formUrl) return { url: material.form.formUrl, label: material.form.title ?? 'Form' }
        return null
      })
      .filter((x): x is MaterialItem => x !== null) ?? []
  )
}

function attachmentLabel(attachment: SubmissionAttachment): string {
  return (
    attachment.driveFile?.title ??
    attachment.link?.title ??
    attachment.link?.url ??
    attachment.driveFile?.alternateLink ??
    'Attachment'
  )
}

function extractApiError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

export default function AssignmentView({
  courseId,
  assignmentId,
  onOpenCourse
}: AssignmentViewProps): React.ReactElement {
  const { studentState } = useStudentState()
  const [assignment, setAssignment] = useState<CourseWork | null>(null)
  const [loadingAssignment, setLoadingAssignment] = useState(true)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [unsubmitting, setUnsubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const assignmentKey = `${courseId}:${assignmentId}`
  const cachedAssignment = studentState?.entities.assignmentsByKey[assignmentKey]
  const course = studentState?.entities.coursesById[courseId]
  const materials = useMemo(() => getMaterialItems(assignment?.materials), [assignment?.materials])
  const { submission, loading: loadingSubmission, reload } = useMySubmission(courseId, assignmentId)

  useEffect(() => {
    let active = true
    const load = async (): Promise<void> => {
      setAssignmentError(null)
      if (cachedAssignment?.data) {
        setAssignment(cachedAssignment.data)
        setLoadingAssignment(false)
        return
      }
      setLoadingAssignment(true)
      try {
        const courseAssignments = (await window.electronAPI.classroom.getCourseWork(courseId)) as CourseWork[]
        const matched = courseAssignments.find((item) => item.id === assignmentId) ?? null
        if (!active) return
        if (!matched) {
          setAssignmentError('Assignment not found.')
          setAssignment(null)
        } else {
          setAssignment(matched)
        }
      } catch (err) {
        if (!active) return
        setAssignmentError(extractApiError(err))
      } finally {
        if (active) setLoadingAssignment(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [assignmentId, cachedAssignment?.data, courseId])

  const handleSubmit = async (): Promise<void> => {
    if (!submission) return
    setSubmitting(true)
    setMessage(null)
    try {
      await window.electronAPI.classroom.submitAssignment(courseId, assignmentId, submission.id)
      setMessage('Submitted successfully.')
      await reload()
    } catch (err) {
      setMessage(extractApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnsubmit = async (): Promise<void> => {
    if (!submission) return
    setUnsubmitting(true)
    setMessage(null)
    try {
      await window.electronAPI.classroom.unsubmitAssignment(courseId, assignmentId, submission.id)
      setMessage('Submission reclaimed.')
      await reload()
    } catch (err) {
      setMessage(extractApiError(err))
    } finally {
      setUnsubmitting(false)
    }
  }

  if (loadingAssignment) return <div style={{ padding: '24px 40px' }}>Loading assignment…</div>
  if (assignmentError) return <div style={{ padding: '24px 40px', color: '#d32f2f' }}>{assignmentError}</div>
  if (!assignment) return <div style={{ padding: '24px 40px' }}>Assignment unavailable.</div>

  const currentSubmissionState = submission?.state ?? 'No submission'
  const canSubmit = Boolean(submission && submission.state !== 'TURNED_IN' && submission.state !== 'RETURNED')
  const canUnsubmit = Boolean(submission && submission.state === 'TURNED_IN')

  return (
    <div style={{ padding: '24px 40px', display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>{assignment.title}</h2>
          <div style={{ color: '#5f6368', marginTop: 6 }}>
            {course?.name ?? courseId} · {formatDueDate(assignment)}
          </div>
        </div>
        {course && (
          <button type="button" onClick={() => onOpenCourse(course)}>
            Open full course
          </button>
        )}
      </div>

      <section style={{ border: '1px solid #e8eaed', borderRadius: 10, padding: 12, background: '#fff' }}>
        <h3 style={{ marginTop: 0 }}>Description</h3>
        <div style={{ whiteSpace: 'pre-wrap' }}>{assignment.description?.trim() || 'No description.'}</div>
      </section>

      <section style={{ border: '1px solid #e8eaed', borderRadius: 10, padding: 12, background: '#fff' }}>
        <h3 style={{ marginTop: 0 }}>Attachments</h3>
        {materials.length === 0 && <div>No assignment materials.</div>}
        {materials.map((item) => (
          <button
            key={`${item.url}:${item.label}`}
            type="button"
            onClick={() => void window.electronAPI.shell.openExternal(item.url)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              border: '1px solid #e8eaed',
              background: '#f8f9fa',
              borderRadius: 8,
              padding: '8px 10px',
              marginTop: 6
            }}
          >
            {item.label}
          </button>
        ))}
      </section>

      <section style={{ border: '1px solid #e8eaed', borderRadius: 10, padding: 12, background: '#fff' }}>
        <h3 style={{ marginTop: 0 }}>Submission Panel</h3>
        {loadingSubmission && <div>Loading submission…</div>}
        {!loadingSubmission && (
          <>
            <div style={{ fontSize: 14, marginBottom: 8 }}>
              Status: <b>{currentSubmissionState}</b>
            </div>
            {submission?.assignedGrade != null && (
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                Grade: <b>{submission.assignedGrade}{assignment.maxPoints != null ? ` /${assignment.maxPoints}` : ''}</b>
              </div>
            )}
            {(submission?.assignmentSubmission?.attachments?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: '#5f6368', marginBottom: 4 }}>Your attached files/links</div>
                {(submission?.assignmentSubmission?.attachments ?? []).map((attachment, index) => (
                  <div key={`${attachment.id ?? index}`} style={{ fontSize: 13 }}>
                    • {attachmentLabel(attachment)}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit || submitting}>
                {submitting ? 'Submitting…' : 'Submit Assignment'}
              </button>
              <button type="button" onClick={() => void handleUnsubmit()} disabled={!canUnsubmit || unsubmitting}>
                {unsubmitting ? 'Unsubmitting…' : 'Unsubmit'}
              </button>
            </div>
          </>
        )}
        {message && <div style={{ marginTop: 8, color: '#1a73e8' }}>{message}</div>}
      </section>
    </div>
  )
}
