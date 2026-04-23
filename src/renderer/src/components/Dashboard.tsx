import React from 'react'
import { useCoursesCache } from '../hooks/useClassroom'
import type { Course } from '../types'

interface DashboardProps {
  onSelectCourse: (course: Course) => void
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '32px 40px',
    flex: 1
  },
  heading: {
    fontSize: 26,
    fontWeight: 700,
    color: '#202124',
    margin: '0 0 8px'
  },
  subheading: {
    fontSize: 15,
    color: '#80868b',
    margin: '0 0 32px'
  },
  statsRow: {
    display: 'flex',
    gap: 20,
    marginBottom: 40,
    flexWrap: 'wrap'
  },
  statCard: {
    flex: '1 1 160px',
    background: '#fff',
    borderRadius: 12,
    padding: '20px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    border: '1px solid #e8eaed'
  },
  statValue: {
    fontSize: 32,
    fontWeight: 700,
    color: '#1a73e8',
    margin: '0 0 4px'
  },
  statLabel: {
    fontSize: 13,
    color: '#80868b',
    fontWeight: 500
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#202124',
    marginBottom: 16
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 16
  },
  courseCard: {
    background: '#fff',
    borderRadius: 12,
    padding: '20px',
    border: '1px solid #e8eaed',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s, transform 0.1s'
  },
  courseCardName: {
    fontSize: 15,
    fontWeight: 600,
    color: '#202124',
    marginBottom: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  courseCardSection: {
    fontSize: 13,
    color: '#80868b'
  },
  badge: {
    display: 'inline-block',
    background: '#e8f0fe',
    color: '#1a73e8',
    borderRadius: 20,
    padding: '2px 10px',
    fontSize: 12,
    fontWeight: 600,
    marginTop: 12
  },
  loading: {
    color: '#80868b',
    fontSize: 15
  },
  error: {
    color: '#d32f2f',
    fontSize: 14,
    background: '#fdecea',
    borderRadius: 8,
    padding: '12px 16px'
  }
}

export default function Dashboard({ onSelectCourse }: DashboardProps): React.ReactElement {
  const { courses, loading, error } = useCoursesCache()

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Welcome to OpenClass</h2>
      <p style={styles.subheading}>Select a course from the sidebar or below to get started.</p>

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{loading ? '—' : courses.length}</div>
          <div style={styles.statLabel}>Active Courses</div>
        </div>
      </div>

      <div style={styles.sectionTitle}>Your Courses</div>

      {loading && <div style={styles.loading}>Loading courses…</div>}
      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.grid}>
        {courses.map((course) => (
          <div
            key={course.id}
            style={styles.courseCard}
            onClick={() => onSelectCourse(course)}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLDivElement).style.boxShadow =
                '0 4px 16px rgba(0,0,0,0.12)'
              ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLDivElement).style.boxShadow =
                '0 1px 4px rgba(0,0,0,0.06)'
              ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
            }}
          >
            <div style={styles.courseCardName}>{course.name}</div>
            {course.section && <div style={styles.courseCardSection}>{course.section}</div>}
            <div style={styles.badge}>Active</div>
          </div>
        ))}
      </div>
    </div>
  )
}
