import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import starlightLinksValidator from 'starlight-links-validator'

import { toStarlightSidebar } from './src/lib/sidebar'
import { consoleLinks, DOCS_BASE, SITE_ORIGIN, SITE_SUMMARY, SITE_TITLE, sidebarSections } from './src/site'

// Every page here is a whole page load, slow over a long way to the server.
// Once a page has loaded, Chromium fetches the console's pages the site
// links go to (each the same small HTML file), and draws a docs page ahead once
// the pointer rests on its link, so a click shows the next page at once.
// No fetch on a mere touch of a link: begun only a moment before the click,
// Chromium waits for it, drops it and asks again (measured 10-30).
const SPECULATION_RULES = {
  prefetch: [
    {
      source: 'document',
      where: {
        and: [
          { selector_matches: '[data-site-bar] a[data-site-link], [data-sidebar-site-links] a' },
          { not: { href_matches: `${DOCS_BASE}/*` } },
        ],
      },
      eagerness: 'immediate',
    },
  ],
  prerender: [{ source: 'document', where: { href_matches: `${DOCS_BASE}/*` }, eagerness: 'moderate' }],
}

/** Adds the rules once the page has loaded and the browser is idle, so the
 *  fetches never compete with the first screen on a slow link. */
function speculateAfterLoad(rules: object) {
  return `addEventListener('load', () => {
  if (!HTMLScriptElement.supports?.('speculationrules')) return
  ;(window.requestIdleCallback || setTimeout)(() => {
    const rules = document.createElement('script')
    rules.type = 'speculationrules'
    rules.textContent = ${JSON.stringify(JSON.stringify(rules))}
    document.head.append(rules)
  })
})`
}

export default defineConfig({
  site: SITE_ORIGIN,
  base: DOCS_BASE,
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: SITE_TITLE,
      description: SITE_SUMMARY,
      logo: { src: './src/assets/logo.svg', alt: '小熊API' },
      favicon: '/favicon.ico',
      head: [
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${DOCS_BASE}/apple-touch-icon.png` } },
        { tag: 'link', attrs: { rel: 'alternate', type: 'text/plain', title: 'llms.txt', href: `${DOCS_BASE}/llms.txt` } },
        { tag: 'script', content: speculateAfterLoad(SPECULATION_RULES) },
      ],
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      sidebar: toStarlightSidebar(sidebarSections),
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      disable404Route: true,
      customCss: ['./src/styles/theme.css'],
      components: {
        PageTitle: './src/components/PageTitle.astro',
        Sidebar: './src/components/Sidebar.astro',
        Header: './src/components/SiteBar.astro',
        ThemeProvider: './src/components/ThemeProvider.astro',
        MobileMenuToggle: './src/components/MobileMenuToggle.astro',
      },
      expressiveCode: {
        themes: ['github-dark', 'github-light'],
        // White cards like Claude's docs: no terminal title bar with window
        // dots; a file name, when given, sits in a quiet header row.
        defaultProps: { frame: 'code', wrap: true },
        styleOverrides: {
          borderRadius: '0.6875rem',
          borderColor: 'var(--xx-hairline)',
          codeBackground: 'var(--xx-surface)',
          codeFontSize: '0.8125rem',
          codeLineHeight: '1.6',
          uiFontSize: '0.8125rem',
          frames: {
            frameBoxShadowCssValue: 'none',
            editorTabBarBackground: 'var(--xx-surface)',
            editorActiveTabBackground: 'var(--xx-surface)',
            editorActiveTabForeground: 'var(--sl-color-gray-3)',
            editorActiveTabBorderColor: 'transparent',
            editorTabBorderRadius: '0',
            editorActiveTabIndicatorTopColor: 'transparent',
            editorActiveTabIndicatorBottomColor: 'transparent',
            editorTabBarBorderBottomColor: 'var(--xx-hairline)',
            // A bare icon instead of a boxed button.
            inlineButtonBorderOpacity: '0',
            inlineButtonBackgroundIdleOpacity: '0',
            inlineButtonBackgroundHoverOrFocusOpacity: '0.1',
          },
        },
      },
      plugins: [starlightLinksValidator({ exclude: consoleLinks })],
    }),
  ],
})
