/**
 * DocDrift collections. Everyone (including signed-out visitors) may read;
 * no client role may write. The only writers are the owner-gated server
 * actions in src/actions, which run RBAC-off and validate their input.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import { DECISIONS, RELATIONSHIPS } from '../core/case'

const readOnly: RolePermissions = { read: true, create: false, update: false, delete: false }
const publicReadOnly = { '*': readOnly, viewer: readOnly, member: readOnly, admin: readOnly }

const text = (name: string, maxLength?: number) =>
  ({ name, storage: 'text', interpretation: 'plain', ...(maxLength ? { maxLength } : {}) }) as const

/** One row per successful refresh: both excerpts and the suggestion, together. */
export const snapshotsSchema: CollectionSchema = {
  name: 'evidence_snapshots',
  columns: [
    text('caseId'),
    { name: 'capturedAt', storage: 'text', interpretation: { kind: 'datetime' } },
    text('legacyLabel'),
    { name: 'legacySourceUrl', storage: 'text', interpretation: { kind: 'url' } },
    text('legacyRef'),
    text('legacyBlobSha'),
    text('legacyExcerpt', 2000),
    text('targetLabel'),
    { name: 'targetSourceUrl', storage: 'text', interpretation: { kind: 'url' } },
    text('targetExcerpt', 2000),
    { name: 'suggestion', storage: 'text', interpretation: { kind: 'select', options: [...RELATIONSHIPS] } },
    { name: 'probabilities', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'confidence', storage: 'number', interpretation: 'plain' },
    text('model'),
  ],
  permissions: publicReadOnly,
}

/** One row per refresh attempt, success or failure, so failures stay visible. */
export const attemptsSchema: CollectionSchema = {
  name: 'refresh_attempts',
  columns: [
    text('caseId'),
    { name: 'attemptedAt', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'status', storage: 'text', interpretation: { kind: 'select', options: ['running', 'succeeded', 'failed'] } },
    text('stage'),
    text('error', 500),
    text('snapshotId'),
  ],
  permissions: publicReadOnly,
}

/** The single current owner review (record id = case id), pinned to a snapshot. */
export const reviewsSchema: CollectionSchema = {
  name: 'reviews',
  columns: [
    text('caseId'),
    text('snapshotId'),
    { name: 'decision', storage: 'text', interpretation: { kind: 'select', options: [...DECISIONS] } },
    text('note', 500),
    { name: 'decidedAt', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
  permissions: publicReadOnly,
}
