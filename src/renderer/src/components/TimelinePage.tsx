import React from 'react'
import type { Course } from '../types'
import { useStudentState } from '../context/StudentStateContext'

interface TimelinePageProps {
  onSelectCourse: (course: Course) => void
}

function dueText(value: string | null): string {
  if (!value) return 'No due date'
  return new Date(value).toLocaleString()
}

export default function TimelinePage({ onSelectCourse }: TimelinePageProps): React.ReactElement {
  const { loading, error, studentState, selectors } = useStudentState()

  if (loading) return <div style={{ padding: '24px 40px' }}>Loading timeline…</div>
  if (error) return <div style={{ padding: '24px 40px', color: '#d32f2f' }}>{error}</div>
  if (!studentState || !selectors.timeline) return <div style={{ padding: '24px 40px' }}>No timeline data.</div>

  const renderBucket = (title: string, keys: typeof selectors.timeline.past): React.ReactElement => (
    <div style={{ border: '1px solid #e8eaed', borderRadius: 10, padding: 12, background: '#fff' }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {keys.length === 0 && <div>Empty</div>}
      {keys.map((task) => {
        const course = studentState.entities.coursesById[task.courseId]
        return (
          <div
            key={task.assignmentKey}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #f0f1f2',
              padding: '8px 0'
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{task.title}</div>
              <div style={{ fontSize: 13, color: '#5f6368' }}>
                {course?.name ?? task.courseId} · {dueText(task.dueAt)} · {task.status}
              </div>
            </div>
            {course && (
              <button type="button" onClick={() => onSelectCourse(course)}>
                Open
              </button>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div style={{ padding: '24px 40px', display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Timeline</h2>
      {renderBucket('Past', selectors.timeline.past)}
      {renderBucket('Current', selectors.timeline.current)}
      {renderBucket('Upcoming', selectors.timeline.upcoming)}
    </div>
  )
}
