// Guards for the writing rules in the docs: every page explains itself in one
// line, readers are addressed as 「你」, and no real API key slips into an example.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { sectionSlugs } from '../src/lib/sidebar'
import { sidebarSections } from '../src/site'

const root = join(import.meta.dirname, '../src/content/docs')

function listPages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listPages(path)
    return /\.mdx?$/.test(entry.name) ? [path] : []
  })
}

const pages = listPages(root).map((path) => ({
  slug: relative(root, path).replace(/\.mdx?$/, ''),
  source: readFileSync(path, 'utf8'),
}))

describe('docs content', () => {
  it.each(pages)('$slug has a one-line description', ({ source }) => {
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
    expect(frontmatter).toMatch(/^description: .+/m)
  })

  // The description is the grey subtitle under the title, so it stays a short
  // task line.
  it.each(pages)('$slug keeps its subtitle short', ({ source }) => {
    const description = source.match(/^description: (.+)$/m)?.[1] ?? ''
    expect(description.length).toBeLessThanOrEqual(40)
  })

  it.each(pages)('$slug addresses the reader as 你, not 您', ({ source }) => {
    expect(source).not.toContain('您')
  })

  // Readers only need the lines and the 100 s limit, not what the lines run on.
  // Addresses are left out: a line's host name is fixed (apicdn.bearovo.top).
  it.each(pages)('$slug does not name the CDN behind the lines', ({ source }) => {
    const prose = source.replace(/https?:\/\/[^\s`)]+/g, '')
    expect(prose).not.toMatch(/cdn|cloudflare/i)
  })

  it.each(pages)('$slug contains no real-looking API key', ({ source }) => {
    expect(source).not.toMatch(/sk-[A-Za-z0-9]{20,}/)
  })

  it.each(pages)('$slug gives every image alt text', ({ source }) => {
    expect(source).not.toMatch(/!\[\s*\]\(/)
  })

  it('lists every page in the sidebar exactly once', () => {
    const inSidebar = sidebarSections.flatMap(sectionSlugs)
    const missing = pages.map((page) => page.slug).filter((slug) => !inSidebar.includes(slug))
    expect(missing).toEqual([])
    expect(inSidebar.length).toBe(new Set(inSidebar).size)
  })
})
