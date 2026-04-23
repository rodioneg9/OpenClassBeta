import React from 'react'
import { useAnnouncements } from '../hooks/useClassroom'

interface StreamTabProps {
  courseId: string
}

const styles: Record<string, React.CSSProperties> = {
  list: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: {
    background: '#fff',
    border: '1px solid #e8eaed',
    borderRadius: 10,
    padding: '20px 24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  authorChip: {
    background: '#e8f0fe',
    color: '#1a73e8',
    borderRadius: 20,
    padding: '3px 12px',
    fontSize: 12,
    fontWeight: 600
  },
  date: { fontSize: 12, color: '#80868b' },
  text: { fontSize: 14, color: '#202124', lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  loading: { color: '#80868b', fontSize: 14, padding: '24px 0', textAlign: 'center' },
  error: { color: '#d32f2f', fontSize: 14, background: '#fdecea', borderRadius: 8, padding: 12 },
  empty: { color: '#80868b', fontSize: 14, textAlign: 'center', paddingTop: 40 }
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

export default function StreamTab({ courseId }: StreamTabProps): React.ReactElement {
  const { announcements, loading, error } = useAnnouncements(courseId)

  if (loading) return <div style={styles.loading}>Loading stream…</div>
  if (error) return <div style={styles.error}>{error}</div>
  if (announcements.length === 0) return <div style={styles.empty}>No announcements yet.</div>

  return (
    <div style={styles.list}>
      {announcements.map((ann) => (
        <div key={ann.id} style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.authorChip}>Announcement</span>
            <span style={styles.date}>{formatDate(ann.creationTime)}</span>
          </div>
          <div style={styles.text}>{ann.text}</div>
          {ann.alternateLink && (
            <div style={{ fontSize: 12, color: '#5f6368', marginTop: 8 }}>
              Link available in app attachments panel.
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
