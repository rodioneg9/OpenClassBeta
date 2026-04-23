"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  auth: {
    login: () => electron.ipcRenderer.invoke("auth:login"),
    logout: () => electron.ipcRenderer.invoke("auth:logout"),
    isAuthenticated: () => electron.ipcRenderer.invoke("auth:get-status"),
    getAccessToken: () => electron.ipcRenderer.invoke("auth:get-access-token"),
    refresh: () => electron.ipcRenderer.invoke("auth:refresh")
  },
  classroom: {
    getCourses: () => electron.ipcRenderer.invoke("classroom:get-courses"),
    getCourseWork: (courseId) => electron.ipcRenderer.invoke("classroom:get-coursework", courseId),
    getSubmissions: (courseId, courseWorkId) => electron.ipcRenderer.invoke("classroom:get-submissions", courseId, courseWorkId),
    getAnnouncements: (courseId) => electron.ipcRenderer.invoke("classroom:get-announcements", courseId),
    getStudents: (courseId) => electron.ipcRenderer.invoke("classroom:get-students", courseId),
    submitAssignment: (courseId, courseWorkId, submissionId) => electron.ipcRenderer.invoke("classroom:submit-assignment", courseId, courseWorkId, submissionId),
    unsubmitAssignment: (courseId, courseWorkId, submissionId) => electron.ipcRenderer.invoke("classroom:unsubmit-assignment", courseId, courseWorkId, submissionId),
    getMySubmission: (courseId, courseWorkId) => electron.ipcRenderer.invoke("classroom:get-my-submission", courseId, courseWorkId),
    addSubmissionAttachments: (courseId, courseWorkId, submissionId, attachments) => electron.ipcRenderer.invoke(
      "classroom:add-submission-attachments",
      courseId,
      courseWorkId,
      submissionId,
      attachments
    ),
    removeSubmissionAttachments: (courseId, courseWorkId, submissionId, attachmentIds) => electron.ipcRenderer.invoke(
      "classroom:remove-submission-attachments",
      courseId,
      courseWorkId,
      submissionId,
      attachmentIds
    ),
    uploadFilesAsAttachments: (files) => electron.ipcRenderer.invoke("classroom:upload-files-as-attachments", files)
  },
  shell: {
    openExternal: (url) => electron.ipcRenderer.invoke("shell:open-external", url)
  },
  plugins: {
    load: () => electron.ipcRenderer.invoke("plugins:load")
  },
  extensions: {
    getFor: (type) => electron.ipcRenderer.invoke("extensions:get-for", type),
    run: (extensionId, context) => electron.ipcRenderer.invoke("extensions:run", extensionId, context)
  },
  studyMaterial: {
    ask: (question, chunks) => electron.ipcRenderer.invoke("study-material:ask", question, chunks)
  }
});
