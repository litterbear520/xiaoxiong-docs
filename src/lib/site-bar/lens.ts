// Copied from the console (new-api web/src/components/site-bar/lens.ts)
// so both lenses move alike; change them together.
import { springTo } from './morph'
import type { LensNote } from './state'

/** A stretch of the links' row, in px from its left. */
export type Span = { left: number; right: number }

// The lens's two edges move on their own springs, the leading one quicker:
// it stretches on the way and lands with a small bounce.
const LEAD = { stiffness: 600, damping: 32 }
const TRAIL = { stiffness: 170, damping: 22 }
// Under a finger it keeps up, and still stretches the way it goes.
const FOLLOW_LEAD = { stiffness: 900, damping: 50 }
const FOLLOW_TRAIL = { stiffness: 380, damping: 32 }

/** Held, the lens swells like a drop of water lifted off the bar. */
const SWOLLEN = 1.2
const SWELL = { stiffness: 420, damping: 22 }

/** Stretched past the wider of its two links, the lens thins like a drop. */
const SQUASH = 0.3
const MAX_SQUASH = 0.14

/** Past the first and last links a dragged lens follows at this rate. */
const RUBBER = 0.3

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const centre = (span: Span) => (span.left + span.right) / 2

/**
 * The lens under a finger at `x`: centred on it and as wide as the links it
 * is between, held back like rubber past the first and last.
 */
export function lensAt(spans: Span[], x: number): Span {
  const centres = spans.map(centre)
  const first = centres[0]
  const last = centres.at(-1) ?? first
  let at = x
  if (at < first) at = first - (first - at) * RUBBER
  else if (at > last) at = last + (at - last) * RUBBER
  const widths = spans.map((span) => span.right - span.left)
  let width = (at <= first ? widths[0] : widths.at(-1)) ?? 0
  for (let i = 0; i < centres.length - 1; i++) {
    if (at >= centres[i] && at <= centres[i + 1]) {
      const t = (at - centres[i]) / (centres[i + 1] - centres[i] || 1)
      width = lerp(widths[i], widths[i + 1], t)
      break
    }
  }
  return { left: at - width / 2, right: at + width / 2 }
}

/** The link whose middle is nearest to `x`. */
export function nearestLink(spans: Span[], x: number): number {
  let best = 0
  for (let i = 1; i < spans.length; i++) {
    if (Math.abs(centre(spans[i]) - x) < Math.abs(centre(spans[best]) - x)) {
      best = i
    }
  }
  return best
}

/**
 * The lens of brighter glass under the lit site link. Held and dragged, it
 * swells; its magnifier (a copy of the links' words inside it) then shows
 * the words under it bigger.
 */
export class Lens {
  private edges: LensNote | null = null
  private stops: Array<() => void> = []
  private rest = 0
  private swell = 1
  private stopSwell: (() => void) | null = null
  /** A drag owns the lens: placing it under a link waits until let go. */
  held = false

  constructor(
    private readonly el: HTMLElement,
    private readonly reducedMotion: () => boolean,
    private readonly magnifier: HTMLElement | null = null
  ) {}

  /** Straight under `link` (nothing: hidden). A running slide goes on. */
  place(link: HTMLElement | null) {
    if (this.stops.length || this.held) return
    this.el.style.opacity = link ? '1' : '0'
    if (!link) {
      // the next lit link gets the lens in place, not slid in
      this.edges = null
      return
    }
    const to = edgesOf(link)
    this.edges = { ...to, vLeft: 0, vRight: 0 }
    this.rest = 0
    this.draw(to.left, to.right)
  }

  /** Under a finger: towards `to` on stiff springs, `to` being only its place for now. */
  follow(to: Span) {
    const start = this.edges
    this.el.style.opacity = '1'
    if (!start || this.reducedMotion()) {
      this.halt()
      this.edges = { ...to, vLeft: 0, vRight: 0 }
      this.rest = to.right - to.left
      this.draw(to.left, to.right)
      return
    }
    this.run(start, to, to.right - to.left, FOLLOW_LEAD, FOLLOW_TRAIL)
  }

