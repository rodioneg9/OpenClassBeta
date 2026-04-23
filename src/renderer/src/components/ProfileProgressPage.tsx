import React, { useEffect, useState } from 'react'
import type { AchievementStats } from '../types'
import { getAchievementStats } from '../lib/achievements'

function formatAchievement(id: string): string {
  if (id === 'first-submission') return 'First Submission'
  if (id === 'deadline-survivor') return 'Deadline Survivor'
  if (id === 'consistent-student') return 'Consistent Student'
  if (id.startsWith('subject-mastery:')) {
    const subject = id.replace('subject-mastery:', '')
    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} Subject Mastery`
  }
  return id
}

export default function ProfileProgressPage(): React.ReactElement {
  const [stats, setStats] = useState<AchievementStats>(getAchievementStats())

  useEffect(() => {
    const onStorage = (): void => setStats(getAchievementStats())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <div style={{ padding: '32px 40px' }}>
      <h2 style={{ margin: '0 0 12px' }}>Profile / Progress</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div>Assignments submitted: <b>{stats.submittedCount}</b></div>
        <div>Deadlines met: <b>{stats.deadlinesMet}</b></div>
        <div>Current streak: <b>{stats.currentStreak}</b></div>
        <div>Best streak: <b>{stats.bestStreak}</b></div>
      </div>
      <h3 style={{ marginTop: 20 }}>Achievements</h3>
      {stats.unlocked.length === 0 && <div>No achievements yet.</div>}
      {stats.unlocked.map((id) => (
        <div key={id}>🏅 {formatAchievement(id)}</div>
      ))}
      <h3 style={{ marginTop: 20 }}>Subject Progress</h3>
      {Object.entries(stats.subjects).map(([subject, count]) => (
        <div key={subject}>{subject}: {count}</div>
      ))}
      {Object.keys(stats.subjects).length === 0 && <div>No subject progress yet.</div>}
    </div>
  )
}
