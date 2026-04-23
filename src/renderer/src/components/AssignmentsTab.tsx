import React, { useState } from 'react'
import { useCourseWork, useSubmissions } from '../hooks/useClassroom'
import type { CourseWork } from '../types'

interface AssignmentsTabProps {
  courseId: string
}

const styles: Record<string, React.CSSProperties> = {
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: '#fff',
    border: '1px solid #e8eaed',
    borderRadius: 10,
    padding: '16px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  title: { fontSize: 15, fontWeight: 600, color: '#202124', margin: 0 },
  meta: { fontSize: 13, color: '#80868b', marginTop: 4 },
  badge: (state: string): React.CSSProperties => ({
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    background:
      state === 'TURNED_IN' ? '#e6f4ea' :
      state === 'RETURNED' ? '#e8f0fe' : '#fce8e6',
    color:
      state === 'TURNED_IN' ? '#137333' :
      state === 'RETURNED' ? '#1a73e8' : '#c5221f'
  }),
  expandBtn: {
    marginTop: 12,
    background: 'none',
    border: '1px solid #dadce0',
    borderRadius: 6,
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 13,
    color: '#1a73e8',
    fontWeight: 500
  },
  submitBtn: {
    marginTop: 8,
    background: '#1a73e8',
    border: 'none',
    borderRadius: 6,
    padding: '8px 18px',
    cursor: 'pointer',
    fontSize: 13,
    color: '#fff',
    fontWeight: 600
  },
  submissionsBox: {
    marginTop: 12,
    background: '#f8f9fa',
    borderRadius: 8,
    padding: '12px 16px'
  },
  subItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: '#202124',
    padding: '4px 0',
    borderBottom: '1px solid #e8eaed'
  },
  loading: { color: '#80868b', fontSize: 14, padding: '24px 0', textAlign: 'center' },
  error: { color: '#d32f2f', fontSize: 14, background: '#fdecea', borderRadius: 8, padding: 12 },
  empty: { color: '#80868b', fontSize: 14, textAlign: 'center', paddingTop: 40 }
}

function formatDueDate(cw: CourseWork): string {
  if (!cw.dueDate) return 'No due date'
  const { year, month, day } = cw.dueDate
  return `Due ${month}/${day}/${year}`
}

function AssignmentCard({ courseId, cw }: { courseId: string; cw: CourseWork }): React.ReactElement {
  const [expanded, setExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)
  const { submissions, loading } = useSubmissions(expanded ? courseId : null, expanded ? cw.id : null)

  const mySubmission = submissions.length > 0 ? submissions[0] : undefined

  const handleSubmit = async () => {
    if (!mySubmission) return
    setSubmitting(true)
    setSubmitMsg(null)
    try {
      await window.electronAPI.classroom.submitAssignment(courseId, cw.id, mySubmission.id)
      setSubmitMsg('Turned in successfully!')
    } catch (err) {
      setSubmitMsg(`Error: ${String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <div style={styles.title}>{cw.title}</div>
          <div style={styles.meta}>
            {cw.workType} · {formatDueDate(cw)}
            {cw.maxPoints != null && ` · ${cw.maxPoints} pts`}
          </div>
        </div>
        {mySubmission?.state && (
          <span style={styles.badge(mySubmission.state)}>{mySubmission.state.replace('_', ' ')}</span>
        )}
      </div>

      {cw.description && (
        <div style={{ ...styles.meta, marginTop: 8, whiteSpace: 'pre-wrap' }}>{cw.description}</div>
      )}

      <button style={styles.expandBtn} onClick={() => setExpanded((e) => !e)}>
        {expanded ? 'Hide submission' : 'View submission'}
      </button>

      {expanded && (
        <div style={styles.submissionsBox}>
          {loading && <div style={styles.loading}>Loading…</div>}
          {mySubmission && (
            <>
              <div style={styles.subItem}>
                <span>State</span>
                <span>{mySubmission.state ?? '—'}</span>
              </div>
              {mySubmission.assignedGrade != null && (
                <div style={styles.subItem}>
                  <span>Grade</span>
                  <span>{mySubmission.assignedGrade}{cw.maxPoints != null ? `/${cw.maxPoints}` : ''}</span>
                </div>
              )}
              {mySubmission.late && (
                <div style={{ ...styles.meta, color: '#c5221f', marginTop: 6 }}>Late submission</div>
              )}
              {mySubmission.state !== 'TURNED_IN' && mySubmission.state !== 'RETURNED' && (
                <button style={styles.submitBtn} onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Turning in…' : 'Turn In'}
                </button>
              )}
              {submitMsg && <div style={{ ...styles.meta, marginTop: 6 }}>{submitMsg}</div>}
            </>
          )}
          {!loading && !mySubmission && <div style={styles.meta}>No submission found.</div>}
        </div>
      )}
    </div>
  )
}

export default function AssignmentsTab({ courseId }: AssignmentsTabProps): React.ReactElement {
  const { courseWork, loading, error } = useCourseWork(courseId)

  if (loading) return <div style={styles.loading}>Loading assignments…</div>
  if (error) return <div style={styles.error}>{error}</div>
  if (courseWork.length === 0) return <div style={styles.empty}>No assignments found.</div>

  return (
    <div style={styles.list}>
      {courseWork.map((cw) => (
        <AssignmentCard key={cw.id} courseId={courseId} cw={cw} />
      ))}
    </div>
  )
}
