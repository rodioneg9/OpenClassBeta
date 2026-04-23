import React from 'react'
import { useStudents } from '../hooks/useClassroom'

interface PeopleTabProps {
  courseId: string
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 14
  },
  card: {
    background: '#fff',
    border: '1px solid #e8eaed',
    borderRadius: 10,
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: '#e8f0fe',
    color: '#1a73e8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 18,
    flexShrink: 0,
    overflow: 'hidden'
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  name: { fontSize: 14, fontWeight: 600, color: '#202124' },
  email: { fontSize: 12, color: '#80868b', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: '#202124', margin: '0 0 14px' },
  loading: { color: '#80868b', fontSize: 14, padding: '24px 0', textAlign: 'center' },
  error: { color: '#d32f2f', fontSize: 14, background: '#fdecea', borderRadius: 8, padding: 12 },
  empty: { color: '#80868b', fontSize: 14, textAlign: 'center', paddingTop: 40 }
}

function initials(name?: { fullName?: string; givenName?: string; familyName?: string }): string {
  if (!name) return '?'
  if (name.fullName) return name.fullName.charAt(0).toUpperCase()
  return ((name.givenName ?? ' ').charAt(0) + (name.familyName ?? ' ').charAt(0)).toUpperCase()
}

export default function PeopleTab({ courseId }: PeopleTabProps): React.ReactElement {
  const { students, loading, error } = useStudents(courseId)

  if (loading) return <div style={styles.loading}>Loading people…</div>
  if (error) return <div style={styles.error}>{error}</div>
  if (students.length === 0) return <div style={styles.empty}>No students found.</div>

  return (
    <div>
      <div style={styles.sectionTitle}>Students ({students.length})</div>
      <div style={styles.grid}>
        {students.map((student) => (
          <div key={student.userId} style={styles.card}>
            <div style={styles.avatar}>
              {student.profile?.photoUrl ? (
                <img src={student.profile.photoUrl} alt="" style={styles.avatarImg} />
              ) : (
                initials(student.profile?.name)
              )}
            </div>
            <div>
              <div style={styles.name}>
                {student.profile?.name?.fullName ?? student.userId}
              </div>
              {student.profile?.emailAddress && (
                <div style={styles.email}>{student.profile.emailAddress}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
