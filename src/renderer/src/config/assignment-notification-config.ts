export interface AssignmentNotificationConfig {
  watchedDomains: string[]
  scannedFileExtensions: string[]
}

export const assignmentNotificationConfig: AssignmentNotificationConfig = {
  watchedDomains: ['drive.google.com', 'docs.google.com', 'youtube.com'],
  scannedFileExtensions: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'tif', 'tiff', 'bmp', 'heic']
}
