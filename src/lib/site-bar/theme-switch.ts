// Copied from the console (new-api web/src/components/site-bar/theme-switch.ts)
// so both switches behave alike; change them together.
/**
 * The theme switch in the site bar: a glass knob in a track that can be
 * clicked or dragged. Everything on screen is worked out from where the knob
 * stands, `p`, from 0 (left, the moon) to 1 (right, the sun): the arc of
 * light, the pixels of the icon, the glass, and a grey veil over the page.
 * A click is the same thing as a drag, with a spring moving the knob instead
 * of the pointer.
 *
 * The cost is all in the moving: no frames run while nothing moves, also
 * while the knob is held still. The theme itself changes once, under the
 * thickest part of the veil.
 *
 * No framework in here: the console and the docs each drive one of these.
 */

export type ThemeLook = 'light' | 'dark' | 'night'
export type ThemeSwitchLabels = Record<ThemeLook, string>

export type ThemeSwitchState = {
  /** What the page shows now. */
  look: ThemeLook
  /** The bar keeps dark glass whatever the theme, over a page that never changes. */
  pinned: boolean
  /** A meteor was caught in this browser, so 夜海 comes after dark. */
  nightFound: boolean
  /** The button's name, by the theme a click goes to. */
  labels: ThemeSwitchLabels
}

export type ThemeSwitchOptions = ThemeSwitchState & {
  /** The knob has passed the middle: show this theme now, in this frame. */
  onLook: (look: ThemeLook) => void
}

type Dot = {
  x0: number
  y0: number
  a0: number
  x1: number
  y1: number
  a1: number
  wx: number
  wy: number
  lo: number
  hi: number
  lag: number
}

type Cell = readonly [x: number, y: number, alpha: number]
type Rgba = number[]
type LeftLook = Exclude<ThemeLook, 'light'>
type Branch = 'right' | 'left'
type Press = {
  id: number
  x0: number
  p0: number
  travel: number
  moved: boolean
}

const TRACK = 62
const TRAVEL = 26
const KNOB_W = 32
const KNOB_H = 28
/** Moved less than this, in px, a press is a click. */
const DRAG_START = 3
const STIFFNESS = 560
const DAMPING = 34
/** How far ahead of the release the knob's speed counts, in seconds. */
const PROJECT = 0.14
const MAX_PULL = 0.12
const PULL = 0.25
const VEIL_OPACITY = 0.95
/** How far, in pixels of the icon, the fastest move leaves them behind. */
const MAX_DRIFT = 4

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)
const band = (a: number, b: number, t: number) =>
  smooth(clamp01((t - a) / (b - a)))

/** The theme a click goes to. */
export function nextLook(look: ThemeLook, nightFound: boolean): ThemeLook {
  if (look === 'light') return 'dark'
  if (look === 'dark' && nightFound) return 'night'
  return 'light'
}

/**
 * Where the arc stands, in degrees clockwise from the top: over the sun,
 * under the moon. It goes round the side away from where the gesture began
 * and comes back the same way when the knob does.
 */
export function arcAngle(branch: Branch, p: number, turn: number) {
  const half = 180 * (1 - clamp01(p))
  return (branch === 'right' ? half : -half) - 360 * turn
}

/** Whether the page is dark at `p`. The gap at the middle stops it flickering there. */
export function staysDark(dark: boolean, p: number) {
  return dark ? p < 0.54 : p < 0.46
}

/** Where a knob let go at `p` with speed `v` comes to rest. */
export function landing(p: number, v: number): 0 | 1 {
  return p + v * PROJECT >= 0.5 ? 1 : 0
}

/** The veil's opacity at `p`: none at the ends, nearly solid in the middle. */
export function veilOpacity(p: number) {
  const edge = Math.min(clamp01(p), 1 - clamp01(p))
  return VEIL_OPACITY * band(0.08, 0.46, edge)
}

/** Past either end the knob pulls like rubber. */
export function rubber(p: number) {
  if (p < 0) return -Math.min(MAX_PULL, -p * PULL)
  if (p > 1) return 1 + Math.min(MAX_PULL, (p - 1) * PULL)
  return p
}

// --- the icons, 17 × 17 pixels around the middle

