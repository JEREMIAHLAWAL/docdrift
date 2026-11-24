/**
 * Server actions. All are owner-only and run RBAC-off, so each one validates
 * its input and re-checks OWNER_USER_ID before touching records or a billed
 * integration. Implementations live in calc2-actions.ts.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { analyzeCalc2, exportCalc2Review, getCalc2Analysis, getCalc2Review, saveCalc2Review } from './calc2-actions'

export const actions: Record<string, ActionHandler<Env>> = { getCalc2Review, saveCalc2Review, exportCalc2Review, getCalc2Analysis, analyzeCalc2 }
