/**
 * Integration Billing Config
 *
 * Configure who pays for each integration's API calls.
 *
 * - 'developer': The app owner pays (default).
 * - 'user': The calling user pays.
 *
 * Every integration requires a signed-in caller. Set `anonymous: true` on a
 * 'developer' integration to let signed-out visitors call it too — the owner
 * then pays for anyone who can reach the app.
 *
 * Integrations not listed here default to 'developer' with sign-in required.
 *
 * IMPORTANT: any integration backed by per-user connected accounts (Google,
 * Composio) must be 'user' — the api-worker resolves the account from the
 * JWT subject. With 'developer' the app owner's JWT is forwarded, so every
 * signed-in user connects and acts on the app owner's account. Server code
 * that acts for a user in the background (e.g. a cron job) uses
 * `callComposio(env, ..., { asUser })` from 'deepspace/worker' instead.
 *
 * App change: the browser proxy (/api/integrations/*) refuses every
 * 'developer'-billed integration unless it is marked `browser: true`. The
 * scaffold default let ANY signed-in visitor spend the owner's credits on any
 * catalog endpoint with any body. The demo's paid integrations are reachable
 * only through owner-gated server actions.
 */

export const integrations: Record<
  string,
  { billing: 'developer' | 'user'; anonymous?: boolean; browser?: boolean }
> = {
  google: { billing: 'user' },
  composio: { billing: 'user' },
  github: { billing: 'developer' },
  cloudflare: { billing: 'developer' },
  'latex-compiler': { billing: 'developer' },
}

/** Whether the browser proxy may forward this integration at all. */
export function browserProxyAllowed(name: string): boolean {
  const config = Object.prototype.hasOwnProperty.call(integrations, name) ? integrations[name] : undefined
  const billing = config?.billing ?? 'developer'
  return billing === 'user' || config?.browser === true
}
