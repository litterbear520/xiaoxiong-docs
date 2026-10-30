// The docs' sidebar as plain data: groups of pages, optionally split by small
// sub-labels. Starlight's sidebar config, /docs/llms.txt and the breadcrumb
// above each page title are all built from it, so they never disagree.

export interface SidebarLink {
  slug: string
  /** Name in the sidebar only; the page keeps its own title everywhere else. */
  label?: string
}

export type SidebarItem = string | SidebarLink

/** A small grey label inside a group, with the pages listed under it. */
export interface SidebarSubgroup {
  label: string
  items: SidebarItem[]
}

export interface SidebarSection {
  label: string
  /** Pages listed straight under the group come before any sub-labels. */
  items: Array<SidebarItem | SidebarSubgroup>
}

export function isSubgroup(item: SidebarItem | SidebarSubgroup): item is SidebarSubgroup {
  return typeof item !== 'string' && 'items' in item
}

export function toLink(item: SidebarItem): SidebarLink {
  return typeof item === 'string' ? { slug: item } : item
}

/** Every page slug in a section, in sidebar order. */
export function sectionSlugs(section: SidebarSection): string[] {
  return section.items.flatMap((item) =>
    isSubgroup(item) ? item.items.map((child) => toLink(child).slug) : [toLink(item).slug]
  )
}

/**
 * Where a page sits, shown as the breadcrumb above its title: the group, then
 * the sub-label if the page has one (集成指南 › 编码工具（命令行）).
 */
export function breadcrumbFor(sections: SidebarSection[], slug: string): string[] {
  const target = slug === '' ? 'index' : slug
  for (const section of sections) {
    for (const item of section.items) {
      if (isSubgroup(item)) {
        if (item.items.some((child) => toLink(child).slug === target)) return [section.label, item.label]
      } else if (toLink(item).slug === target) {
        return [section.label]
      }
    }
  }
  return []
}

// The subset of Starlight's sidebar config these docs use.
type StarlightLink = string | { slug: string; label: string }
interface StarlightGroup {
  label: string
  collapsed?: boolean
  items: Array<StarlightLink | StarlightGroup>
}

function toStarlightLink(item: SidebarItem): StarlightLink {
  const link = toLink(item)
  return link.label ? { slug: link.slug, label: link.label } : link.slug
}

/**
 * Starlight sidebar config. Groups start collapsed, so only the reader's
 * current group is open; sub-labels become nested groups, which
 * src/components/Sidebar.astro draws as plain labels.
 */
export function toStarlightSidebar(sections: SidebarSection[]): StarlightGroup[] {
  return sections.map((section) => ({
    label: section.label,
    collapsed: true,
    items: section.items.map((item) =>
      isSubgroup(item) ? { label: item.label, items: item.items.map(toStarlightLink) } : toStarlightLink(item)
    ),
  }))
}
