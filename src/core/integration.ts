/**
 * Shared integration plumbing: the injected caller type (so core logic runs
 * against a test double) and a strict decoder for GitHub contents payloads.
 */

export type IntegrationResult =
  | { success: true; data: unknown }
  | { success: false; error: string; code?: string }

export type CallIntegration = (endpoint: string, body: unknown) => Promise<IntegrationResult>

/** Decode a `github/get-repository-contents` file payload as UTF-8 text. */
export function decodeGithubFile(payload: unknown): { text: string; blobSha: string | null } {
  if (!payload || typeof payload !== 'object') throw new Error('GitHub returned no file payload.')
  const file = payload as { type?: unknown; encoding?: unknown; content?: unknown; sha?: unknown }
  if (file.type !== undefined && file.type !== 'file') {
    throw new Error(`Expected a file but GitHub returned type "${String(file.type)}".`)
  }
  if (file.encoding !== 'base64' || typeof file.content !== 'string' || file.content.length === 0) {
    throw new Error('GitHub payload is missing base64 file content.')
  }
  let text: string
  try {
    const binary = atob(file.content.replace(/\s+/g, ''))
    text = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)))
  } catch {
    throw new Error('GitHub file content is not valid base64 UTF-8.')
  }
  return { text, blobSha: typeof file.sha === 'string' ? file.sha : null }
}
