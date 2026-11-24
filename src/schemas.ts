/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { legacyAttemptsSchema, legacyReviewsSchema, legacySnapshotsSchema } from './schemas/legacy-schema'
import { calc2AnalysesSchema, calc2AnalysisAttemptsSchema, calc2PdfAttemptsSchema, calc2ReviewsSchema } from './schemas/calc2-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  legacySnapshotsSchema,
  legacyAttemptsSchema,
  legacyReviewsSchema,
  calc2ReviewsSchema,
  calc2PdfAttemptsSchema,
  calc2AnalysesSchema,
  calc2AnalysisAttemptsSchema,
]
