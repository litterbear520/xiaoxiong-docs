// A copy of the console's (new-api web/src/components/site-bar/page-reader.ts); change them together.
import { composite, type Layer, type Rgb } from './backdrop'

/** How wide the thumbnails are that pictures are read from. */
const THUMB = 64
/** New thumbnails per reading: the rest wait, so a reading stays cheap. */
const THUMBS_PER_READ = 2
/** What marked elements stand for: `data-bar-backdrop="dark"`. */
export const MARKED: Record<string, Rgb> = {
  dark: [20, 20, 24],
  light: [245, 245, 245],
}

function newContext(size: number): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return canvas.getContext('2d', { willReadFrequently: true })
}

const SOLID = /^rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?\)$/

/**
 * Reads what the page shows at a point, top layer down. Pictures are read from
 * a small thumbnail, kept per picture, and CSS colours once each. What can't be
 * read (a canvas, a video, a gradient, another site's picture) says so with
 * `data-bar-backdrop`, or else counts as the theme's own background.
 */
export class PageReader {
  private readonly thumbs = new WeakMap<
    HTMLImageElement,
    { src: string; data: Uint8ClampedArray | null }
  >()
  private readonly colors = new Map<string, Layer | null>()
  /** Turns any CSS colour into pixels. Never draws pictures, so stays readable. */
  private colorContext: CanvasRenderingContext2D | null | undefined
  /** Another site's picture spoils its canvas for good: a new one follows it. */
  private thumbContext: CanvasRenderingContext2D | null | undefined
  private bar: Element | null = null
  private fallback: Rgb = [255, 255, 255]
  /** Each element's own layer, for one reading: most points hit the same ones. */
  private seen = new Map<Element, Layer | null>()
  private newThumbs = 0
  private waiting = false

  /** Pictures were left out of this reading to keep it cheap: read again. */
  get behind(): boolean {
    return this.waiting
  }

  /** The next points are for this bar, over this theme's background. */
  startReading(bar: Element, fallback: Rgb): void {
    this.bar = bar
    this.fallback = fallback
    this.newThumbs = 0
    this.waiting = false
    this.seen = new Map()
  }

  at(x: number, y: number): Rgb {
    const layers: Layer[] = []
    for (const el of document.elementsFromPoint(x, y)) {
      if (this.bar?.contains(el)) continue
      const layer = this.layerOf(el, x, y)
      if (!layer) continue
      layers.push(layer)
      if (layer.alpha >= 0.99) break
    }
    return composite(layers, this.fallback)
  }

  private layerOf(el: Element, x: number, y: number): Layer | null {
    const marked = el.getAttribute('data-bar-backdrop')
    const said = marked ? MARKED[marked] : undefined
    if (el instanceof HTMLImageElement) {
      const color = this.pictureAt(el, x, y) ?? said ?? this.fallback
      return { color, alpha: 1 }
    }
    if (said) return { color: said, alpha: 1 }
    if (el instanceof HTMLCanvasElement || el instanceof HTMLVideoElement) {
      return { color: this.fallback, alpha: 1 }
    }
    return this.ownLayer(el)
  }

  private ownLayer(el: Element): Layer | null {
    let layer = this.seen.get(el)
    if (layer === undefined) {
      const style = getComputedStyle(el)
      layer =
        style.backgroundImage && style.backgroundImage !== 'none'
          ? { color: this.fallback, alpha: 1 }
          : this.cssColor(style.backgroundColor)
      this.seen.set(el, layer)
    }
    return layer
  }

  /** The CSS colour as RGB, or null if it shows nothing. */
  private cssColor(css: string): Layer | null {
    const known = this.colors.get(css)
    if (known !== undefined) return known
    const layer = this.parseColor(css)
    const shown = layer && layer.alpha > 0 ? layer : null
    this.colors.set(css, shown)
    return shown
  }

  private parseColor(css: string): Layer | null {
    const parts = SOLID.exec(css)
    if (parts) {
      return {
        color: [Number(parts[1]), Number(parts[2]), Number(parts[3])],
        alpha: parts[4] === undefined ? 1 : Number(parts[4]),
      }
    }
    // lab(), oklch(), color(): the browser turns them into pixels for us
    this.colorContext ??= newContext(1)
    const g = this.colorContext
    if (!g) return null
    g.clearRect(0, 0, 1, 1)
    g.fillStyle = css
    g.fillRect(0, 0, 1, 1)
    const d = g.getImageData(0, 0, 1, 1).data
    return { color: [d[0], d[1], d[2]], alpha: d[3] / 255 }
  }

  /** The picture's colour at the point, or null if it can't be read (yet). */
  private pictureAt(img: HTMLImageElement, x: number, y: number): Rgb | null {
    if (!img.complete || !img.naturalWidth) return null
    const data = this.thumbnail(img)
    if (!data) return null
    const r = img.getBoundingClientRect()
    const cell = (at: number) =>
      Math.min(THUMB - 1, Math.max(0, Math.floor(at * THUMB)))
    const i =
      (cell((y - r.top) / r.height) * THUMB + cell((x - r.left) / r.width)) * 4
    return [data[i], data[i + 1], data[i + 2]]
  }

  private thumbnail(img: HTMLImageElement): Uint8ClampedArray | null {
    const known = this.thumbs.get(img)
    if (known?.src === img.currentSrc) return known.data
    if (this.newThumbs >= THUMBS_PER_READ) {
      this.waiting = true
      return null
    }
    this.newThumbs++
    const thumb = { src: img.currentSrc, data: this.drawThumb(img) }
    this.thumbs.set(img, thumb)
    return thumb.data
  }

  private drawThumb(img: HTMLImageElement): Uint8ClampedArray | null {
    this.thumbContext ??= newContext(THUMB)
    const g = this.thumbContext
    if (!g) return null
    try {
      g.drawImage(img, 0, 0, THUMB, THUMB)
      const data = g.getImageData(0, 0, THUMB, THUMB).data
      g.clearRect(0, 0, THUMB, THUMB)
      return data
    } catch {
      // another site's picture without CORS: this one stays unreadable
      this.thumbContext = undefined
      return null
    }
  }
}
