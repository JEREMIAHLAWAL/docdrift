import { describe, expect, it } from 'vitest'
import { browserProxyAllowed } from './integrations'

describe('browserProxyAllowed', () => {
  it('blocks owner-billed integrations from the browser proxy', () => {
    for (const name of ['github', 'firecrawl', 'cloudflare', 'openai', 'exa']) {
      expect(browserProxyAllowed(name)).toBe(false)
    }
  })

  it('keeps user-billed integrations available', () => {
    expect(browserProxyAllowed('google')).toBe(true)
  })

  it('ignores prototype keys', () => {
    expect(browserProxyAllowed('constructor')).toBe(false)
    expect(browserProxyAllowed('__proto__')).toBe(false)
  })
})
