import { describe, expect, it } from 'vitest'

import {
  accountFromNote,
  announcementKey,
  handoffStart,
  interfaceLanguage,
  lensNote,
  nextTheme,
  siteLinks,
  storedTheme,
  unreadCount,
} from '../src/lib/site-bar/state'
import { LABELS } from '../src/lib/site-bar/labels'
import { lensAt, magnifierOpacity, nearestLink } from '../src/lib/site-bar/lens'
import { dockRim, refractionMap, type RefractionMap } from '../src/lib/site-bar/refraction'

const zh = LABELS.zhCN

describe('siteLinks', () => {
  it('without a cached status, shows the live set with 文档 lit', () => {
    expect(siteLinks(null, zh)).toEqual([
      { title: '主页', href: '/', current: false },
      { title: '控制台', href: '/dashboard', current: false },
      { title: '模型广场', href: '/pricing', current: false },
      { title: '活动', href: '/activity', current: false },
      { title: '文档', href: '/docs/', current: true },
    ])
  })

  it('follows the admin switches in the cached status, like the console', () => {
    const status = {
      HeaderNavModules: JSON.stringify({
        home: true,
        console: true,
        pricing: { enabled: false, requireAuth: false },
        rankings: { enabled: true, requireAuth: false },
        docs: true,
        about: false,
      }),
    }
    expect(siteLinks(status, zh).map((l) => l.title)).toEqual(['主页', '控制台', '活动', '排行榜', '文档'])
  })

  it('treats an empty switch list as everything on, as the console does', () => {
    expect(siteLinks({ HeaderNavModules: '' }, zh).map((l) => l.title)).toEqual([
      '主页',
      '控制台',
      '模型广场',
      '活动',
      '排行榜',
      '文档',
      '关于',
    ])
  })

  it('writes the links in the reader\'s language', () => {
    expect(siteLinks(null, LABELS.en).map((l) => l.title)).toEqual(['Home', 'Console', 'Model Square', 'Offers', 'Docs'])
  })
})

describe('accountFromNote', () => {
  const note = JSON.stringify({
    name: '小熊',
    detail: '普通用户 · default',
    avatar: { text: 'X', background: 'hsl(10 55% 55%)' },
    superAdmin: false,
  })

  it('shows the console\'s note while the server still says a session exists', () => {
    expect(accountFromNote(true, note)?.name).toBe('小熊')
  })

  it('ignores the note once the session hint is gone (signed out or expired)', () => {
    expect(accountFromNote(false, note)).toBeNull()
  })

  it('ignores a missing or broken note', () => {
    expect(accountFromNote(true, null)).toBeNull()
    expect(accountFromNote(true, '{oops')).toBeNull()
    expect(accountFromNote(true, '{"name":"x"}')).toBeNull()
  })
})

describe('storedTheme', () => {
  it('uses the console\'s choice', () => {
    expect(storedTheme('dark', null)).toBe('dark')
    expect(storedTheme('light', 'dark')).toBe('light')
  })

  it('follows the system when the console says so', () => {
    expect(storedTheme('system', 'dark')).toBeNull()
  })

  it('takes over the docs\' old choice once, while the console has none', () => {
    expect(storedTheme(null, 'dark')).toBe('dark')
    expect(storedTheme(null, '')).toBeNull()
  })
})

