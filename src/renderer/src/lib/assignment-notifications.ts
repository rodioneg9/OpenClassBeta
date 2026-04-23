import type { CourseWork, Material } from '../types'
import type { AssignmentNotificationConfig } from '../config/assignment-notification-config'

export type NotificationSeverity = 'warning' | 'info'

export interface AssignmentNotification {
  id: string
  name: string
  message: string
  severity: NotificationSeverity
}

export interface NotificationRule {
  id: string
  name: string
  condition: (assignment: CourseWork) => boolean
  message: string
  severity: NotificationSeverity
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, '')
}

function safeDomainFromUrl(value: string): string | null {
  try {
    return normalizeDomain(new URL(value).hostname)
  } catch {
    return null
  }
}

function getMaterialItems(materials?: Material[]): Array<{ url?: string; label?: string }> {
  return (
    materials
      ?.map((material) => ({
        url:
          material.link?.url ??
          material.driveFile?.driveFile?.alternateLink ??
          material.youtubeVideo?.alternateLink ??
          material.form?.formUrl,
        label:
          material.link?.title ??
          material.driveFile?.driveFile?.title ??
          material.youtubeVideo?.title ??
          material.form?.title
      }))
      .filter((x) => Boolean(x.url || x.label)) ?? []
  )
}

function buildScanExtPattern(extensions: string[]): RegExp | null {
  const normalized = extensions
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'))
  return normalized.length > 0 ? new RegExp(`\\.(${normalized.join('|')})$`, 'i') : null
}

function hasScannedLikeAttachment(assignment: CourseWork, scanExtPattern: RegExp | null): boolean {
  if (!scanExtPattern) return false
  const materialItems = getMaterialItems(assignment.materials)
  return materialItems.some((item) => {
    const combinedUrlAndLabel = `${item.url ?? ''} ${item.label ?? ''}`
    return scanExtPattern.test(combinedUrlAndLabel)
  })
}

function hasDescriptionText(assignment: CourseWork): boolean {
  return Boolean(assignment.description && assignment.description.trim().length > 0)
}

export function evaluateAssignmentNotifications(
  assignment: CourseWork,
  config: AssignmentNotificationConfig
): AssignmentNotification[] {
  const watchedDomains = new Set(config.watchedDomains.map(normalizeDomain).filter(Boolean))
  const scanExtPattern = buildScanExtPattern(config.scannedFileExtensions)

  const rules: NotificationRule[] = [
    {
      id: 'external-domains',
      name: 'External Domains',
      condition: (currentAssignment) => {
        for (const item of getMaterialItems(currentAssignment.materials)) {
          const domain = item.url ? safeDomainFromUrl(item.url) : null
          if (!domain) continue
          for (const watchedDomain of watchedDomains) {
            if (domain === watchedDomain || domain.endsWith(`.${watchedDomain}`)) {
              return true
            }
          }
        }
        return false
      },
      message: 'This assignment includes links from watched external domains.',
      severity: 'warning'
    },
    {
      id: 'scanned-assignment',
      name: 'Scanned Assignment',
      condition: (currentAssignment) =>
        hasScannedLikeAttachment(currentAssignment, scanExtPattern) &&
        !hasDescriptionText(currentAssignment),
      message: 'This assignment appears to be scan-based (image/PDF) and may have limited readable text.',
      severity: 'info'
    }
  ]

  return rules
    .filter((rule) => rule.condition(assignment))
    .map((rule) => ({
      id: rule.id,
      name: rule.name,
      message: rule.message,
      severity: rule.severity
    }))
}
