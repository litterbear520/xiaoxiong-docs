// Copied from the console (new-api web/src/components/site-bar/backdrop.ts) so
// both bars read the page alike; change them together. What differs here: the
// theme is data-theme, not a class, and the bar's menus stay inside it, so
// WORDS names the bar's own buttons.
/*
 * The glass is thin, so the words on it have to suit whatever passes under it.
 * This reads the page under the bar and sets the glass's tint and each word's
 * colour. Pure maths first, then the reading, then BarInk, which drives it.
 */

export type Rgb = readonly [number, number, number]
export type Ink = 'light' | 'dark'
export type Layer = { color: Rgb; alpha: number }

const channel = (value: number) => {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** WCAG relative luminance, from 0 to 1. */
export function luminance(c: Rgb) {
  return (
    0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2])
  )
}

/** WCAG contrast of two luminances, from 1 to 21. */
export function contrast(a: number, b: number) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** `over` laid over `under` at `alpha`. */
export function mix(under: Rgb, over: Rgb, alpha: number): Rgb {
  return [
    under[0] + (over[0] - under[0]) * alpha,
    under[1] + (over[1] - under[1]) * alpha,
    under[2] + (over[2] - under[2]) * alpha,
  ]
}

/** Measured on the Dock: dark over a dark page, light over a bright one. */
const DARK_TINT: Rgb = [52, 61, 62]
const LIGHT_TINT: Rgb = [153, 153, 153]
/** Below this luminance the tint is all dark, above the other all light. */
const TINT_FROM = 0.12
const TINT_TO = 0.46

/** The glass over a page this bright, dark or light whatever the theme. */
export function tintFor(lum: number) {
  const linear = Math.min(
    1,
    Math.max(0, (lum - TINT_FROM) / (TINT_TO - TINT_FROM))
  )
  const t = linear * linear * (3 - 2 * linear)
  return {
    color: mix(DARK_TINT, LIGHT_TINT, t).map(Math.round) as unknown as Rgb,
    alpha: 0.29 - 0.04 * t,
    side: 0.45 - 0.27 * t,
    edge: 0.24 + 0.49 * t,
    glow: 0.14 + 0.08 * t,
  }
}

/** The other colour must read this much better before a word changes. */
const STICK = 1.2
/** A word over a wider spread of luminance than this needs a plate. */
const PLATE_SPREAD = 0.12

/** The colour for a word over these luminances (glass included). */
export function chooseInk(lums: readonly number[], was?: Ink) {
  const mean = lums.reduce((a, b) => a + b, 0) / lums.length
  const white = contrast(1, mean)
  const black = contrast(0, mean)
  let ink: Ink = white >= black ? 'light' : 'dark'
  if (was && was !== ink) {
    const now = was === 'light' ? white : black
    const next = ink === 'light' ? white : black
    if (next < now * STICK) ink = was
  }
  return {
    ink,
    plate: Math.max(...lums) - Math.min(...lums) > PLATE_SPREAD,
  }
}

/** What shows through `layers`, listed from the top down. */
export function composite(layers: readonly Layer[], fallback: Rgb): Rgb {
  const out: [number, number, number] = [0, 0, 0]
  let left = 1
  for (const { color, alpha } of layers) {
    for (let i = 0; i < 3; i++) out[i] += color[i] * alpha * left
    left *= 1 - alpha
    if (left < 0.01) return out
  }
  for (let i = 0; i < 3; i++) out[i] += fallback[i] * left
  return out
}

/** How wide the thumbnails are that pictures are read from. */
const THUMB = 64
/** New thumbnails per reading: the rest wait, so a reading stays cheap. */
const THUMBS_PER_READ = 2
/** What marked elements stand for: `data-bar-backdrop="dark"`. */
const MARKED: Record<string, Rgb> = {
  dark: [20, 20, 24],
  light: [245, 245, 245],
}

/** Reads colours off the page; the canvas it uses understands any CSS colour. */
class PageReader {
  private readonly thumbs = new WeakMap<
    HTMLImageElement,
    { src: string; data: Uint8ClampedArray | null }
  >()
  private readonly colors = new Map<string, Layer | null>()
  private canvas: CanvasRenderingContext2D | null | undefined
  /** Each element's own colour, for one reading: most points hit the same ones. */
  private seen = new Map<Element, Layer | null>()
  private newThumbs = 0

  startReading() {
    this.newThumbs = 0
    this.seen = new Map()
  }

  private ownColor(el: Element) {
    let layer = this.seen.get(el)
    if (layer === undefined) {
      layer = this.cssColor(getComputedStyle(el).backgroundColor)
      this.seen.set(el, layer)
    }
    return layer
  }

  private context() {
    if (this.canvas === undefined) {
      const canvas = document.createElement('canvas')
      canvas.width = THUMB
      canvas.height = THUMB
      this.canvas = canvas.getContext('2d', { willReadFrequently: true })
    }
    return this.canvas
  }

