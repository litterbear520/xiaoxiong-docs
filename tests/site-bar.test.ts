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
import { lensAt, nearestLink } from '../src/lib/site-bar/lens'
import { chooseInk, composite, contrast, luminance, mix, tintFor, type Layer } from '../src/lib/site-bar/backdrop'
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

  it('lets go on the link whose middle is nearest', () => {
    expect(nearestLink(spans, 70)).toBe(0)
    expect(nearestLink(spans, 80)).toBe(1)
    expect(nearestLink(spans, 400)).toBe(2)
  })
})

// The console's numbers (new-api web/src/components/site-bar/__tests__/backdrop.test.ts
// and web/src/lib/__tests__/liquid-glass.test.ts): both bars must stay the same glass.
describe('tintFor', () => {
  it('over a dark page is the tint measured on the Dock', () => {
    const tint = tintFor(0.02)
    expect(tint.color).toEqual([52, 61, 62])
    expect(tint.alpha).toBeCloseTo(0.29)
    expect(tint.side).toBeCloseTo(0.45)
    expect(tint.edge).toBeCloseTo(0.24)
    expect(tint.glow).toBeCloseTo(0.14)
  })

  it('over a light page turns light, whatever the theme', () => {
    const tint = tintFor(0.9)
    expect(tint.color).toEqual([153, 153, 153])
    expect(tint.alpha).toBeCloseTo(0.25)
    expect(tint.side).toBeCloseTo(0.18)
    expect(tint.edge).toBeCloseTo(0.73)
    expect(tint.glow).toBeCloseTo(0.22)
  })

  it('between the two moves smoothly', () => {
    const steps = [0.1, 0.2, 0.3, 0.4, 0.5].map((lum) => tintFor(lum).alpha)
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThanOrEqual(steps[i - 1])
    expect(steps[2]).toBeGreaterThan(0.25)
    expect(steps[2]).toBeLessThan(0.29)
  })
})

describe('chooseInk', () => {
  it('gives white words on a dark page, black words on a light one', () => {
    expect(chooseInk([0.02, 0.03]).ink).toBe('light')
    expect(chooseInk([0.8, 0.9]).ink).toBe('dark')
  })

  it('around the point where both read alike, keeps the colour a word has', () => {
    // white and black read equally at a luminance of about 0.18
    const onEdge = [0.2]
    expect(chooseInk(onEdge).ink).toBe('dark')
    expect(chooseInk(onEdge, 'light').ink).toBe('light')
    expect(chooseInk([0.16], 'dark').ink).toBe('dark')
  })

  it('does not flicker while scrolling back and forth over the edge', () => {
    let ink = chooseInk([0.05]).ink
    const seen = new Set([ink])
    for (let i = 0; i < 40; i++) {
      ink = chooseInk([0.18 + Math.sin(i) * 0.02], ink).ink
      seen.add(ink)
    }
    expect(seen.size).toBe(1)
  })

  it('does change once the other colour reads clearly better', () => {
    expect(chooseInk([0.7], 'light').ink).toBe('dark')
    expect(chooseInk([0.02], 'dark').ink).toBe('light')
  })

  it('puts a plate under a word across light and dark', () => {
    expect(chooseInk([0.02, 0.5]).plate).toBe(true)
    expect(chooseInk([0.02, 0.05]).plate).toBe(false)
  })

  it('on the docs\' own pages picks what the first frame guessed', () => {
    // #fcfcfb and #151515 under the glass; SiteBar.astro's inline script guesses from the theme
    const light = mix([252, 252, 251], tintFor(luminance([252, 252, 251])).color, 0.25)
    const dark = mix([21, 21, 21], tintFor(luminance([21, 21, 21])).color, 0.29)
    expect(chooseInk([luminance(light)]).ink).toBe('dark')
    expect(chooseInk([luminance(dark)]).ink).toBe('light')
  })
})

describe('composite', () => {
  const WHITE = [255, 255, 255] as const
  const BLACK = [0, 0, 0] as const
  const layer = (color: Layer['color'], alpha = 1): Layer => ({ color, alpha })

  it('lets the top opaque layer win', () => {
    expect(composite([layer(BLACK), layer(WHITE)], WHITE)).toEqual([0, 0, 0])
  })

  it('lets the layer under a see-through one show', () => {
    expect(composite([layer(BLACK, 0.5), layer(WHITE)], WHITE)).toEqual([127.5, 127.5, 127.5])
  })

  it('falls back with nothing to read', () => {
    expect(composite([], [20, 20, 24])).toEqual([20, 20, 24])
    expect(composite([layer(BLACK, 0.5)], WHITE)).toEqual([127.5, 127.5, 127.5])
  })

  it('works with WCAG contrast and mix', () => {
    expect(contrast(luminance(WHITE), luminance(BLACK))).toBeCloseTo(21)
    expect(mix(WHITE, BLACK, 0.5)).toEqual([127.5, 127.5, 127.5])
  })
})

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
  const bar = { width: 161, height: 40, radius: 12, rim: dockRim(40) }
  const map = refractionMap(bar)
  /** The x and y shift a map gives one pixel, from -127 to 127. */
  const shiftAt = (m: RefractionMap, x: number, y: number) => {
    const i = (y * m.width + x) * 4
    return { x: m.pixels[i] - 128, y: m.pixels[i + 1] - 128 }
  }

  it('moves nothing past the 6.4px band, around the corners too', () => {
    for (let y = 0; y < bar.height; y++) {
      for (let x = 0; x < bar.width; x++) {
        const cornerX = Math.abs(x + 0.5 - bar.width / 2) - (bar.width / 2 - 12)
        const cornerY = Math.abs(y + 0.5 - bar.height / 2) - (bar.height / 2 - 12)
        const depth = cornerX > 0 && cornerY > 0 ? 12 - Math.hypot(cornerX, cornerY) : Math.min(12 - cornerX, 12 - cornerY)
        if (depth >= 6.4) expect(shiftAt(map, x, y)).toEqual({ x: 0, y: 0 })
      }
    }
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
