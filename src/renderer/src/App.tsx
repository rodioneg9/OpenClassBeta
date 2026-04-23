import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './components/LoginPage'
import Sidebar from './components/Sidebar'
import CourseView from './components/CourseView'
import AssignmentView from './components/AssignmentView'
import ProfileProgressPage from './components/ProfileProgressPage'
import StudyMaterialPage from './components/StudyMaterialPage'
import FocusModePage from './components/FocusModePage'
import TimelinePage from './components/TimelinePage'
import { StudentStateProvider } from './context/StudentStateContext'
import type { Course } from './types'

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    fontFamily: "'Segoe UI', Roboto, Arial, sans-serif",
    backgroundColor: '#f8f9fa',
    overflow: 'hidden'
  },
  main: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column'
  }
}

function AppContent(): React.ReactElement {
  const { isAuthenticated } = useAuth()
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedAssignment, setSelectedAssignment] = useState<{ courseId: string; assignmentId: string } | null>(
    null
  )
  const [selectedPage, setSelectedPage] = useState<'focus' | 'timeline' | 'profile' | 'study-materials'>('focus')

  const openCourse = (course: Course | null): void => {
    setSelectedAssignment(null)
    setSelectedCourse(course)
    if (course) setSelectedPage('focus')
  }

  const openPage = (page: 'focus' | 'timeline' | 'profile' | 'study-materials'): void => {
    setSelectedAssignment(null)
    setSelectedCourse(null)
    setSelectedPage(page)
  }

  const openAssignment = (courseId: string, assignmentId: string): void => {
    setSelectedCourse(null)
    setSelectedAssignment({ courseId, assignmentId })
    setSelectedPage('focus')
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <StudentStateProvider>
      <div style={styles.app}>
        <Sidebar
          selectedCourseId={selectedCourse?.id ?? null}
          selectedPage={selectedPage}
          onSelectCourse={openCourse}
          onSelectPage={openPage}
        />
        <main style={styles.main}>
          {selectedAssignment ? (
            <AssignmentView
              courseId={selectedAssignment.courseId}
              assignmentId={selectedAssignment.assignmentId}
              onOpenCourse={(course) => openCourse(course)}
            />
          ) : selectedCourse ? (
            <CourseView course={selectedCourse} />
          ) : selectedPage === 'timeline' ? (
            <TimelinePage onSelectCourse={(course) => openCourse(course)} />
          ) : selectedPage === 'profile' ? (
            <ProfileProgressPage />
          ) : selectedPage === 'study-materials' ? (
            <StudyMaterialPage />
          ) : (
            <FocusModePage
              onOpenAssignment={openAssignment}
              onOpenStudyMaterials={() => openPage('study-materials')}
            />
          )}
        </main>
      </div>
    </StudentStateProvider>
  )
}

export default function App(): React.ReactElement {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
