import { describe, expect, it } from 'vitest'
import { decodeGithubFile } from './integration'

describe('decodeGithubFile', () => {
  it('decodes base64 UTF-8 content (including line breaks GitHub inserts) and returns the blob sha', () => {
    const content = btoa(String.fromCharCode(...new TextEncoder().encode('1/n → 0'))).replace(/(.{4})/g, '$1\n')
    expect(decodeGithubFile({ type: 'file', encoding: 'base64', content, sha: 'abc' })).toEqual({ text: '1/n → 0', blobSha: 'abc' })
  })

  it.each([
    [null, /no file payload/],
    [{ type: 'dir', encoding: 'base64', content: 'eA==' }, /type "dir"/],
    [{ type: 'file', encoding: 'utf-8', content: 'x' }, /missing base64/],
    [{ type: 'file', encoding: 'base64', content: '%%%' }, /not valid/],
    [{ type: 'file', encoding: 'base64', content: btoa('\xff\xfe') }, /not valid/],
  ])('rejects malformed payloads', (payload, message) => {
    expect(() => decodeGithubFile(payload)).toThrow(message)
  })
})
