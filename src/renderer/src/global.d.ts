// Type declarations for the electronAPI object exposed via contextBridge in preload/index.ts

interface ElectronAPI {
  auth: {
    login: () => Promise<{ success: boolean }>
    logout: () => Promise<{ success: boolean }>
    isAuthenticated: () => Promise<{ isAuthenticated: boolean }>
    getAccessToken: () => Promise<{ accessToken: string }>
    refresh: () => Promise<{ success: boolean }>
  }
  classroom: {
    getCourses: () => Promise<unknown[]>
    getCourseWork: (courseId: string) => Promise<unknown[]>
    getSubmissions: (courseId: string, courseWorkId: string) => Promise<unknown[]>
    getAnnouncements: (courseId: string) => Promise<unknown[]>
    getStudents: (courseId: string) => Promise<unknown[]>
    submitAssignment: (courseId: string, courseWorkId: string, submissionId: string) => Promise<unknown>
    unsubmitAssignment: (courseId: string, courseWorkId: string, submissionId: string) => Promise<unknown>
    getMySubmission: (courseId: string, courseWorkId: string) => Promise<unknown | null>
    addSubmissionAttachments: (
      courseId: string,
      courseWorkId: string,
      submissionId: string,
      attachments: unknown[]
    ) => Promise<unknown>
    removeSubmissionAttachments: (
      courseId: string,
      courseWorkId: string,
      submissionId: string,
      attachmentIds: string[]
    ) => Promise<unknown>
    uploadFilesAsAttachments: (files: unknown[]) => Promise<unknown[]>
  }
  shell: {
    openExternal: (url: string) => Promise<{ success: boolean }>
  }
  plugins: {
    load: () => Promise<unknown[]>
  }
  extensions: {
    getFor: (type: 'courseWork' | 'announcements' | 'notebook') => Promise<unknown[]>
    run: (extensionId: string, context: unknown) => Promise<unknown>
  }
  studyMaterial: {
    ask: (question: string, chunks: unknown[]) => Promise<unknown>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