  /** The CSS colour as RGB, or null if it shows nothing. */
  private cssColor(css: string): Layer | null {
    const known = this.colors.get(css)
    if (known !== undefined) return known
    const parts =
      /^rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?\)$/.exec(
        css
      )
    let layer: Layer | null = null
    if (parts) {
      const alpha = parts[4] === undefined ? 1 : Number(parts[4])
      layer = {
        color: [Number(parts[1]), Number(parts[2]), Number(parts[3])],
        alpha,
      }
    } else {
      const g = this.context()
      if (g) {
        // lab(), oklch(), color(): the browser turns them into pixels for us
        g.clearRect(0, 0, 1, 1)
        g.fillStyle = css
        g.fillRect(0, 0, 1, 1)
        const d = g.getImageData(0, 0, 1, 1).data
        layer = { color: [d[0], d[1], d[2]], alpha: d[3] / 255 }
      }
    }
    if (layer && layer.alpha <= 0) layer = null
    this.colors.set(css, layer)
    return layer
  }

  /** The picture's colour at the point, or null if it can't be read (yet). */
  private pictureAt(img: HTMLImageElement, x: number, y: number): Rgb | null {
    if (!img.complete || !img.naturalWidth) return null
    let thumb = this.thumbs.get(img)
    if (!thumb || thumb.src !== img.currentSrc) {
      if (this.newThumbs >= THUMBS_PER_READ) return null
      this.newThumbs++
      thumb = { src: img.currentSrc, data: null }
      const g = this.context()
      try {
        if (g) {
          g.drawImage(img, 0, 0, THUMB, THUMB)
          thumb.data = g.getImageData(0, 0, THUMB, THUMB).data
          g.clearRect(0, 0, THUMB, THUMB)
        }
      } catch {
        // another site's picture without CORS: it stays unreadable
        thumb.data = null
      }
      this.thumbs.set(img, thumb)
    }
    if (!thumb.data) return null
    const r = img.getBoundingClientRect()
    const u = Math.min(
      THUMB - 1,
      Math.max(0, Math.floor(((x - r.left) / r.width) * THUMB))
    )
    const v = Math.min(
      THUMB - 1,
      Math.max(0, Math.floor(((y - r.top) / r.height) * THUMB))
    )
    const i = (v * THUMB + u) * 4
    return [thumb.data[i], thumb.data[i + 1], thumb.data[i + 2]]
  }

  /** What the page shows at a point, under `bar`. */
  at(x: number, y: number, bar: HTMLElement, fallback: Rgb): Rgb {
    const layers: Layer[] = []
    for (const el of document.elementsFromPoint(x, y)) {
      if (bar.contains(el)) continue
      const marked = el.getAttribute('data-bar-backdrop')
      if (el instanceof HTMLImageElement) {
        const picture = this.pictureAt(el, x, y)
        if (picture) {
          layers.push({ color: picture, alpha: 1 })
          break
        }
        layers.push({ color: (marked && MARKED[marked]) || fallback, alpha: 1 })
        break
      }
      if (marked && MARKED[marked]) {
        layers.push({ color: MARKED[marked], alpha: 1 })
        break
      }
      if (el instanceof HTMLCanvasElement || el instanceof HTMLVideoElement) {
        layers.push({ color: fallback, alpha: 1 })
        break
      }
      const layer = this.ownColor(el)
      if (!layer) continue
      layers.push(layer)
      if (layer.alpha >= 0.99) break
    }
    return composite(layers, fallback)
  }
}

/** Reads per second while scrolling, as the gap between them. */
const READ_GAP_MS = 100
/** One more read once it has stopped. */
const REST_MS = 160
/** A new page's content settles in after it shows: read again as it does. */
const AFTER_PAGE_MS = [450, 1500]
/** Px between the points read along the bar. */
const STEP = 24
/** Px above and below the bar's middle that those points alternate. */
const ZIGZAG = 6

/**
 * Everything on the bar that takes the colour; `data-bar-skip` keeps its own.
 * Only buttons on the bar itself: its menus and the search dialog live in here
 * too, on their own opaque panels. The inline script in SiteBar.astro repeats it.
 */
const WORDS = '[data-bar-word],[data-site-link],.xx-dock > button:not([data-bar-skip]),site-search > button'
const LENS = '[data-site-lens]'

function setVar(el: HTMLElement, name: string, value: string) {
  if (el.style.getPropertyValue(name) !== value) {
    el.style.setProperty(name, value)
  }
}

function setAttr(el: Element, name: string, value: string | null) {
  if (el.getAttribute(name) === value) return
  if (value === null) el.removeAttribute(name)
  else el.setAttribute(name, value)
}

/**
 * Keeps the bar's glass and words right for what is under them. Ask whenever
 * the page may have moved under the bar; it reads about ten times a second at
 * most, and once more when things come to rest.
 */
export class BarInk {
  private readonly bar: HTMLElement
  private readonly glass: HTMLElement
  private readonly reader = new PageReader()
  private readonly theme: MutationObserver
  private held = false
  private last = -Infinity
  private lum: number | null = null
  private gap: ReturnType<typeof setTimeout> | undefined
  private rest: ReturnType<typeof setTimeout> | undefined
  private later: ReturnType<typeof setTimeout>[] = []
  private frame = 0