function sunCells(): Cell[] {
  const cells: Cell[] = []
  for (let y = -3; y <= 3; y++) {
    for (let x = -3; x <= 3; x++) {
      if (Math.abs(x) !== 3 || Math.abs(y) !== 3) cells.push([x, y, 1])
    }
  }
  for (let r = 6; r <= 8; r++) {
    cells.push([0, -r, 1], [0, r, 1], [-r, 0, 1], [r, 0, 1])
  }
  for (const r of [4, 5]) {
    cells.push([r, r, 1], [-r, r, 1], [r, -r, 1], [-r, -r, 1])
  }
  return cells
}

function moonCells(): Cell[] {
  const cells: Cell[] = []
  for (let y = -8; y <= 8; y++) {
    for (let x = -8; x <= 8; x++) {
      if (Math.hypot(x + 0.5, y - 1.5) > 6.6) continue
      if (Math.hypot(x - 2.4, y + 0.3) > 4.7) cells.push([x, y, 1])
      else if ((x + y) % 2 === 0) cells.push([x, y, 0.3])
    }
  }
  cells.push(
    [7, -6, 0.75],
    [6, -6, 0.6],
    [8, -6, 0.6],
    [7, -7, 0.6],
    [7, -5, 0.6],
    [3, -7, 0.55],
    [8, -1, 0.5]
  )
  return cells
}

function starCells(): Cell[] {
  const cells: Cell[] = []
  const reach = Math.pow(8, 0.55)
  for (let y = -8; y <= 8; y++) {
    for (let x = -8; x <= 8; x++) {
      if (Math.pow(Math.abs(x), 0.55) + Math.pow(Math.abs(y), 0.55) <= reach) {
        cells.push([x, y, 1])
      }
    }
  }
  cells.push([6, -6, 0.6], [-6, 6, 0.5], [7, 5, 0.45])
  return cells
}

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Pairs each pixel of one icon with one of the other, through a point in the
 * cloud between them. Seeded: a knob held still shows the same picture.
 */
export function pairDots(from: Cell[], to: Cell[], seed: number): Dot[] {
  const random = seeded(seed)
  const shuffled = (cells: Cell[]) =>
    cells
      .map((cell) => [random(), cell] as const)
      .sort((a, b) => a[0] - b[0])
      .map((entry) => entry[1])
  const a = shuffled(from)
  const b = shuffled(to)
  const dots: Dot[] = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const f = a[i] ?? a[Math.floor(random() * a.length)]
    const t = b[i] ?? b[Math.floor(random() * b.length)]
    const angle = random() * Math.PI * 2
    const radius = Math.sqrt(random()) * 7.2
    dots.push({
      x0: f[0],
      y0: f[1],
      a0: i < a.length ? f[2] : 0,
      x1: t[0],
      y1: t[1],
      a1: i < b.length ? t[2] : 0,
      wx: Math.cos(angle) * radius,
      wy: Math.sin(angle) * radius,
      lo: random() * 0.26,
      hi: 0.74 + random() * 0.26,
      lag: 0.35 + random() * 0.65,
    })
  }
  return dots
}

let cachedPairs: Record<LeftLook | 'turn', Dot[]> | null = null
function dotPairs() {
  if (!cachedPairs) {
    const sun = sunCells()
    const moon = moonCells()
    const star = starCells()
    cachedPairs = {
      dark: pairDots(moon, sun, 7),
      night: pairDots(star, sun, 11),
      turn: pairDots(moon, star, 23),
    }
  }
  return cachedPairs
}

// --- colours of the light: moon, sun, 夜海, and the pale one between them

type Light = { glow: Rgba; core: Rgba; wash: Rgba }
const LIGHTS: Record<ThemeLook | 'middle', Light> = {
  light: {
    glow: [255, 174, 28],
    core: [255, 228, 135],
    wash: [255, 186, 66, 0.62],
  },
  dark: {
    glow: [123, 134, 255],
    core: [236, 238, 255],
    wash: [120, 130, 255, 0.42],
  },
  night: {
    glow: [47, 210, 195],
    core: [212, 255, 248],
    wash: [47, 210, 195, 0.4],
  },
  middle: {
    glow: [255, 207, 176],
    core: [255, 244, 234],
    wash: [255, 225, 205, 0.55],
  },
}
const mix = (a: Rgba, b: Rgba, t: number) => a.map((v, i) => lerp(v, b[i], t))
const css = (c: Rgba) =>
  `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])} / ${(c[3] ?? 1).toFixed(3)})`

