import type { SidebarSection } from './lib/sidebar'

export const SITE_TITLE = '小熊API 文档'
export const SITE_SUMMARY =
  '小熊API 用一个 API 密钥提供 GPT、Claude 和 Gemini 的对话和图片模型，支持 OpenAI、Claude 和 Gemini 三种接口格式。'

// Examples always use the main line; the other lines are listed on 线路选择.
export const SITE_ORIGIN = 'https://api.little-bear.app'
export const DOCS_BASE = '/docs'
export const DOCS_URL = `${SITE_ORIGIN}${DOCS_BASE}`

// Single source for the sidebar, llms.txt and the section label above each
// page title, so all three list the same pages in the same order.
export const sidebarSections: SidebarSection[] = [
  {
    label: '快速上手',
    items: [{ slug: 'index', label: '简介' }, 'quickstart', 'auth', 'lines'],
  },
  {
    label: '集成指南',
    items: [
      { label: '准备工作', items: ['tools/cc-switch'] },
      { label: '桌面客户端', items: ['tools/cherry-studio'] },
      { label: '编码工具（命令行）', items: ['tools/claude-code', 'tools/codex', 'tools/gemini-cli', 'tools/pi', 'tools/opencode'] },
      { label: '编辑器和插件', items: ['tools/cursor', 'tools/cline'] },
    ],
  },
  {
    label: 'API 参考',
    items: ['openai', 'claude', 'gemini', 'images', 'errors'],
  },
  {
    label: '使用指南',
    items: ['models', 'billing', 'streaming', 'error-handling', 'draw', 'faq', 'changelog'],
  },
  {
    label: 'SDK 与工具库',
    items: ['sdk/curl', 'sdk/openai', 'sdk/anthropic', 'sdk/google-genai'],
  },
]

// Old page addresses that moved in the 2026-10-28 rewrite; each one redirects
// to its new page so links from the console and outside keep working.
export const movedPages: Record<string, string> = {
  api: 'openai',
  'models-and-billing': 'models',
  account: 'billing',
}

// Old anchors on a moved page whose section went to a different new page:
// `page` keeps the old anchor, `page#heading` when the heading changed too.
export const movedAnchors: Record<string, Record<string, string>> = {
  'models-and-billing': { 计费方式: 'billing', 余额与充值: 'billing', 用量与限额: 'billing#密钥额度' },
}

export const consoleLinks = [
  '/',
  '/dashboard',
  '/dashboard/models',
  '/keys',
  '/draw',
  '/draw/classic',
  '/wallet',
  '/pricing',
  '/usage-logs/common',
  '/sign-in',
  '/sign-up',
  '/profile',
]