  constructor(parts: { bar: HTMLElement; glass: HTMLElement }) {
    this.bar = parts.bar
    this.glass = parts.glass
    this.theme = new MutationObserver(() => this.newPage())
    this.theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
  }

  /** The page under the bar may have moved. */
  ask() {
    if (this.held || typeof document.elementsFromPoint !== 'function') return
    clearTimeout(this.rest)
    this.rest = setTimeout(() => this.read(), REST_MS)
    if (this.gap !== undefined) return
    const wait = Math.max(0, READ_GAP_MS - (performance.now() - this.last))
    this.gap = setTimeout(() => {
      this.gap = undefined
      this.read()
    }, wait)
  }

  /** A new page is up: forget the last one and watch this one settle in. */
  newPage() {
    this.lum = null
    this.ask()
    for (const id of this.later) clearTimeout(id)
    this.later = AFTER_PAGE_MS.map((ms) => setTimeout(() => this.ask(), ms))
  }

  /** Held, the bar keeps its own colours and nothing is read. */
  hold(held: boolean) {
    if (this.held === held) return
    this.held = held
    if (!held) return this.newPage()
    this.stopTimers()
    this.clear()
  }

  dispose() {
    this.theme.disconnect()
    this.stopTimers()
  }

  private stopTimers() {
    clearTimeout(this.gap)
    clearTimeout(this.rest)
    for (const id of this.later) clearTimeout(id)
    this.gap = undefined
    this.later = []
    cancelAnimationFrame(this.frame)
    this.frame = 0
  }

  private clear() {
    for (const name of [
      '--glass-tint',
      '--glass-side',
      '--glass-edge',
      '--glass-glow',
    ]) {
      this.glass.style.removeProperty(name)
    }
    for (const el of this.bar.querySelectorAll(`${WORDS},${LENS}`)) {
      el.removeAttribute('data-ink')
      el.removeAttribute('data-plate')
    }
    this.lum = null
  }

  private read() {
    if (this.frame || this.held) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.last = performance.now()
      if (!this.held) this.paint()
    })
  }

  private paint() {
    const fallback: Rgb = document.documentElement.dataset.theme === 'dark' ? MARKED.dark : [255, 255, 255]
    this.reader.startReading()
    const box = this.glass.getBoundingClientRect()
    const y = box.top + box.height / 2

    // points along the glass, in turn above and below the middle so that an
    // edge running along the bar shows too; every word uses those under it
    const row: { x: number; color: Rgb }[] = []
    let sum = 0
    let above = true
    for (let x = box.left + 4; x < box.right; x += STEP) {
      const at = y + (above ? -ZIGZAG : ZIGZAG)
      above = !above
      const color = this.reader.at(x, at, this.bar, fallback)
      row.push({ x, color })
      sum += luminance(color)
    }
    if (!row.length) return
    const mean = sum / row.length
    // a little inertia, so one bright picture passing does not jerk the tint
    this.lum = this.lum === null ? mean : this.lum * 0.6 + mean * 0.4
    const tint = tintFor(this.lum)
    setVar(
      this.glass,
      '--glass-tint',
      `rgb(${tint.color.join(' ')} / ${tint.alpha.toFixed(3)})`
    )
    setVar(this.glass, '--glass-side', tint.side.toFixed(3))
    setVar(this.glass, '--glass-edge', tint.edge.toFixed(3))
    setVar(this.glass, '--glass-glow', tint.glow.toFixed(3))

    const lumsUnder = (r: DOMRect) => {
      const onGlass =
        r.left + r.width / 2 >= box.left && r.left + r.width / 2 <= box.right
      if (onGlass) {
        const under = row.filter((p) => p.x >= r.left && p.x <= r.right)
        const points = under.length
          ? under
          : [
              row.reduce((a, b) =>
                Math.abs(a.x - r.left) < Math.abs(b.x - r.left) ? a : b
              ),
            ]
        return points.map((p) =>
          luminance(mix(p.color, tint.color, tint.alpha))
        )
      }
      // beside the glass (the brand while the bar is split): the page itself
      return [0.2, 0.5, 0.8].map((f, i) =>
        luminance(
          this.reader.at(
            r.left + r.width * f,
            y + (i === 1 ? ZIGZAG : -ZIGZAG),
            this.bar,
            fallback
          )
        )
      )
    }

    for (const word of this.bar.querySelectorAll<HTMLElement>(WORDS)) {
      const r = word.getBoundingClientRect()
      if (!r.width) continue
      const { ink, plate } = chooseInk(
        lumsUnder(r),
        word.dataset.ink as Ink | undefined
      )
      setAttr(word, 'data-ink', ink)
      setAttr(
        word,
        'data-plate',
        plate && word.dataset.barWord !== 'line' ? '' : null
      )
    }
    const lens = this.bar.querySelector<HTMLElement>(LENS)
    if (lens) {
      const r = lens.getBoundingClientRect()
      if (r.width) {
        const { ink } = chooseInk(
          lumsUnder(r),
          lens.dataset.ink as Ink | undefined
        )
        setAttr(lens, 'data-ink', ink)
      }
    }
  }
}