export class ThemeSwitch {
  private readonly host: HTMLElement
  private readonly knob: HTMLElement
  private readonly canvas: HTMLCanvasElement
  private readonly ink: CanvasRenderingContext2D | null
  private readonly still = matchMedia('(prefers-reduced-motion: reduce)')
  private readonly onLook: (look: ThemeLook) => void
  private veil: HTMLDivElement | null = null
  private noTransitions: HTMLStyleElement | null = null
  private state: ThemeSwitchState
  private unwatchScale = () => {}
  private scale = 1
  private originX = 0
  private originY = 0

  private p: number
  private v = 0
  private target: number
  private turn = 0
  private turnV = 0
  private turnTarget = 0
  private swell = 0
  private swellV = 0
  private left: LeftLook
  private branch: Branch
  /** The side of the middle the page's theme is on. */
  private dark: boolean
  private shown: ThemeLook
  /** This move follows a change made elsewhere: the page has already changed. */
  private following = false
  private press: Press | null = null
  private dragTo: number | null = null
  private dragStarting = false
  private skipClick = false
  private raf = 0
  private last = 0
  private running = false

  constructor(host: HTMLElement, options: ThemeSwitchOptions) {
    const { onLook, ...state } = options
    this.host = host
    this.onLook = onLook
    this.state = state
    this.shown = state.look
    this.dark = state.look !== 'light'
    this.p = this.target = state.look === 'light' ? 1 : 0
    this.left = state.look === 'night' ? 'night' : 'dark'
    this.branch = this.p === 0 ? 'right' : 'left'

    host.classList.add('tsw')
    host.innerHTML =
      '<span class="tsw-knob"><i class="tsw-bloom"></i><span class="tsw-body"><i class="tsw-glass tsw-glass-dark"></i><i class="tsw-glass tsw-glass-light"></i><i class="tsw-wash"></i><canvas></canvas></span><span class="tsw-arcs"><i class="tsw-arc tsw-arc-out"></i><i class="tsw-arc tsw-arc-in"></i></span></span>'
    this.knob = host.firstElementChild as HTMLElement
    this.canvas = host.querySelector('canvas') as HTMLCanvasElement
    this.ink = this.canvas.getContext('2d')

    host.addEventListener('pointerdown', this.onDown)
    host.addEventListener('pointermove', this.onMove)
    host.addEventListener('pointerup', this.onUp)
    host.addEventListener('pointercancel', this.onUp)
    host.addEventListener('lostpointercapture', this.onUp)
    host.addEventListener('click', this.onClick)

    this.watchScale()
    this.render()
    this.finish()
  }

