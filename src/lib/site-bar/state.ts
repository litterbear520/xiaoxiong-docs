// What the docs' site bar reads from the console, which runs on the same
// domain: its cached status, its theme and language choices, the read marks
// on notifications, and the account note it leaves for this bar. Everything
// here mirrors the console's rules; the console's files are named beside each.

import type { LanguageCode, Labels } from './labels'

/** new-api web/src/lib/status-query.ts STATUS_STORAGE_KEY */
export const STATUS_KEY = 'status'
/** new-api web/src/lib/theme-storage.ts THEME_STORAGE_KEYS.mode */
export const THEME_KEY = 'newapi:theme:v1:mode'
/** Starlight's own key, used by these docs before they shared the console's. */
export const LEGACY_THEME_KEY = 'starlight-theme'
/** i18next's default localStorage key (new-api web/src/i18n/config.ts) */
export const LANGUAGE_KEY = 'i18nextLng'
/** new-api web/src/stores/notification-store.ts persist name */
export const READ_MARKS_KEY = 'notification-storage'
/** new-api web/src/components/site-bar/account-note.ts */
export const ACCOUNT_NOTE_KEY = 'newapi:site-bar:v1:account'
/** new-api web/src/components/site-bar/handoff.ts (sessionStorage) */
export const HANDOFF_KEY = 'newapi:site-bar:v1:handoff'
/** The server's session-hint cookie (new-api web/src/lib/session-hint.ts) */
export const SESSION_HINT_COOKIE = 'new_api_has_session'

export type Theme = 'light' | 'dark'

export type SiteLink = { title: string; href: string; current: boolean }

export type AccountNote = {
  name: string
  detail: string
  avatar: { text: string; background: string }
  superAdmin: boolean
}

export type ReadMarks = { readAnnouncementKeys?: string[]; lastReadNotice?: string }

type Status = Record<string, unknown>

// --- site links (new-api web/src/lib/nav-modules.ts, hooks/use-top-nav-links.ts)

function flag(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === 'boolean') return raw
  if (raw === 1 || raw === 0) return raw === 1
  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase()
    if (value === 'true' || value === '1') return true
    if (value === 'false' || value === '0') return false
  }
  return fallback
}

/** A module like 模型广场 is a flag or `{ enabled, requireAuth }`. */
function enabled(raw: unknown): boolean {
  if (raw && typeof raw === 'object') return flag((raw as Record<string, unknown>).enabled, true)
  return flag(raw, true)
}

function navModules(status: Status | null): Record<string, unknown> | null {
  const raw = status?.HeaderNavModules
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  if (typeof raw !== 'string' || raw.trim() === '') return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

/** The live site's switches, for a reader whose browser has no cached status yet. */
const LIVE_MODULES: Record<string, unknown> = { pricing: true, rankings: false, about: false }

/**
 * The site-wide links in the console's order, 文档 lit. The admin's switches
 * come from the console's cached status; empty switches mean all on.
 */
export function siteLinks(status: Status | null, labels: Labels): SiteLink[] {
  const modules = status ? (navModules(status) ?? {}) : LIVE_MODULES
  const on = (key: string) => (key in modules ? enabled(modules[key]) : true)
  const docsHref = typeof status?.docs_link === 'string' && status.docs_link ? status.docs_link : '/docs/'
  const links: SiteLink[] = []
  const add = (title: string, href: string, current = false) => links.push({ title, href, current })
  if (on('home')) add(labels.Home, '/')
  if (on('console')) add(labels.Console, '/dashboard')
  if (on('pricing')) add(labels['Model Square'], '/pricing')
  add(labels.Offers, '/activity')
  if (on('rankings')) add(labels.Rankings, '/rankings')
  if (on('docs')) add(labels.Docs, docsHref, true)
  if (on('about')) add(labels.About, '/about')
  return links
}

// --- account

/**
 * The console's note on who is signed in, trusted only while the server's
 * session hint is still set: signed out or expired, the docs show 登录.
 */
export function accountFromNote(hasSessionHint: boolean, raw: string | null): AccountNote | null {
  if (!hasSessionHint || !raw) return null
  try {
    const note = JSON.parse(raw) as Partial<AccountNote>
    if (typeof note.name !== 'string' || typeof note.avatar?.text !== 'string') return null
    return {
      name: note.name,
      detail: typeof note.detail === 'string' ? note.detail : '',
      avatar: { text: note.avatar.text, background: String(note.avatar.background ?? '') },
      superAdmin: note.superAdmin === true,
    }
  } catch {
    return null
  }
}

// --- theme (new-api web/src/context/theme-provider.tsx: 'light' | 'dark' | 'system')

/** The reader's choice, or null to follow the system. */
export function storedTheme(main: string | null, legacy: string | null): Theme | null {
  if (main === 'light' || main === 'dark') return main
  if (main !== null) return null
  // never chosen in the console: an old choice made here still counts
  return legacy === 'light' || legacy === 'dark' ? legacy : null
}

/** The console's button flips light and dark and remembers the choice. */
export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark'
}

