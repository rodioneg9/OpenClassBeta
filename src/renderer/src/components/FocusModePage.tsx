import React, { useState } from 'react'
import { useStudentState } from '../context/StudentStateContext'
import { hasNotebookContent, setNotebookState } from '../lib/notebook'

interface FocusModePageProps {
  onOpenAssignment: (courseId: string, assignmentId: string) => void
  onOpenStudyMaterials: () => void
}

function formatDueDate(dueAt: string | null): string {
  if (!dueAt) return 'No deadline'
  return `Due ${new Date(dueAt).toLocaleString()}`
}

export default function FocusModePage({
  onOpenAssignment,
  onOpenStudyMaterials
}: FocusModePageProps): React.ReactElement {
  const { loading, error, studentState, selectors, submitAssignmentFromFocus, refresh } = useStudentState()
  const [message, setMessage] = useState<string | null>(null)
  const [editingNotebookTask, setEditingNotebookTask] = useState<string | null>(null)
  const [notebookDraft, setNotebookDraft] = useState('')

  if (loading) return <div style={{ padding: '24px 40px' }}>Loading Focus Mode…</div>
  if (error) return <div style={{ padding: '24px 40px', color: '#d32f2f' }}>{error}</div>
  if (!studentState) return <div style={{ padding: '24px 40px' }}>No student state available.</div>

  return (
    <div style={{ padding: '24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ margin: '0 0 4px' }}>Focus Mode</h2>
        <div style={{ color: '#5f6368' }}>
          What to do next: prioritized tasks, risks, and suggested actions.
        </div>
      </div>

      <div style={{ border: '1px solid #e8eaed', borderRadius: 10, padding: 12, background: '#fff' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>AI workload prediction</div>
        <div>
          <b>{studentState.ai.workloadPrediction.level.toUpperCase()}</b> · {studentState.ai.workloadPrediction.summary}
        </div>
      </div>

      <div style={{ border: '1px solid #e8eaed', borderRadius: 10, padding: 12, background: '#fff' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Top priority tasks</div>
        {selectors.topPriorityTasks.map((task) => {
          const assignment = studentState.entities.assignmentsByKey[task.assignmentKey]
          const canSubmit = assignment.submission && assignment.submission.state !== 'TURNED_IN'
          return (
            <div
              key={task.assignmentKey}
              style={{
                border: '1px solid #eef0f2',
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{task.title}</div>
                <div style={{ fontSize: 13, color: '#5f6368' }}>
                  {studentState.entities.coursesById[task.courseId]?.name ?? task.courseId} · {formatDueDate(task.dueAt)} · {task.status}
                </div>
                <div style={{ fontSize: 12, color: '#80868b' }}>
                  Notebook: {hasNotebookContent(assignment.notebook) ? 'linked notes available' : 'no linked notes yet'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => onOpenAssignment(task.courseId, assignment.assignmentId)}>
                  Open task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingNotebookTask(task.assignmentKey)
                    setNotebookDraft(assignment.notebook.textAnswer)
                  }}
                >
                  Add notebook note
                </button>
                {canSubmit && (
                  <button
                    type="button"
                    onClick={() => {
                      void submitAssignmentFromFocus(task.assignmentKey)
                        .then(() => setMessage('Assignment submitted.'))
                        .catch((err) => setMessage(String(err)))
                    }}
                  >
                    Turn in
                  </button>
                )}
                <button type="button" onClick={onOpenStudyMaterials}>
                  Ask AI
                </button>
              </div>
            </div>
          )
        })}
        {selectors.topPriorityTasks.length === 0 && <div>No tasks found.</div>}
        {editingNotebookTask && (
          <div style={{ borderTop: '1px solid #eef0f2', marginTop: 8, paddingTop: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Quick notebook note</div>
            <textarea
              value={notebookDraft}
              onChange={(e) => setNotebookDraft(e.target.value)}
              style={{ width: '100%', minHeight: 90 }}
            />
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const assignment = studentState.entities.assignmentsByKey[editingNotebookTask]
                  if (!assignment) return
                  setNotebookState(assignment.courseId, assignment.assignmentId, {
                    ...assignment.notebook,
                    textAnswer: notebookDraft
                  })
                  setMessage('Notebook note saved.')
                  setEditingNotebookTask(null)
                  void refresh()
                }}
              >
                Save note
              </button>
              <button type="button" onClick={() => setEditingNotebookTask(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #e8eaed', borderRadius: 10, padding: 12, background: '#fff' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Weak topics</div>
          {selectors.weakTopics.length === 0 && <div>No weak topics detected.</div>}
          {selectors.weakTopics.map((topic) => (
            <div key={topic}>• {topic}</div>
          ))}
        </div>
        <div style={{ border: '1px solid #e8eaed', borderRadius: 10, padding: 12, background: '#fff' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Recommended next actions</div>
          {selectors.recommendedNextActions.length === 0 && <div>No recommendations.</div>}
          {selectors.recommendedNextActions.map((action) => (
            <div key={action}>• {action}</div>
          ))}
        </div>
      </div>
      {message && <div style={{ color: '#1a73e8' }}>{message}</div>}
    </div>
  )
}
