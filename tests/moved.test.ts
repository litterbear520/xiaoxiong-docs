// Guards for the redirects of moved pages: an old address must not clash with a
// page that exists again, and every redirect must land on a page in the sidebar.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { sectionSlugs } from '../src/lib/sidebar'
import { movedAnchors, movedPages, sidebarSections } from '../src/site'

const root = join(import.meta.dirname, '../src/content/docs')
const inSidebar = sidebarSections.flatMap(sectionSlugs)
const hasPage = (slug: string) => ['.md', '.mdx'].some((ext) => existsSync(join(root, slug + ext)))

describe('moved pages', () => {
  it.each(Object.keys(movedPages))('%s is no longer a page of its own', (slug) => {
    expect(hasPage(slug)).toBe(false)
    expect(inSidebar).not.toContain(slug)
  })

  it.each(Object.entries(movedPages))('%s redirects to %s, a page in the sidebar', (_, to) => {
    expect(inSidebar).toContain(to)
  })

  it('sends moved anchors to pages in the sidebar, from moved pages only', () => {
    for (const [slug, anchors] of Object.entries(movedAnchors)) {
      expect(Object.keys(movedPages)).toContain(slug)
      for (const to of Object.values(anchors)) expect(inSidebar).toContain(to.split('#')[0])
    }
  })

  // the redirect keeps the old anchor unless the map names a new heading
  it.each(Object.values(movedAnchors).flatMap((anchors) => Object.entries(anchors)))('#%s lands on a heading of %s', (anchor, to) => {
    const [page, heading = anchor] = to.split('#')
    const source = readFileSync(join(root, `${page}.mdx`), 'utf8')
    expect(source).toMatch(new RegExp(`^#{2,6} ${heading}\\s*$`, 'm'))
  })
})
