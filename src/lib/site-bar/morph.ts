// Copied from the console (new-api web/src/components/site-bar/morph.ts) so
// both bars move alike; change them together.
/** Scroll, in px, over which the bar goes from split to assembled. */
export const MORPH_DISTANCE = 80

/** No scroll for this long counts as letting go. */
const REST_MS = 140

/** One scroll event further than this (an anchor, a reset) animates. */
const JUMP = 160

/** Critically damped: quick, and no wobble past the ends. */
const STIFFNESS = 320
const DAMPING = 2 * Math.sqrt(STIFFNESS)

export type Spring = { stiffness: number; damping: number }

/** How long a frame usually takes on this screen (30 Hz in low power mode, 120 Hz …). */
let usualFrame = 1 / 60

/**
 * Moves a value to `to` on a spring, one animation frame at a time, keeping
 * the speed it already had. Returns a function that stops it where it is.
 */
export function springTo(
  from: number,
  to: number,
  { stiffness, damping }: Spring,
  onUpdate: (value: number, velocity: number) => void,
  velocity = 0
): () => void {
  let x = from
  let v = velocity
  let last = performance.now()
  let started = false
  let frame = requestAnimationFrame(function step() {
    const now = performance.now()
    const elapsed = (now - last) / 1000
    // A long frame (a busy tab, a view transition holding the screen) moves
    // it half again a usual frame at most: it pauses rather than jumps, and
    // a screen that draws slowly still moves it in real time.
    const dt = Math.min(elapsed, usualFrame * 1.5)
    // from the start to the first frame is no frame's length: it can be any
    // sliver, and counting it would slow every spring after it
    if (started) usualFrame = Math.max(1 / 240, usualFrame + (Math.min(elapsed, usualFrame * 2) - usualFrame) * 0.1)
    started = true
    last = now
    v += (-stiffness * (x - to) - damping * v) * dt
    x += v * dt
    if (Math.abs(x - to) < 5e-4 && Math.abs(v) < 5e-3) {
      onUpdate(to, 0)
      return
    }
    onUpdate(x, v)
    frame = requestAnimationFrame(step)
  })
  return () => cancelAnimationFrame(frame)
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/**
 * How far the bar has come together: 0 split, 1 assembled. Within the first
 * MORPH_DISTANCE px of a page it follows the scroll, a px of scroll moving it
 * as much wherever it starts; once the scroll rests it springs to the nearer
 * end, leaning the way the reader was going. At the very top it always
 * splits, past MORPH_DISTANCE it is always together, and pinned (chat,
 * drawing) it stays together.
 */
export class BarMorph {
  private q: number
  private pinned: boolean
  private heading = 0
  private stopSpring: (() => void) | null = null
  /** Where the running spring is headed, if one runs. */
  private springTarget: number | null = null
  private restTimer: ReturnType<typeof setTimeout> | undefined
  private readonly onChange: (q: number) => void
  private readonly reducedMotion: () => boolean

  constructor(options: {
    pinned: boolean
    top: number
    /** Where the bar stood on the page this one was opened from. */
    start?: number
    onChange: (q: number) => void
    reducedMotion: () => boolean
  }) {
    this.pinned = options.pinned
    this.q =
      options.pinned || options.top >= MORPH_DISTANCE
        ? 1
        : clamp01(options.start ?? 0)
    this.onChange = options.onChange
    this.reducedMotion = options.reducedMotion
  }

  get value() {
    return this.q
  }

  /**
   * A new page: chat and drawing keep the bar together; elsewhere it opens
   * or closes for where the page's scroller stands.
   */
  follow(pinned: boolean, top: number) {
    this.pinned = pinned
    this.towards(pinned || top >= MORPH_DISTANCE ? 1 : 0)
  }

  /** A scroller the bar had not seen yet stands at `top`. */
  meet(top: number) {
    if (!this.pinned && top >= MORPH_DISTANCE) this.towards(1)
  }

  /** A scroller the bar follows moved from `from` to `to` px. */
  scroll(from: number, to: number) {
    const delta = to - from
    if (this.pinned || delta === 0) return
    this.heading = Math.sign(delta)
    clearTimeout(this.restTimer)

    if (this.reducedMotion()) {
      // two thresholds, so a wobble around one can't flip it back and forth
      if (to <= 0) this.set(0)
      else if (this.q === 0 && to >= MORPH_DISTANCE * 0.75) this.set(1)
      else if (this.q === 1 && to <= MORPH_DISTANCE * 0.25) this.set(0)
      return
    }
    if (to <= 0) return this.towards(0)
    if (to >= MORPH_DISTANCE) return this.towards(1)
    if (Math.abs(delta) > JUMP) return this.go(to >= MORPH_DISTANCE / 2 ? 1 : 0)

    this.halt()
    this.set(clamp01(this.q + delta / MORPH_DISTANCE))
    this.restTimer = setTimeout(() => this.rest(), REST_MS)
  }

  /** Stops every timer and spring; the bar stays where it is. */
  dispose() {
    clearTimeout(this.restTimer)
    this.halt()
  }

  private rest() {
    if (this.q <= 0 || this.q >= 1) return
    // Going down, a quarter of the way is enough to close up; going up,
    // a quarter is enough to open.
    if (this.heading > 0) this.go(this.q > 0.25 ? 1 : 0)
    else this.go(this.q < 0.75 ? 0 : 1)
  }

  /** Springs to `target`, unless it is there or already on its way. */
  private towards(target: number) {
    if (this.springTarget === target) return
    if (this.q === target && !this.stopSpring) return
    this.go(target)
  }

  private go(target: number) {
    clearTimeout(this.restTimer)
    this.halt()
    if (this.q === target) return
    if (this.reducedMotion()) return this.set(target)
    this.springTarget = target
    this.stopSpring = springTo(
      this.q,
      target,
      { stiffness: STIFFNESS, damping: DAMPING },
      (q) => {
        this.set(q)
        if (q !== target) return
        this.stopSpring = null
        this.springTarget = null
      }
    )
  }

  private halt() {
    this.stopSpring?.()
    this.stopSpring = null
    this.springTarget = null
  }

  private set(q: number) {
    this.q = q
    this.onChange(q)
  }
}