// --- language (new-api web/src/i18n/languages.ts)

const CODES: readonly LanguageCode[] = ['zhCN', 'en', 'fr', 'ru', 'ja', 'vi', 'zhTW']

function fromTag(tag: string): LanguageCode | null {
  const lower = tag.trim().replaceAll('_', '-').toLowerCase()
  if (lower.startsWith('zh')) {
    return /^zh-?(tw|hk|mo|hant)/.test(lower) ? 'zhTW' : 'zhCN'
  }
  const base = lower.split('-')[0]
  return CODES.find((code) => code === base) ?? null
}

/** The console's interface language: its saved choice, else the browser's, else English. */
export function interfaceLanguage(saved: string | null, browser: string): LanguageCode {
  if (saved && (CODES as readonly string[]).includes(saved)) return saved as LanguageCode
  return (saved && fromTag(saved)) || fromTag(browser) || 'en'
}

// --- notifications (new-api web/src/hooks/use-notifications.ts)

function hashString(input: string): string {
  let hash = 0
  if (!input) return '0'
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return hash.toString(36)
}

export function announcementKey(item: Record<string, unknown>): string {
  if (item.id !== undefined && item.id !== null) return `id:${item.id}`
  const text = (key: string) => String(item[key] ?? '').trim()
  const fingerprint = JSON.stringify({
    publishDate: String(item.publishDate ?? ''),
    content: text('content'),
    extra: text('extra'),
    type: String(item.type ?? ''),
    title: text('title'),
    link: text('link'),
  })
  return `hash:${hashString(fingerprint)}`
}

/** The announcements the console shows: the first 20, when switched on. */
export function announcements(status: Status | null): Record<string, unknown>[] {
  if (!status?.announcements_enabled || !Array.isArray(status.announcements)) return []
  return (status.announcements as Record<string, unknown>[]).slice(0, 20)
}

/** The bell's count: unread announcements, plus one for a notice not yet read. */
export function unreadCount(status: Status | null, marks: ReadMarks | null, notice: string): number {
  const read = new Set(marks?.readAnnouncementKeys ?? [])
  const unreadAnnouncements = announcements(status).filter((item) => !read.has(announcementKey(item))).length
  const noticeUnread = notice.trim() && notice.trim() !== (marks?.lastReadNotice ?? '') ? 1 : 0
  return unreadAnnouncements + noticeUnread
}

// --- handoff (new-api web/src/components/site-bar/handoff.ts)

/**
 * How far the bar had come together on the page this one was opened from,
 * read from what that page left; a reload or another site gives 0.
 */
/** Notes older than this are from another visit. */
const NOTE_MS = 3000

/**
 * How the page was opened: `prerendered` when the browser drew it ahead
 * (speculation rules) and showed it on the click. Such a page's referrer is
 * where the drawing started, which may be an earlier address of a console
 * that moved on since, so its notes count by their age instead.
 */
export type Arrival = { prerendered: boolean; now: number }

const OPENED: Arrival = { prerendered: false, now: 0 }

function leftByOpener(note: { from?: unknown; at?: unknown }, referrer: string, arrival: Arrival, fresh: boolean) {
  const age = typeof note.at === 'number' ? arrival.now - note.at : Number.NaN
  const recent = age >= 0 && age <= NOTE_MS
  if (arrival.prerendered) return recent
  return !!referrer && note.from === referrer && (!fresh || recent)
}

export function handoffStart(raw: string | null, referrer: string, arrival: Arrival = OPENED): number {
  if (!raw) return 0
  try {
    const note = JSON.parse(raw) as { q?: unknown; from?: unknown; at?: unknown }
    return leftByOpener(note, referrer, arrival, false) && typeof note.q === 'number' ? Math.min(1, Math.max(0, note.q)) : 0
  } catch {
    return 0
  }
}

/** new-api web/src/components/site-bar/handoff.ts LENS_HANDOFF_KEY (sessionStorage) */
export const LENS_HANDOFF_KEY = 'newapi:site-bar:v1:lens'

/** The lens's edges in px from the links' left, and their speeds in px/s. */
export type LensNote = { left: number; right: number; vLeft: number; vRight: number }

/** Where the page this one was opened from left its lens, if fresh. */
export function lensNote(raw: string | null, referrer: string, arrival: Arrival): LensNote | null {
  if (!raw) return null
  try {
    const note = JSON.parse(raw) as Record<string, unknown>
    const { left, right, vLeft, vRight } = note
    const numbers = [left, right, vLeft, vRight].every((n) => typeof n === 'number' && Number.isFinite(n))
    if (!numbers || !leftByOpener(note, referrer, arrival, true)) return null
    return { left, right, vLeft, vRight } as LensNote
  } catch {
    return null
  }
}
