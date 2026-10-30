// Turns a page's MDX source into plain Markdown for the 「复制页面」 button and
// the per-page .md files linked from llms.txt. Only the handful of Starlight
// components these docs use are understood; anything else that is pure layout
// is dropped so AI tools get clean text.

const ASIDE_LABELS: Record<string, string> = {
  note: '说明',
  tip: '提示',
  caution: '注意',
  danger: '警告',
}

export function markdownPathFor(slug: string): string {
  return slug === '' || slug === 'index' ? 'index.md' : `${slug}.md`
}

function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`))
  return match ? (match[1] ?? match[2]) : undefined
}

// Root-relative Markdown links become absolute, except inside `inline code`.
function absolutizeLinks(line: string, origin: string): string {
  return line
    .split(/(`[^`]*`)/)
    .map((part) => (part.startsWith('`') ? part : part.replace(/\]\(\/(?!\/)/g, `](${origin}/`)))
    .join('')
}

const DROPPED_TAG = /^<\/?(Steps|Tabs|CardGrid|div|section|span)\b[^>]*>$/
const SELF_CLOSING_COMPONENT = /^<[A-Z][\w.]*\b[^>]*\/>$/
// Screenshots point into src/assets, which only the Astro build can resolve.
const IMAGE_LINE = /^!\[([^\]]+)\]\([^)]*\)$/

export function mdxToMarkdown(body: string, options: { origin?: string } = {}): string {
  const out: string[] = []
  let fence: string | null = null
  // Lines of the aside being collected, already stripped of its indentation.
  let aside: { indent: string; lines: string[] } | null = null

  const emit = (line: string) => {
    if (aside) aside.lines.push(line.startsWith(aside.indent) ? line.slice(aside.indent.length) : line.trimStart())
    else out.push(line)
  }

  const closeAside = () => {
    if (!aside) return
    const lines = aside.lines
    while (lines.length > 0 && lines[0].trim() === '') lines.shift()
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
    for (const line of lines) out.push(line.trim() === '' ? `${aside.indent}>` : `${aside.indent}> ${line}`)
    aside = null
  }

  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    const indent = line.slice(0, line.length - line.trimStart().length)

    if (fence !== null) {
      emit(line)
      // A closing fence is the same character, at least as long, with no info string.
      if (trimmed[0] === fence[0] && /^(`{3,}|~{3,})$/.test(trimmed) && trimmed.length >= fence.length) {
        fence = null
      }
      continue
    }
    const fenceOpen = trimmed.match(/^(`{3,}|~{3,})/)
    if (fenceOpen) {
      fence = fenceOpen[1]
      emit(line)
      continue
    }

    if (/^import\s.+\sfrom\s+['"][^'"]+['"];?$/.test(trimmed)) continue

    if (trimmed.startsWith('<Aside')) {
      const type = attr(trimmed, 'type') ?? 'note'
      const title = attr(trimmed, 'title') ?? ASIDE_LABELS[type] ?? ASIDE_LABELS.note
      out.push(`${indent}> **${title}**`, `${indent}>`)
      aside = { indent, lines: [] }
      continue
    }
    if (trimmed === '</Aside>') {
      closeAside()
      continue
    }

    if (trimmed.startsWith('<TabItem')) {
      emit(`${indent}**${attr(trimmed, 'label') ?? ''}**`)
      continue
    }
    if (trimmed === '</TabItem>') continue

    if (trimmed.startsWith('<LinkCard')) {
      const title = attr(trimmed, 'title') ?? ''
      const href = attr(trimmed, 'href') ?? ''
      const description = attr(trimmed, 'description')
      const item = `${indent}- [${title}](${href})${description ? `：${description}` : ''}`
      emit(options.origin ? absolutizeLinks(item, options.origin) : item)
      continue
    }

    if (DROPPED_TAG.test(trimmed) || SELF_CLOSING_COMPONENT.test(trimmed)) continue

    const image = trimmed.match(IMAGE_LINE)
    if (image) {
      emit(`${indent}（截图：${image[1]}）`)
      continue
    }

    emit(options.origin ? absolutizeLinks(line, options.origin) : line)
  }
  closeAside()

  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

export function renderPageMarkdown(page: {
  title: string
  description?: string
  body: string
  origin?: string
}): string {
  const head = [`# ${page.title}`]
  if (page.description) head.push(`> ${page.description}`)
  return `${head.join('\n\n')}\n\n${mdxToMarkdown(page.body, { origin: page.origin })}`
}
