import { describe, expect, it } from 'vitest'

import { breadcrumbFor, sectionSlugs, toStarlightSidebar, type SidebarSection } from '../src/lib/sidebar'

const sections: SidebarSection[] = [
  { label: '快速上手', items: [{ slug: 'index', label: '简介' }, 'quickstart'] },
  {
    label: '集成指南',
    items: [
      { label: '桌面客户端', items: ['tools/cherry-studio'] },
      { label: '编码工具（命令行）', items: ['tools/claude-code', { slug: 'tools/codex', label: 'Codex' }] },
    ],
  },
]

describe('sectionSlugs', () => {
  it('lists pages in sidebar order, including those under sub-labels', () => {
    expect(sections.map(sectionSlugs)).toEqual([
      ['index', 'quickstart'],
      ['tools/cherry-studio', 'tools/claude-code', 'tools/codex'],
    ])
  })
})

describe('breadcrumbFor', () => {
  it('names the group a page sits in', () => {
    expect(breadcrumbFor(sections, 'quickstart')).toEqual(['快速上手'])
  })

  it('adds the sub-label for pages under one', () => {
    expect(breadcrumbFor(sections, 'tools/codex')).toEqual(['集成指南', '编码工具（命令行）'])
  })

  it('treats the empty route id as the home page', () => {
    expect(breadcrumbFor(sections, '')).toEqual(['快速上手'])
  })

  it('returns nothing for pages outside the sidebar', () => {
    expect(breadcrumbFor(sections, '404')).toEqual([])
  })
})

describe('toStarlightSidebar', () => {
  it('collapses groups, keeps label overrides and nests sub-labels', () => {
    expect(toStarlightSidebar(sections)).toEqual([
      {
        label: '快速上手',
        collapsed: true,
        items: [{ slug: 'index', label: '简介' }, 'quickstart'],
      },
      {
        label: '集成指南',
        collapsed: true,
        items: [
          { label: '桌面客户端', items: ['tools/cherry-studio'] },
          { label: '编码工具（命令行）', items: ['tools/claude-code', { slug: 'tools/codex', label: 'Codex' }] },
        ],
      },
    ])
  })
})
