import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'

import { buildLlmsTxt, resolveSections } from '../lib/llms'
import { DOCS_URL, SITE_ORIGIN, SITE_SUMMARY, SITE_TITLE, sidebarSections } from '../site'

export const GET: APIRoute = async () => {
  const entries = await getCollection('docs')
  const pages = entries.map((entry) => ({
    slug: entry.id,
    title: entry.data.title,
    description: entry.data.description,
  }))
  const text = buildLlmsTxt({
    title: SITE_TITLE,
    summary: SITE_SUMMARY,
    intro: [
      `接入信息：OpenAI 格式的 Base URL 是 \`${SITE_ORIGIN}/v1\`，Claude 格式（Claude Code 用）的 Base URL 是 \`${SITE_ORIGIN}\`，API 密钥以 \`sk-\` 开头，在控制台「API 密钥」页创建。`,
      '每个链接都指向该页的 Markdown 版本。',
    ],
    docsUrl: DOCS_URL,
    sections: resolveSections(sidebarSections, pages),
  })
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
