/**
 * Deterministic evidence extraction. No model touches this step: the excerpts
 * are cut by fixed heading rules, so the same source bytes always produce the
 * same excerpt, and a missing section is an error rather than a guess.
 */

import { MAX_EXCERPT_CHARS } from './case'

export class EvidenceError extends Error {
  constructor(
    readonly stage: 'legacy' | 'target' | 'classify' | 'persist',
    message: string,
  ) {
    super(message)
    this.name = 'EvidenceError'
  }
}

/** GitHub contents API file payload, the subset we rely on. */
export interface GithubFile {
  content: string
  encoding: string
  sha?: string
  path?: string
  type?: string
}

/** Decode a base64 GitHub file payload as UTF-8 text. */
export function decodeGithubFile(
  payload: unknown,
  stage: 'legacy' | 'target' = 'legacy',
): { text: string; blobSha: string | null } {
  if (!payload || typeof payload !== 'object') {
    throw new EvidenceError(stage, 'GitHub returned no file payload.')
  }
  const file = payload as Partial<GithubFile>
  if (file.type !== undefined && file.type !== 'file') {
    throw new EvidenceError(stage, `Expected a file but GitHub returned type "${String(file.type)}".`)
  }
  if (file.encoding !== 'base64' || typeof file.content !== 'string' || file.content.length === 0) {
    throw new EvidenceError(stage, 'GitHub payload is missing base64 file content.')
  }
  let bytes: Uint8Array
  try {
    const binary = atob(file.content.replace(/\s+/g, ''))
    bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  } catch {
    throw new EvidenceError(stage, 'GitHub file content is not valid base64.')
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  return { text, blobSha: typeof file.sha === 'string' ? file.sha : null }
}

/** Cut text to `max` chars, preferring a paragraph, then a word boundary. */
export function boundExcerpt(text: string, max = MAX_EXCERPT_CHARS): string {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (clean.length <= max) return clean
  const window = clean.slice(0, max)
  const para = window.lastIndexOf('\n\n')
  const cut = para >= max / 2 ? para : window.lastIndexOf(' ')
  return `${window.slice(0, cut > 0 ? cut : max).trimEnd()} …`
}

/** Index of the next line at or above `level` (any heading when level is 6). */
function sectionEnd(lines: string[], start: number, level: number, extraStop?: RegExp): number {
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(#{1,6})\s/.exec(lines[i])
    if (m && m[1].length <= level) return i
    if (extraStop?.test(lines[i])) return i
  }
  return lines.length
}

/**
 * Legacy reference: the `### \`render()\`` section, up to the `* * *` rule
 * that ends each API entry. The site-wide archival banner (`<div class="scary">`)
 * is dropped because it is not the instruction under review.
 */
export function extractLegacyRender(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex((l) => /^###\s+`render\(\)`/.test(l))
  if (start === -1) {
    throw new EvidenceError('legacy', 'The pinned legacy file has no `render()` section.')
  }
  const end = sectionEnd(lines, start, 3, /^\*\s\*\s\*\s*$/)
  const body = lines
    .slice(start + 1, end)
    .join('\n')
    .replace(/<div class="scary">[\s\S]*?<\/div>/g, '')
  const excerpt = boundExcerpt(unlink(body))
  if (excerpt.length < 40 || !/render\(/.test(excerpt)) {
    throw new EvidenceError('legacy', 'The legacy `render()` section is empty or unrecognised.')
  }
  return excerpt
}

/** Strip markdown links to their text, including heading self-links. */
function unlink(text: string): string {
  return text.replace(/\[([^\]]*)\]\((?:[^()\s]|\([^()]*\))+(?:\s+"[^"]*")?\)/g, '$1')
}

const TARGET_HEADING = /removed:\s*reactdom\.render\b/i

/** Drop react.dev MDX heading ids (`{/*removed-reactdom-render*\/}`). */
const stripHeadingId = (heading: string) => heading.replace(/\s*\{\/\*[\s\S]*?\*\/\}\s*$/, '')

/** Drop lines that are only an MDX component tag (`<Note>`), outside code fences. */
function stripMdxTagLines(text: string): string {
  let inFence = false
  return text
    .split('\n')
    .filter((l) => {
      if (/^\s*```/.test(l)) inFence = !inFence
      return inFence || !/^\s*<\/?[A-Z][A-Za-z]*\s*\/?>\s*$/.test(l)
    })
    .join('\n')
}

/**
 * React 19 Upgrade Guide: the "Removed: `ReactDOM.render`" section from the
 * react.dev markdown source, up to the next heading of the same or higher level.
 */
export function extractTargetRender(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let start = -1
  let level = 6
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{2,6})\s+(.*)$/.exec(lines[i])
    if (m && TARGET_HEADING.test(unlink(stripHeadingId(m[2])).replace(/`/g, ''))) {
      start = i
      level = m[1].length
      break
    }
  }
  if (start === -1) {
    throw new EvidenceError('target', 'The upgrade guide has no "Removed: ReactDOM.render" section.')
  }
  const end = sectionEnd(lines, start, level)
  const excerpt = boundExcerpt(unlink(stripMdxTagLines(lines.slice(start + 1, end).join('\n'))))
  if (excerpt.length < 40 || !/ReactDOM\.render/.test(excerpt)) {
    throw new EvidenceError('target', 'The upgrade guide section is empty or unrecognised.')
  }
  return excerpt
}

