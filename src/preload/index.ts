import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    login: (): Promise<{ success: boolean }> => ipcRenderer.invoke('auth:login'),
    logout: (): Promise<{ success: boolean }> => ipcRenderer.invoke('auth:logout'),
    isAuthenticated: (): Promise<{ isAuthenticated: boolean }> =>
      ipcRenderer.invoke('auth:get-status'),
    getAccessToken: (): Promise<{ accessToken: string }> =>
      ipcRenderer.invoke('auth:get-access-token'),
    refresh: (): Promise<{ success: boolean }> => ipcRenderer.invoke('auth:refresh')
  },
  classroom: {
    getCourses: (): Promise<unknown[]> => ipcRenderer.invoke('classroom:get-courses'),
    getCourseWork: (courseId: string): Promise<unknown[]> =>
      ipcRenderer.invoke('classroom:get-coursework', courseId),
    getSubmissions: (courseId: string, courseWorkId: string): Promise<unknown[]> =>
      ipcRenderer.invoke('classroom:get-submissions', courseId, courseWorkId),
    getAnnouncements: (courseId: string): Promise<unknown[]> =>
      ipcRenderer.invoke('classroom:get-announcements', courseId),
    getStudents: (courseId: string): Promise<unknown[]> =>
      ipcRenderer.invoke('classroom:get-students', courseId),
    submitAssignment: (
      courseId: string,
      courseWorkId: string,
      submissionId: string
    ): Promise<unknown> =>
      ipcRenderer.invoke('classroom:submit-assignment', courseId, courseWorkId, submissionId),
    unsubmitAssignment: (
      courseId: string,
      courseWorkId: string,
      submissionId: string
    ): Promise<unknown> =>
      ipcRenderer.invoke('classroom:unsubmit-assignment', courseId, courseWorkId, submissionId),
    getMySubmission: (courseId: string, courseWorkId: string): Promise<unknown | null> =>
      ipcRenderer.invoke('classroom:get-my-submission', courseId, courseWorkId),
    addSubmissionAttachments: (
      courseId: string,
      courseWorkId: string,
      submissionId: string,
      attachments: unknown[]
    ): Promise<unknown> =>
      ipcRenderer.invoke(
        'classroom:add-submission-attachments',
        courseId,
        courseWorkId,
        submissionId,
        attachments
      ),
    removeSubmissionAttachments: (
      courseId: string,
      courseWorkId: string,
      submissionId: string,
      attachmentIds: string[]
    ): Promise<unknown> =>
      ipcRenderer.invoke(
        'classroom:remove-submission-attachments',
        courseId,
        courseWorkId,
        submissionId,
        attachmentIds
      ),
    uploadFilesAsAttachments: (files: unknown[]): Promise<unknown[]> =>
      ipcRenderer.invoke('classroom:upload-files-as-attachments', files)
  },
  shell: {
    openExternal: (url: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('shell:open-external', url)
  },
  plugins: {
    load: (): Promise<unknown[]> => ipcRenderer.invoke('plugins:load')
  },
  extensions: {
    getFor: (type: 'courseWork' | 'announcements' | 'notebook'): Promise<unknown[]> =>
      ipcRenderer.invoke('extensions:get-for', type),
    run: (extensionId: string, context: unknown): Promise<unknown> =>
      ipcRenderer.invoke('extensions:run', extensionId, context)
  },
  studyMaterial: {
    ask: (question: string, chunks: unknown[]): Promise<unknown> =>
      ipcRenderer.invoke('study-material:ask', question, chunks)
  }
})
