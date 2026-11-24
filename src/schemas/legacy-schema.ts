/**
 * Collections left by the earlier DocDrift prototype (React docs drift
 * checker). The deployed app still holds their rows, and the SDK does not
 * drop collections, so the schemas stay declared to keep that data addressable.
 * Nothing in the app reads or writes them; every role is denied.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'

const denied: RolePermissions = { read: false, create: false, update: false, delete: false }
const permissions = { '*': denied, viewer: denied, member: denied, admin: denied }

const text = (name: string, maxLength?: number) =>
  ({ name, storage: 'text', interpretation: 'plain', ...(maxLength ? { maxLength } : {}) }) as const
const datetime = (name: string) => ({ name, storage: 'text', interpretation: { kind: 'datetime' } }) as const
const select = (name: string, options: string[]) => ({ name, storage: 'text', interpretation: { kind: 'select', options } }) as const

export const legacySnapshotsSchema: CollectionSchema = {
  name: 'evidence_snapshots',
  permissions,
  columns: [
    text('caseId'),
    datetime('capturedAt'),
    text('legacyLabel'),
    { name: 'legacySourceUrl', storage: 'text', interpretation: { kind: 'url' } },
    text('legacyRef'),
    text('legacyBlobSha'),
    text('legacyExcerpt', 2000),
    text('targetLabel'),
    { name: 'targetSourceUrl', storage: 'text', interpretation: { kind: 'url' } },
    text('targetExcerpt', 2000),
    select('suggestion', ['agrees', 'conflicts', 'inconclusive']),
    { name: 'probabilities', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'confidence', storage: 'number', interpretation: 'plain' },
    text('model'),
    text('targetRef'),
    text('targetBlobSha'),
  ],
}

export const legacyAttemptsSchema: CollectionSchema = {
  name: 'refresh_attempts',
  permissions,
  columns: [
    text('caseId'),
    datetime('attemptedAt'),
    select('status', ['running', 'succeeded', 'failed']),
    text('stage'),
    text('error', 500),
    text('snapshotId'),
  ],
}

export const legacyReviewsSchema: CollectionSchema = {
  name: 'reviews',
  permissions,
  columns: [
    text('caseId'),
    text('snapshotId'),
    select('decision', ['keep', 'revise', 'needs_review']),
    text('note', 500),
    datetime('decidedAt'),
  ],
}
