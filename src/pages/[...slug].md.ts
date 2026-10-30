// Serves every docs page as Markdown at /docs/<slug>.md for the 「复制页面」
// button and for AI tools that follow links from llms.txt. A moved page's old
// .md address serves its new page, since a static .md file can't redirect.
import type { APIRoute, GetStaticPaths } from 'astro'
import { getCollection, type CollectionEntry } from 'astro:content'

import { markdownPathFor, renderPageMarkdown } from '../lib/markdown'
import { movedPages, SITE_ORIGIN } from '../site'

export const getStaticPaths = (async () => {
  const entries = await getCollection('docs')
  const pages = entries.map((entry) => ({
    params: { slug: markdownPathFor(entry.id).replace(/\.md$/, '') },
    props: { entry },
  }))
  const moved = Object.entries(movedPages).flatMap(([slug, to]) => {
    const entry = entries.find(({ id }) => id === to)
    return entry ? [{ params: { slug }, props: { entry } }] : []
  })
  return [...pages, ...moved]
}) satisfies GetStaticPaths

export const GET: APIRoute<{ entry: CollectionEntry<'docs'> }> = ({ props }) => {
  const { entry } = props
  const markdown = renderPageMarkdown({
    title: entry.data.title,
    description: entry.data.description,
    body: entry.body ?? '',
    origin: SITE_ORIGIN,
  })
  return new Response(markdown, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
}
