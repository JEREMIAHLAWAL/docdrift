/**
 * The single DocDrift case. Everything the refresh fetches is fixed here, so a
 * caller can never point the owner's billed integrations at another URL.
 */

export const CASE_ID = 'reactdom-render-react19'

export const CASE_QUESTION = 'Can I still use `ReactDOM.render` in React 19?'

/** Legacy source: the archived reactjs.org docs, pinned to one commit. */
export const LEGACY = {
  label: 'Legacy reactjs.org ReactDOM reference (React 18-era docs, archived)',
  owner: 'reactjs',
  repo: 'legacy.reactjs.org',
  path: 'content/docs/reference-react-dom.md',
  // Last commit that touched this file ("Update legacy site with disclaimers",
  // 2023-03-18). Resolved via the public GitHub commits API before pinning.
  ref: 'b4f72e1ef00a346b519f0649ae36942bcde93120',
} as const

export const LEGACY_SOURCE_URL =
  `https://github.com/${LEGACY.owner}/${LEGACY.repo}/blob/${LEGACY.ref}/${LEGACY.path}#render`

/**
 * Upgrade target: React 19's official Upgrade Guide, read as its markdown
 * source in the react.dev repo. It tracks `main` (not a pinned commit) so a
 * refresh can pick up edits; the returned blob SHA records which version was
 * read. Fetched through the same GitHub integration as the legacy file,
 * because the platform's Firecrawl scrape was unavailable (see README).
 */
export const TARGET = {
  label: 'React 19 Upgrade Guide (react.dev source, published 2024-04-25)',
  owner: 'reactjs',
  repo: 'react.dev',
  path: 'src/content/blog/2024/04/25/react-19-upgrade-guide.md',
  ref: 'main',
  url: 'https://react.dev/blog/2024/04/25/react-19-upgrade-guide',
  anchor: '#removed-reactdom-render',
} as const

/** The rendered page a reader would open. */
export const TARGET_SOURCE_URL = `${TARGET.url}${TARGET.anchor}`

/** Hard cap on each displayed and classified excerpt. */
export const MAX_EXCERPT_CHARS = 900

export const RELATIONSHIPS = ['agrees', 'conflicts', 'inconclusive'] as const
export type Relationship = (typeof RELATIONSHIPS)[number]

export const DECISIONS = ['keep', 'revise', 'needs_review'] as const
export type Decision = (typeof DECISIONS)[number]

/** Minimum gap between owner refreshes; spend control on top of the owner gate. */
export const REFRESH_COOLDOWN_MS = 60_000
