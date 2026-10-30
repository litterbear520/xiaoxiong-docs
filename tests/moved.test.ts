// Guards for the redirects of moved pages: an old address must not clash with a
// page that exists again, and every redirect must land on a page in the sidebar.
import { existsSync } from 'node:fs'
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
      for (const to of Object.values(anchors)) expect(inSidebar).toContain(to)
    }
  })
})
