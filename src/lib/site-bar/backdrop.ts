// A copy of the console's (new-api web/src/components/site-bar/backdrop.ts); change them together.
/*
 * The glass is thin, so the words on it have to suit whatever passes under it.
 * This is the arithmetic of that: page-reader.ts reads the page, bar-ink.ts
 * applies what comes out of here to the bar.
 */

export type Rgb = readonly [number, number, number]
export type Ink = 'light' | 'dark'
export type Layer = { color: Rgb; alpha: number }

const channel = (value: number): number => {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** WCAG relative luminance, from 0 to 1. */
export function luminance(c: Rgb): number {
  return (
    0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2])
  )
}

/** WCAG contrast of two luminances, from 1 to 21. */
export function contrast(a: number, b: number): number {
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

/**
 * Dark: measured on the Dock. Light: lighter than the Dock's own, which
 * measures [153, 153, 153] at .25 and reads too grey on our white pages.
 */
const DARK_TINT: Rgb = [52, 61, 62]
const LIGHT_TINT: Rgb = [246, 248, 251]
/** Below this luminance the tint is all dark, above the other all light. */
const TINT_FROM = 0.12
const TINT_TO = 0.46

export type Tint = {
  color: Rgb
  alpha: number
  /** Dark lines down the sides; on bright pages an outline and a soft shadow. */
  side: number
  outline: number
  shadow: number
}

/** The glass over a page this bright, dark or light whatever the theme. */
export function tintFor(lum: number): Tint {
  const linear = Math.min(
    1,
    Math.max(0, (lum - TINT_FROM) / (TINT_TO - TINT_FROM))
  )
  const t = linear * linear * (3 - 2 * linear)
  return {
    color: mix(DARK_TINT, LIGHT_TINT, t).map(Math.round) as unknown as Rgb,
    alpha: 0.29 - 0.13 * t,
    side: 0.45 - 0.35 * t,
    outline: 0.1 * t,
    shadow: 0.2 * t,
  }
}

/** The other colour must read this much better before a word changes. */
const STICK = 1.2
/** A word over a wider spread of luminance than this needs a plate… */
const PLATE_ON = 0.12
/** …and keeps it until the spread is this small, so it does not flicker. */
const PLATE_OFF = 0.08

export type WordInk = { ink: Ink; plate: boolean }

/** The colour for a word over these luminances (glass included). */
export function chooseInk(
  lums: readonly number[],
  was?: Partial<WordInk>
): WordInk {
  const mean = lums.reduce((a, b) => a + b, 0) / lums.length
  const white = contrast(1, mean)
  const black = contrast(0, mean)
  let ink: Ink = white >= black ? 'light' : 'dark'
  if (was?.ink && was.ink !== ink) {
    const now = was.ink === 'light' ? white : black
    const next = ink === 'light' ? white : black
    if (next < now * STICK) ink = was.ink
  }
  const spread = Math.max(...lums) - Math.min(...lums)
  return { ink, plate: spread > (was?.plate ? PLATE_OFF : PLATE_ON) }
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
