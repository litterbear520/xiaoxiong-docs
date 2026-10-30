// Builds /docs/llms.txt (https://llmstxt.org): a Markdown index that tells AI
// tools what each page covers and where its Markdown version lives.
import { markdownPathFor } from './markdown'
import { isSubgroup, toLink, type SidebarSection } from './sidebar'

export interface DocPage {
  slug: string
  title: string
  description?: string
}

/** A run of pages; `label` is the sidebar's sub-label, if the run has one. */
export interface ResolvedGroup {
  label?: string
  pages: DocPage[]
}

export interface ResolvedSection {
  label: string
  groups: ResolvedGroup[]
}

export function resolveSections(sections: SidebarSection[], pages: DocPage[]): ResolvedSection[] {
  const bySlug = new Map(pages.map((page) => [page.slug, page]))
  const pageFor = (slug: string) => {
    const page = bySlug.get(slug)
    if (!page) throw new Error(`Sidebar links to a page that does not exist: ${slug}`)
    return page
  }

  return sections.map((section) => {
    const groups: ResolvedGroup[] = []
    for (const item of section.items) {
      if (isSubgroup(item)) {
        groups.push({ label: item.label, pages: item.items.map((child) => pageFor(toLink(child).slug)) })
        continue
      }
      // In Markdown a plain link after a ### sub-label would read as part of it.
      if (groups.some((group) => group.label)) {
        throw new Error(`Put pages before sub-labels in sidebar group ${section.label}: ${toLink(item).slug}`)
      }
      if (groups.length === 0) groups.push({ pages: [] })
      groups[0].pages.push(pageFor(toLink(item).slug))
    }
    return { label: section.label, groups }
  })
}

export function buildLlmsTxt(input: {
  title: string
  summary: string
  intro: string[]
  docsUrl: string
  sections: ResolvedSection[]
}): string {
  const lines = [`# ${input.title}`, '', `> ${input.summary}`, '']
  for (const paragraph of input.intro) lines.push(paragraph, '')
  for (const section of input.sections) {
    lines.push(`## ${section.label}`, '')
    for (const group of section.groups) {
      if (group.label) lines.push(`### ${group.label}`, '')
      for (const page of group.pages) {
        const url = `${input.docsUrl}/${markdownPathFor(page.slug)}`
        lines.push(`- [${page.title}](${url})${page.description ? `: ${page.description}` : ''}`)
      }
      lines.push('')
    }
  }
  return lines.join('\n')
}