describe('nextTheme', () => {
  it('flips between light and dark, like the console\'s button', () => {
    expect(nextTheme('dark')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
  })
})

describe('interfaceLanguage', () => {
  it('reads the console\'s language codes', () => {
    expect(interfaceLanguage('zhTW', 'en-US')).toBe('zhTW')
    expect(interfaceLanguage('ja', 'zh-CN')).toBe('ja')
  })

  it('falls back to the browser, then to English', () => {
    expect(interfaceLanguage(null, 'zh-CN')).toBe('zhCN')
    expect(interfaceLanguage(null, 'zh-HK')).toBe('zhTW')
    expect(interfaceLanguage(null, 'fr-FR')).toBe('fr')
    expect(interfaceLanguage('xx', 'de-DE')).toBe('en')
  })
})

describe('unread notifications', () => {
  it('keys announcements like the console: by id, else by a hash of their content', () => {
    expect(announcementKey({ id: 3 })).toBe('id:3')
    expect(announcementKey({ content: 'hello', publishDate: '2026-10-28' })).toMatch(/^hash:/)
  })

  it('counts unread announcements and a changed notice', () => {
    const status = {
      announcements_enabled: true,
      announcements: [{ id: 1 }, { id: 2 }, { id: 3 }],
    }
    const read = { readAnnouncementKeys: ['id:1'], lastReadNotice: 'old' }
    expect(unreadCount(status, read, 'new notice')).toBe(3)
    expect(unreadCount(status, read, 'old')).toBe(2)
  })

  it('counts nothing when announcements are off and there is no notice', () => {
    expect(unreadCount({ announcements_enabled: false, announcements: [{ id: 1 }] }, null, '')).toBe(0)
  })
})

describe('handoffStart', () => {
  const from = 'https://api.little-bear.app/pricing'

  it('starts where the bar stood on the page this one was opened from', () => {
    expect(handoffStart(JSON.stringify({ q: 1, from }), from)).toBe(1)
  })

  it('starts split after a reload or from another page', () => {
    expect(handoffStart(JSON.stringify({ q: 1, from }), '')).toBe(0)
    expect(handoffStart(JSON.stringify({ q: 1, from }), 'https://api.little-bear.app/activity')).toBe(0)
    expect(handoffStart('{oops', from)).toBe(0)
  })

  it('drawn ahead and shown on the click, takes a note left a moment ago', () => {
    const note = JSON.stringify({ q: 1, from, at: 1000 })
    // the referrer is where the drawing started, maybe an earlier page
    expect(handoffStart(note, 'https://api.little-bear.app/activity', { prerendered: true, now: 1800 })).toBe(1)
    expect(handoffStart(note, from, { prerendered: true, now: 1000 + 3001 })).toBe(0)
    expect(handoffStart(JSON.stringify({ q: 1, from }), from, { prerendered: true, now: 1800 })).toBe(0)
  })
})

describe('lensNote', () => {
  const from = 'https://api.little-bear.app/pricing'
  const note = (extra: object = {}) =>
    JSON.stringify({ left: 10, right: 70, vLeft: 400, vRight: 900, from, at: 1000, ...extra })
  const opened = { prerendered: false, now: 1500 }

  it('reads a fresh note from the page this one was opened from', () => {
    expect(lensNote(note(), from, opened)).toEqual({ left: 10, right: 70, vLeft: 400, vRight: 900 })
  })

  it('drawn ahead, reads it by its age alone', () => {
    expect(lensNote(note(), '', { prerendered: true, now: 1500 })).toEqual({ left: 10, right: 70, vLeft: 400, vRight: 900 })
  })

  it('skips a note from another page, a stale one and a broken one', () => {
    expect(lensNote(note(), 'https://api.little-bear.app/activity', opened)).toBe(null)
    expect(lensNote(note(), '', opened)).toBe(null)
    expect(lensNote(note(), from, { prerendered: false, now: 1000 + 3001 })).toBe(null)
    expect(lensNote(note({ left: 'x' }), from, opened)).toBe(null)
    expect(lensNote('{oops', from, opened)).toBe(null)
    expect(lensNote(null, from, opened)).toBe(null)
  })
})

describe('the dragged lens', () => {
  // three links: 60px, 100px and 60px wide, 10px apart
  const spans = [
    { left: 0, right: 60 },
    { left: 70, right: 170 },
    { left: 180, right: 240 },
  ]

  it('is centred on the finger and as wide as the link under it', () => {
    const lens = lensAt(spans, 120)
    expect((lens.left + lens.right) / 2).toBe(120)
    expect(lens.right - lens.left).toBe(100)
  })

  it('takes a width between two links while between them', () => {
    const lens = lensAt(spans, 75)
    expect(lens.right - lens.left).toBe(80)
  })

  it('follows the finger only part of the way past the last link', () => {
    const lens = lensAt(spans, 310)
    const middle = (lens.left + lens.right) / 2
    expect(middle).toBeGreaterThan(210)
    expect(middle).toBeLessThan(310)
  })

  it('moves only a little further however far past the ends it is pulled', () => {
    const middle = (x: number) => {
      const lens = lensAt(spans, x)
      return (lens.left + lens.right) / 2
    }
    expect(middle(50_000)).toBeLessThanOrEqual(222)
    expect(middle(-50_000)).toBeGreaterThanOrEqual(18)
  })

  it('keeps the magnifier whole on the way down until the lens stops covering the words', () => {
    expect(magnifierOpacity(1.2, false)).toBe(1)
    expect(magnifierOpacity(1.02, false)).toBe(1)
    expect(magnifierOpacity(1.005, false)).toBe(0)
  })

  it('brings the magnifier in as the lens swells', () => {
    expect(magnifierOpacity(1, true)).toBe(0)
    expect(magnifierOpacity(1.1, true)).toBeCloseTo(0.5)
    expect(magnifierOpacity(1.2, true)).toBeCloseTo(1)
  })

  it('stays inside the bar when swollen, wherever the finger is', () => {
    const bounds = { left: -2, right: 300 }
    for (const x of [-50_000, -5, 0, 30, 120, 210, 300, 50_000]) {
      const lens = lensAt(spans, x, bounds, 1.2)
      const half = ((lens.right - lens.left) / 2) * 1.2
      const middle = (lens.left + lens.right) / 2
      expect(middle - half).toBeGreaterThanOrEqual(bounds.left - 1e-9)
      expect(middle + half).toBeLessThanOrEqual(bounds.right + 1e-9)
    }
  })

  it('lets go on the link whose middle is nearest', () => {
    expect(nearestLink(spans, 70)).toBe(0)
    expect(nearestLink(spans, 80)).toBe(1)
    expect(nearestLink(spans, 400)).toBe(2)
  })
})

// The console's numbers (new-api web/src/lib/__tests__/liquid-glass.test.ts): both bars must
// stay the same glass.
describe('dockRim', () => {
  it('is the curve measured on the 75px Dock: 20px at the edge, gone 12px in', () => {
    const rim = dockRim(75)
    expect(rim(0.001)).toBeCloseTo(20, 1)
    expect(rim(6)).toBeCloseTo(20 * 0.5 ** 1.9)
    expect(rim(12)).toBe(0)
    expect(rim(30)).toBe(0)
  })

  it('scales with the pane: 6.4px wide and 10.7px at most on the 40px bar', () => {
    const rim = dockRim(40)
    expect(rim(0.001)).toBeCloseTo(10.67, 1)
    expect(rim(6.3)).toBeGreaterThan(0)
    expect(rim(6.4)).toBe(0)
  })

  it('leaves the outside of the pane alone', () => {
    expect(dockRim(40)(0)).toBe(0)
    expect(dockRim(40)(-3)).toBe(0)
  })
})

describe('refractionMap with the Dock rim', () => {
  const bar = { width: 161, height: 40, radius: 20, rim: dockRim(40) }
  const map = refractionMap(bar)
  /** The x and y shift a map gives one pixel, from -127 to 127. */
  const shiftAt = (m: RefractionMap, x: number, y: number) => {
    const i = (y * m.width + x) * 4
    return { x: m.pixels[i] - 128, y: m.pixels[i + 1] - 128 }
  }

  it('moves nothing past the 6.4px band along its edges', () => {
    for (let x = 20; x < 141; x++) {
      for (let y = 7; y < 33; y++) {
        expect(shiftAt(map, x, y)).toEqual({ x: 0, y: 0 })
      }
    }
  })

  it('moves nothing past the band inside a round end', () => {
    // about 9px from the end's centre on the diagonal, 11px in from its arc
    expect(shiftAt(map, 13, 13)).toEqual({ x: 0, y: 0 })
  })

  it('bends the top and the bottom alike', () => {
    for (let y = 0; y < 20; y++) {
      const top = shiftAt(map, 80, y)
      const bottom = shiftAt(map, 80, 39 - y)
      expect(top.x).toBe(0)
      expect(bottom.x).toBe(0)
      expect(Math.abs(top.y + bottom.y)).toBeLessThanOrEqual(1)
    }
    expect(shiftAt(map, 80, 0).y).toBeGreaterThan(0)
  })

  it('tells the filter how far the largest shift goes', () => {
    expect(map.scale).toBeGreaterThan(18)
    expect(map.scale).toBeLessThan(21.4)
  })
})