  /** New props from the page. A theme changed elsewhere moves the knob too. */
  update(state: ThemeSwitchState) {
    const look = state.look
    this.state = state
    if (look !== this.shown) this.follow(look)
    else if (!this.running) {
      this.render()
      this.writeName()
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.unwatchScale()
    const host = this.host
    host.removeEventListener('pointerdown', this.onDown)
    host.removeEventListener('pointermove', this.onMove)
    host.removeEventListener('pointerup', this.onUp)
    host.removeEventListener('pointercancel', this.onUp)
    host.removeEventListener('lostpointercapture', this.onUp)
    host.removeEventListener('click', this.onClick)
    host.replaceChildren()
    this.veil?.remove()
    this.veil = null
    this.noTransitions?.remove()
    this.noTransitions = null
  }

  // --- pointer

  private readonly onDown = (event: PointerEvent) => {
    this.skipClick = false
    if (event.button !== 0 || event.ctrlKey) return
    this.host.setPointerCapture?.(event.pointerId)
    this.press = {
      id: event.pointerId,
      x0: event.clientX,
      p0: this.p,
      travel: (this.host.getBoundingClientRect().width * TRAVEL) / TRACK,
      moved: false,
    }
    this.host.dataset.held = ''
    this.stopTransitions()
    this.kick()
  }

  private readonly onMove = (event: PointerEvent) => {
    const press = this.press
    if (!press || press.id !== event.pointerId) return
    const dx = event.clientX - press.x0
    if (!press.moved) {
      if (Math.abs(dx) < DRAG_START) return
      press.moved = true
      this.dragStarting = true
      this.beginMove()
    }
    this.dragTo = rubber(press.p0 + dx / press.travel)
    this.kick()
  }

  private readonly onUp = (event: PointerEvent) => {
    const press = this.press
    if (!press || press.id !== event.pointerId) return
    this.press = null
    delete this.host.dataset.held
    this.kick()
    if (!press.moved) return
    this.skipClick = event.type === 'pointerup'
    this.dragTo = null
    // the browser took the gesture over: no throw, just the nearer end
    this.target = landing(this.p, event.type === 'pointerup' ? this.v : 0)
  }

  private readonly onClick = (event: MouseEvent) => {
    // keyboard clicks have detail 0 and never follow a drag
    if (this.skipClick && event.detail !== 0) {
      this.skipClick = false
      return
    }
    this.flip()
  }

  private flip() {
    const { nightFound } = this.state
    if (this.target === 1) return this.aim(0)
    const atRest = this.p === 0 && this.target === 0 && this.turnTarget === 0
    if (this.left === 'dark' && nightFound && atRest) {
      this.following = false
      this.turnTarget = 1
      this.stopTransitions()
      return this.kick()
    }
    this.aim(1)
  }

  private aim(target: 0 | 1) {
    this.beginMove()
    this.target = target
    this.kick()
  }

  /** Before the knob sets off: which way the arc goes, and what is on the left. */
  private beginMove() {
    this.following = false
    this.stopTransitions()
    this.dark = this.shown !== 'light'
    if (this.turnTarget === 1) {
      // on its way to 夜海: arrive at once, the knob now has somewhere to go
      this.left = 'night'
      this.turn = this.turnV = this.turnTarget = 0
    }
    if (this.p === this.target && this.v === 0) {
      this.branch = this.p === 0 ? 'right' : 'left'
      if (this.p === 1) this.left = 'dark'
    }
  }

  private follow(look: ThemeLook) {
    this.shown = look
    this.dark = look !== 'light'
    this.following = true
    this.turn = this.turnV = this.turnTarget = 0
    if (this.press) this.host.releasePointerCapture?.(this.press.id)
    this.press = null
    this.dragTo = null
    delete this.host.dataset.held
    if (look !== 'light') this.left = look
    this.target = look === 'light' ? 1 : 0
    if (this.p === this.target) this.branch = this.p === 0 ? 'right' : 'left'
    this.kick()
  }

  // --- motion

  private kick() {
    if (this.raf) return
    if (!this.running) {
      this.running = true
      this.last = 0
      this.knob.style.willChange = 'translate, scale'
    }
    this.raf = requestAnimationFrame(this.frame)
  }

  private readonly frame = (now: number) => {
    this.raf = 0
    // the first frame has no earlier frame to measure from
    const dt = this.last
      ? Math.max(0.004, Math.min(0.034, (now - this.last) / 1000))
      : 1 / 60
    this.last = now
    this.step(dt)
    this.render()
    this.commit()
    if (this.moving()) this.kick()
    else this.finish()
  }

  private step(dt: number) {
    const instant = this.still.matches
    if (this.dragTo !== null) {
      // the first step holds the whole dead zone: distance, not speed
      const speed = this.dragStarting ? 0 : (this.dragTo - this.p) / dt
      this.dragStarting = false
      this.v = lerp(this.v, speed, 0.35)
      if (Math.abs(this.v) < 0.01) this.v = 0
      this.p = this.dragTo
    } else if (instant) {
      this.p = this.target
      this.v = 0
      this.turn = this.turnTarget
      this.turnV = 0
    } else {
      this.v += (STIFFNESS * (this.target - this.p) - DAMPING * this.v) * dt
      this.p += this.v * dt
      if (Math.abs(this.target - this.p) < 0.002 && Math.abs(this.v) < 0.02) {
        this.p = this.target
        this.v = 0
      }
      this.turnV += (120 * (this.turnTarget - this.turn) - 18 * this.turnV) * dt
      this.turn += this.turnV * dt
      if (
        Math.abs(this.turnTarget - this.turn) < 0.002 &&
        Math.abs(this.turnV) < 0.02
      ) {
        this.turn = this.turnTarget
        this.turnV = 0
      }
    }
    const held = this.press ? 1 : 0
    if (instant) {
      this.swell = held
      this.swellV = 0
    } else {
      this.swellV += (300 * (held - this.swell) - 26 * this.swellV) * dt
      this.swell += this.swellV * dt
      if (Math.abs(held - this.swell) < 0.004 && Math.abs(this.swellV) < 0.02) {
        this.swell = held
        this.swellV = 0
      }
    }
  }

  private moving() {
    if (this.swell !== (this.press ? 1 : 0)) return true
    if (this.dragTo !== null) return this.dragTo !== this.p || this.v !== 0
    return (
      this.p !== this.target ||
      this.v !== 0 ||
      this.turn !== this.turnTarget ||
      this.turnV !== 0
    )
  }

  /** Nothing is moving any more. */
  private finish() {
    this.running = false
    this.knob.style.willChange = ''
    if (this.press || this.dragTo !== null) return
    this.following = false
    if (this.turnTarget === 1 && this.turn === 1) {
      this.left = 'night'
      this.turn = this.turnTarget = 0
      this.render()
    }
    if (this.veil) this.veil.style.display = 'none'
    this.allowTransitions()
    this.writeName()
  }

  private writeName() {
    const { labels, nightFound } = this.state
    const name = labels[nextLook(this.shown, nightFound)]
    this.host.setAttribute('aria-label', name)
    this.host.title = name
    this.host.dataset.look = this.shown
  }

  /** Past the middle of the track, or halfway round to 夜海: show the new theme. */
  private commit() {
    if (this.following) return
    let look = this.shown
    const dark = staysDark(this.dark, clamp01(this.p))
    if (dark !== this.dark) {
      this.dark = dark
      look = dark ? this.left : 'light'
    }
    if (this.turnTarget === 1 && this.turn >= 0.5) look = 'night'
    if (look === this.shown) return
    this.shown = look
    this.stopTransitions()
    this.onLook(look)
  }

  /**
   * The theme swaps with every CSS transition off, the way next-themes does:
   * hundreds of colours fading at once would cost far more than the swap and
   * show as a second, slower change after the veil lifts. Adding or removing
   * the rule restyles the whole page, so it goes in when the move starts and
   * comes out when it ends, not in the frame of the swap.
   */
  private stopTransitions() {
    if (this.noTransitions) return
    const style = document.createElement('style')
    style.textContent = '*,*::before,*::after{transition:none!important}'
    document.head.append(style)
    this.noTransitions = style
  }

  private allowTransitions() {
    const style = this.noTransitions
    if (!style) return
    this.noTransitions = null
    // a swap in this very frame has yet to be styled: gone before the next one
    requestAnimationFrame(() => style.remove())
  }

  // --- one frame

  private render() {
    const p = clamp01(this.p)
    const left = LIGHTS[this.left]
    const turn = this.turn
    const from: Light = {
      glow: mix(left.glow, LIGHTS.night.glow, turn),
      core: mix(left.core, LIGHTS.night.core, turn),
      wash: mix(left.wash, LIGHTS.night.wash, turn),
    }
    const colour = (key: keyof Light) =>
      p < 0.5
        ? mix(from[key], LIGHTS.middle[key], p * 2)
        : mix(LIGHTS.middle[key], LIGHTS.light[key], p * 2 - 1)
    const { pinned } = this.state
    const glass = pinned ? 0 : band(0.2, 0.8, p)
    const wash = colour('wash')
    if (pinned) wash[3] *= lerp(1, 0.58, p)

    const degrees = arcAngle(this.branch, p, turn)
    const radians = (degrees * Math.PI) / 180
    const sin = Math.sin(radians)
    const cos = Math.cos(radians)
    const speed = Math.abs(this.v)
    const stretchX = 1 + 0.05 * this.swell + Math.min(0.14, speed * 0.03)
    const stretchY = 1 + 0.02 * this.swell - Math.min(0.06, speed * 0.012)

    const style = this.host.style
    style.setProperty('--tsw-glass', glass.toFixed(3))
    style.setProperty('--tsw-arc', `${degrees.toFixed(2)}deg`)
    style.setProperty('--tsw-glow', css(colour('glow')))
    style.setProperty('--tsw-core', css(colour('core')))
    style.setProperty('--tsw-wash', css(wash))
    style.setProperty('--tsw-wash-x', `${(50 + 50 * sin).toFixed(1)}%`)
    style.setProperty('--tsw-wash-y', `${(50 - 50 * cos).toFixed(1)}%`)
    style.setProperty(
      '--tsw-wash-w',
      `${lerp(90, 56, Math.abs(sin)).toFixed(1)}%`
    )
    style.setProperty(
      '--tsw-wash-h',
      `${lerp(62, 92, Math.abs(sin)).toFixed(1)}%`
    )
    this.knob.style.translate = `${(TRAVEL * this.p).toFixed(2)}px 0`
    this.knob.style.scale = `${stretchX.toFixed(3)} ${stretchY.toFixed(3)}`
    this.canvas.style.filter = `invert(${(1 - glass).toFixed(3)})`
    const pairs = dotPairs()
    if (turn > 0) this.drawDots(pairs.turn, turn)
    else this.drawDots(pairs[this.left], p)
    this.paintVeil(p)
  }

  private paintVeil(p: number) {
    const opacity = this.following || this.state.pinned ? 0 : veilOpacity(p)
    if (opacity <= 0.002) {
      if (this.veil) this.veil.style.display = 'none'
      return
    }
    if (!this.veil) {
      this.veil = document.createElement('div')
      this.veil.className = 'tsw-veil'
      document.body.append(this.veil)
    }
    this.veil.style.display = 'block'
    this.veil.style.opacity = opacity.toFixed(3)
  }

  private drawDots(dots: Dot[], t: number) {
    const ink = this.ink
    if (!ink) return
    const { scale, originX, originY } = this
    const { width, height } = this.canvas
    ink.clearRect(0, 0, width, height)
    ink.fillStyle = '#0b0b0d'
    const drift =
      Math.max(-MAX_DRIFT, Math.min(MAX_DRIFT, this.v * 0.9)) *
      Math.sin(Math.PI * clamp01(t))
    for (const dot of dots) {
      const u = smooth(clamp01((t - dot.lo) / (dot.hi - dot.lo)))
      const alpha = lerp(dot.a0, dot.a1, u)
      if (alpha <= 0.01) continue
      let x: number
      let y: number
      if (u < 0.5) {
        const k = smooth(u * 2)
        x = lerp(dot.x0, dot.wx, k)
        y = lerp(dot.y0, dot.wy, k)
      } else {
        const k = smooth((u - 0.5) * 2)
        x = lerp(dot.wx, dot.x1, k)
        y = lerp(dot.wy, dot.y1, k)
      }
      // the pixels have weight: moving fast they fall behind the knob
      x -= drift * dot.lag
      // both edges on whole device pixels, so 125% and 150% screens stay sharp
      const left = Math.round(originX + x * scale)
      const top = Math.round(originY + y * scale)
      const right = Math.round(originX + (x + 1) * scale)
      const bottom = Math.round(originY + (y + 1) * scale)
      ink.globalAlpha = alpha
      ink.fillRect(left, top, right - left, bottom - top)
    }
    ink.globalAlpha = 1
  }

  /** Sizes the canvas for this screen, again when the window moves to another. */
  private watchScale() {
    this.unwatchScale()
    this.scale = Math.min(window.devicePixelRatio || 1, 3)
    this.canvas.width = Math.round(KNOB_W * this.scale)
    this.canvas.height = Math.round(KNOB_H * this.scale)
    this.originX = (KNOB_W * this.scale) / 2 - this.scale / 2
    this.originY = (KNOB_H * this.scale) / 2 - this.scale / 2
    const query = matchMedia(
      `(resolution: ${window.devicePixelRatio || 1}dppx)`
    )
    const changed = () => {
      this.watchScale()
      this.render()
    }
    query.addEventListener('change', changed)
    this.unwatchScale = () => query.removeEventListener('change', changed)
  }
}
