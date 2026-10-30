// Copied from the console (new-api web/src/components/site-bar/
// site-nav-links.tsx useLens) so both lenses move alike; change them together.
import { springTo } from './morph'
import type { LensNote } from './state'

// The lens's two edges move on their own springs, the leading one quicker:
// it stretches on the way and lands with a small bounce.
const LEAD = { stiffness: 600, damping: 32 }
const TRAIL = { stiffness: 170, damping: 22 }

/** Stretched past the wider of its two links, the lens thins like a drop. */
const SQUASH = 0.3
const MAX_SQUASH = 0.14

/** The lens of brighter glass under the lit site link. */
export class Lens {
  private edges: LensNote | null = null
  private stops: Array<() => void> = []
  private rest = 0

  constructor(
    private readonly el: HTMLElement,
    private readonly reducedMotion: () => boolean
  ) {}

  /** Straight under `link` (nothing: hidden). A running slide goes on. */
  place(link: HTMLElement | null) {
    if (this.stops.length) return
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
    // the lens's live position, so a quick second click starts from it
    const now = { ...start }
    this.edges = now
    this.rest = Math.max(start.right - start.left, to.right - to.left)
    // drawn now: the springs' first step is a frame away
    this.draw(start.left, start.right)
    const rightward = to.left > start.left
    const [leftSpring, rightSpring] = rightward ? [TRAIL, LEAD] : [LEAD, TRAIL]
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
    this.el.style.transform = `translate3d(${left}px,0,0) scaleY(${1 - squash})`
    this.el.style.width = `${width}px`
  }
}

function edgesOf(link: HTMLElement) {
  return { left: link.offsetLeft, right: link.offsetLeft + link.offsetWidth }
}