  /** Swells (held) or settles back; with reduced motion it stays as it is. */
  swellTo(held: boolean) {
    this.stopSwell?.()
    this.stopSwell = null
    const target = held && !this.reducedMotion() ? SWOLLEN : 1
    this.stopSwell = springTo(this.swell, target, SWELL, (s) => {
      this.swell = s
      if (this.edges) this.draw(this.edges.left, this.edges.right)
      if (s === target) this.stopSwell = null
    })
  }

  /**
   * Slides to `link`, from where it stands, or from where another page left
   * it (`from`), at the speed it had there.
   */
  slide(link: HTMLElement | null, from: LensNote | null = null) {
    const start = from ?? this.edges
    this.halt()
    if (!link || !start || this.reducedMotion() || link.offsetWidth === 0) {
      this.place(link)
      return
    }
    const to = edgesOf(link)
    this.el.style.opacity = '1'
    this.run(start, to, Math.max(start.right - start.left, to.right - to.left), LEAD, TRAIL)
  }

  private run(
    start: LensNote,
    to: Span,
    rest: number,
    lead: { stiffness: number; damping: number },
    trail: { stiffness: number; damping: number }
  ) {
    this.halt()
    // the lens's live position, so a quick second click starts from it
    const now = { ...start }
    this.edges = now
    this.rest = rest
    // drawn now: the springs' first step is a frame away
    this.draw(start.left, start.right)
    const rightward = centre(to) > centre(start)
    const [leftSpring, rightSpring] = rightward ? [trail, lead] : [lead, trail]
    let moving = 2
    const land = () => {
      moving -= 1
      if (moving === 0) this.stops = []
    }
    this.stops = [
      springTo(
        start.left,
        to.left,
        leftSpring,
        (x, v) => {
          now.left = x
          now.vLeft = v
          this.draw(now.left, now.right)
          if (x === to.left) land()
        },
        start.vLeft
      ),
      springTo(
        start.right,
        to.right,
        rightSpring,
        (x, v) => {
          now.right = x
          now.vRight = v
          this.draw(now.left, now.right)
          if (x === to.right) land()
        },
        start.vRight
      ),
    ]
  }

  /** Resolves once a running slide lands, or after `maxMs`. */
  landed(maxMs: number): Promise<void> {
    const until = performance.now() + maxMs
    return new Promise((resolve) => {
      const check = () => {
        if (this.stops.length === 0 || performance.now() >= until) resolve()
        else requestAnimationFrame(check)
      }
      // no frames in a tab put in the background: the time still runs out
      setTimeout(resolve, maxMs)
      check()
    })
  }

  /** Where it stands and how fast it moves, for the next page; null if hidden. */
  note(): LensNote | null {
    return this.edges ? { ...this.edges } : null
  }

  private halt() {
    for (const stop of this.stops) stop()
    this.stops = []
  }

  private draw(left: number, right: number) {
    const width = Math.max(0, right - left)
    const stretch = this.rest > 0 ? Math.max(0, width / this.rest - 1) : 0
    const squash = Math.min(MAX_SQUASH, stretch * SQUASH)
    const s = this.swell
    this.el.style.transform = `translate3d(${left}px,0,0) scale(${s},${s * (1 - squash)})`
    this.el.style.width = `${width}px`
    // lifted: over the words, which then show through it magnified
    if (s > 1.01) this.el.dataset.swollen = ''
    else delete this.el.dataset.swollen
    if (this.magnifier) {
      this.magnifier.style.transform = `translate3d(${-left}px,0,0)`
      this.magnifier.style.opacity = String(clamp01((s - 1) / (SWOLLEN - 1)))
    }
  }
}

function edgesOf(link: HTMLElement) {
  return { left: link.offsetLeft, right: link.offsetLeft + link.offsetWidth }
}
