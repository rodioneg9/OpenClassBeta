import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useStudentState } from '../context/StudentStateContext'
import type { Course } from '../types'

interface SidebarProps {
  selectedCourseId: string | null
  selectedPage: 'focus' | 'timeline' | 'profile' | 'study-materials'
  onSelectCourse: (course: Course | null) => void
  onSelectPage: (page: 'focus' | 'timeline' | 'profile' | 'study-materials') => void
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 260,
    minWidth: 260,
    background: '#fff',
    borderRight: '1px solid #e8eaed',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '100vh'
  },
  header: {
    padding: '20px 16px 12px',
    borderBottom: '1px solid #e8eaed'
  },
  appName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1a73e8',
    margin: 0,
    letterSpacing: '-0.3px'
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#80868b',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    padding: '16px 16px 6px'
  },
  courseList: {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: 8
  },
  courseItem: (selected: boolean): React.CSSProperties => ({
    padding: '10px 16px',
    cursor: 'pointer',
    borderRadius: 8,
    margin: '2px 8px',
    background: selected ? '#e8f0fe' : 'transparent',
    color: selected ? '#1a73e8' : '#202124',
    fontWeight: selected ? 600 : 400,
    fontSize: 14,
    transition: 'background 0.15s',
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }),
  section: {
    fontSize: 12,
    color: '#80868b',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #e8eaed'
  },
  logoutBtn: {
    width: '100%',
    padding: '8px 16px',
    background: 'transparent',
    border: '1px solid #dadce0',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    color: '#5f6368',
    fontWeight: 500
  },
  loading: {
    padding: '24px 16px',
    color: '#80868b',
    fontSize: 14,
    textAlign: 'center'
  },
  error: {
    padding: '12px 16px',
    color: '#d32f2f',
    fontSize: 13,
    background: '#fdecea',
    margin: '8px',
    borderRadius: 6
  },
  homeItem: (selected: boolean): React.CSSProperties => ({
    padding: '10px 16px',
    cursor: 'pointer',
    borderRadius: 8,
    margin: '2px 8px',
    background: selected ? '#e8f0fe' : 'transparent',
    color: selected ? '#1a73e8' : '#202124',
    fontWeight: 500,
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'background 0.15s'
  })
}

export default function Sidebar({
  selectedCourseId,
  selectedPage,
  onSelectCourse,
  onSelectPage
}: SidebarProps): React.ReactElement {
  const { studentState, loading, error, refresh } = useStudentState()
  const { logout } = useAuth()
  const courses = studentState?.indexes.courseIds.map((id) => studentState.entities.coursesById[id]) ?? []

  return (
    <div style={styles.sidebar}>
      <div style={styles.header}>
        <h1 style={styles.appName}>🎓 OpenClass</h1>
      </div>

      <div
        style={styles.homeItem(selectedCourseId === null && selectedPage === 'focus')}
        onClick={() => {
          onSelectPage('focus')
          onSelectCourse(null)
        }}
      >
        🎯 Focus Mode
      </div>
      <div
        style={styles.homeItem(selectedCourseId === null && selectedPage === 'timeline')}
        onClick={() => {
          onSelectPage('timeline')
          onSelectCourse(null)
        }}
      >
        🗓️ Timeline
      </div>
      <div
        style={styles.homeItem(selectedPage === 'profile')}
        onClick={() => {
          onSelectPage('profile')
          onSelectCourse(null)
        }}
      >
        🏅 Profile / Progress
      </div>
      <div
        style={styles.homeItem(selectedPage === 'study-materials')}
        onClick={() => {
          onSelectPage('study-materials')
          onSelectCourse(null)
        }}
      >
        📚 Study Material Mode
      </div>

      <div style={styles.sectionLabel}>
        Courses
        {!loading && (
          <span
            onClick={() => void refresh()}
            style={{ marginLeft: 8, cursor: 'pointer', fontSize: 13, color: '#1a73e8' }}
            title="Refresh courses"
          >
            ↺
          </span>
        )}
      </div>

      <div style={styles.courseList}>
        {loading && <div style={styles.loading}>Loading courses…</div>}
        {error && <div style={styles.error}>{error}</div>}
        {!loading && !error && courses.length === 0 && (
          <div style={styles.loading}>No courses found.</div>
        )}
        {courses.map((course) => (
          <div
            key={course.id}
            style={styles.courseItem(selectedCourseId === course.id)}
            onClick={() => {
              onSelectPage('focus')
              onSelectCourse(course)
            }}
            title={course.name}
          >
            <div>{course.name}</div>
            {course.section && <div style={styles.section}>{course.section}</div>}
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <button style={styles.logoutBtn} onClick={() => logout()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
