import { describe, expect, it } from 'vitest'
import legacyMarkdown from './fixtures/legacy-reference-react-dom.md?raw'
import guideMarkdown from './fixtures/upgrade-guide.md?raw'
import { MAX_EXCERPT_CHARS } from './case'
import {
  EvidenceError,
  boundExcerpt,
  decodeGithubFile,
  extractLegacyRender,
  extractTargetRender,
} from './extract'

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  // GitHub wraps base64 at 60 columns; mimic that.
  return btoa(binary).replace(/(.{60})/g, '$1\n')
}

describe('decodeGithubFile', () => {
  it('decodes wrapped base64 as UTF-8 and keeps the blob sha', () => {
    const out = decodeGithubFile({ type: 'file', encoding: 'base64', content: toBase64('React’s render()'), sha: 'abc' })
    expect(out).toEqual({ text: 'React’s render()', blobSha: 'abc' })
  })

  it.each([
    ['null payload', null],
    ['directory listing', { type: 'dir', encoding: 'base64', content: 'eA==' }],
    ['missing content', { type: 'file', encoding: 'base64', content: '' }],
    ['non-base64 encoding', { type: 'file', encoding: 'none', content: 'x' }],
    ['corrupt base64', { type: 'file', encoding: 'base64', content: '***' }],
  ])('rejects %s', (_label, payload) => {
    expect(() => decodeGithubFile(payload)).toThrow(EvidenceError)
  })

  it('tags errors with the caller’s stage', () => {
    try {
      decodeGithubFile(null, 'target')
      throw new Error('expected a throw')
    } catch (err) {
      expect(err).toMatchObject({ stage: 'target' })
    }
  })
})

describe('extractLegacyRender (real pinned file)', () => {
  const excerpt = extractLegacyRender(legacyMarkdown)

  it('keeps the render() instruction and signature', () => {
    expect(excerpt).toContain('render(element, container[, callback])')
    expect(excerpt).toContain('Render a React element into the DOM')
  })

  it('drops the archival banner and stops before hydrate()', () => {
    expect(excerpt).not.toContain('This content is out of date')
    expect(excerpt).not.toContain('hydrate(element')
  })

  it('is bounded', () => {
    expect(excerpt.length).toBeLessThanOrEqual(MAX_EXCERPT_CHARS + 2)
  })

  it('fails loudly when the section is missing', () => {
    expect(() => extractLegacyRender('# ReactDOM\n\nNothing here.')).toThrow(/no `render\(\)` section/)
  })
})

// upgrade-guide.md is lines 355–440 of the real react.dev source at commit
// d4b8243582c3710978f8c45ee7ec676246a69306, copied verbatim.
describe('extractTargetRender (real react.dev source excerpt)', () => {
  const excerpt = extractTargetRender(guideMarkdown)

  it('extracts only the ReactDOM.render section and strips links', () => {
    expect(excerpt).toMatch(/^`ReactDOM\.render` was deprecated in March 2022 \(v18\.0\.0\)/)
    expect(excerpt).toContain('createRoot')
    expect(excerpt).not.toContain('ReactDOM.hydrate')
    expect(excerpt).not.toContain('](https://')
  })

  it('drops MDX heading ids and component tags but keeps code', () => {
    expect(excerpt).not.toContain('{/*')
    expect(excerpt).not.toMatch(/<\/?Note>/)
    expect(excerpt).toContain('render(<App />, document.getElementById(\'root\'));')
  })

  it('keeps a whole-line JSX tag inside a code fence', () => {
    const md = '#### Removed: `ReactDOM.render` {/*x*/}\n\n`ReactDOM.render` is gone.\n\n```js\n<App />\n```\n\n<Note>\n\nhi\n\n</Note>\n'
    const out = extractTargetRender(md)
    expect(out).toContain('<App />')
    expect(out).not.toContain('<Note>')
  })

  it('does not match renderToString-style headings', () => {
    const md = '## Removed: `ReactDOM.renderToString`\n\n`ReactDOM.render` mention padding padding padding.'
    expect(() => extractTargetRender(md)).toThrow(/no "Removed: ReactDOM.render" section/)
  })

  it('rejects an empty section', () => {
    expect(() => extractTargetRender('#### Removed: `ReactDOM.render`\n\n#### Next\n')).toThrow(/empty/)
  })
})

describe('boundExcerpt', () => {
  it('leaves short text alone and trims long text at a boundary with an ellipsis', () => {
    expect(boundExcerpt('short', 10)).toBe('short')
    const out = boundExcerpt(`${'a '.repeat(30)}\n\n${'b '.repeat(30)}`, 80)
    expect(out.endsWith(' …')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(82)
  })
})
