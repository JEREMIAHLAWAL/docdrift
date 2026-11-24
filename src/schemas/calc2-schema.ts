import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import { calc2Choices, calc2Policies } from '../core/calc2-content'
import { calc2JevLabels } from '../core/calc2-jev'

const denied: RolePermissions = { read: false, create: false, update: false, delete: false }
const permissions = { '*': denied, viewer: denied, member: denied, admin: denied }

// Only owner-gated actions access these collections; signed-out preview has
// no access to persisted recommendation text or export attempts.
export const calc2ReviewsSchema: CollectionSchema = {
  name: 'calc2_reviews',
  permissions,
  columns: [
    { name: 'policy', storage: 'text', interpretation: { kind: 'select', options: Object.keys(calc2Policies) } },
    { name: 'choice', storage: 'text', interpretation: { kind: 'select', options: [...calc2Choices] } },
    { name: 'reason', storage: 'text', interpretation: 'plain', maxLength: 300 },
    { name: 'decidedAt', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
}

export const calc2AnalysesSchema: CollectionSchema = {
  name: 'calc2_analyses',
  permissions,
  columns: [
    { name: 'policy', storage: 'text', interpretation: { kind: 'select', options: Object.keys(calc2Policies) } },
    { name: 'label', storage: 'text', interpretation: { kind: 'select', options: [...calc2JevLabels] } },
    { name: 'model', storage: 'text', interpretation: 'plain', maxLength: 200 },
    { name: 'sampleVersion', storage: 'text', interpretation: 'plain', maxLength: 100 },
    { name: 'sampleRef', storage: 'text', interpretation: 'plain', maxLength: 64 },
    { name: 'sampleBlobSha', storage: 'text', interpretation: 'plain', maxLength: 64 },
    { name: 'capturedAt', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
}

export const calc2AnalysisAttemptsSchema: CollectionSchema = {
  name: 'calc2_analysis_attempts',
  permissions,
  columns: [
    { name: 'policy', storage: 'text', interpretation: { kind: 'select', options: Object.keys(calc2Policies) } },
    { name: 'attemptedAt', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'status', storage: 'text', interpretation: { kind: 'select', options: ['running', 'succeeded', 'failed'] } },
    { name: 'stage', storage: 'text', interpretation: 'plain', maxLength: 20 },
    { name: 'error', storage: 'text', interpretation: 'plain', maxLength: 500 },
  ],
}

export const calc2PdfAttemptsSchema: CollectionSchema = {
  name: 'calc2_pdf_attempts',
  permissions,
  columns: [
    { name: 'attemptedAt', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'status', storage: 'text', interpretation: { kind: 'select', options: ['running', 'succeeded', 'failed'] } },
  ],
}
