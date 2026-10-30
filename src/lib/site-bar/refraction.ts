// Copied from the console (new-api web/src/lib/liquid-glass.ts) so both
// bars bend the page alike; change them together.
/**
 * Refraction for liquid glass, like the macOS Dock. The pane's rim is a
 * convex squircle bevel (after kube.io/blog/liquid-glass-css-svg): light
 * comes straight down, bends once on entering the glass (Snell's law), and
 * lands further in, so the rim shows a squeezed copy of what lies under the
 * middle. The result feeds an SVG feDisplacementMap.
 */

const REFRACTIVE_INDEX = 1.5

/** Bevel height at x, from 0 at the outer edge to 1 where the top is flat. */
function bevel(x: number) {
  return Math.pow(1 - Math.pow(1 - x, 4), 1 / 4)
}

/**
 * How far sideways light lands after entering the bevel at x, in glass
 * thicknesses. `steepness` is the thickness divided by the bevel width.
 */
export function bend(x: number, steepness: number) {
  if (x <= 0 || x >= 1) return 0
  const step = 1e-3
  const from = Math.max(x - step, 0)
  const to = Math.min(x + step, 1)
  const slope = ((bevel(to) - bevel(from)) / (to - from)) * steepness
  const incidence = Math.atan(slope)
  const refraction = Math.asin(Math.sin(incidence) / REFRACTIVE_INDEX)
  return bevel(x) * Math.tan(incidence - refraction)
}

/** Distance in from the edge of a rounded rectangle, and the way in. */
function inward(x: number, y: number, halfW: number, halfH: number, r: number) {
  const signX = Math.sign(x) || 1
  const signY = Math.sign(y) || 1
  const cornerX = Math.abs(x) - (halfW - r)
  const cornerY = Math.abs(y) - (halfH - r)
  if (cornerX > 0 && cornerY > 0) {
    const reach = Math.hypot(cornerX, cornerY)
    return {
      depth: r - reach,
      dx: (-signX * cornerX) / reach,
      dy: (-signY * cornerY) / reach,
    }
  }
  const toSide = halfW - Math.abs(x)
  const toEnd = halfH - Math.abs(y)
  return toSide < toEnd
    ? { depth: toSide, dx: -signX, dy: 0 }
    : { depth: toEnd, dx: 0, dy: -signY }
}

export type GlassPane = {
  width: number
  height: number
  radius: number
  /** Width of the curved rim, in px. */
  bevel: number
  /** Thickness of the glass, in px: thicker glass bends further. */
  thickness: number
}

export type RefractionMap = {
  width: number
  height: number
  /** RGBA pixels: red and green carry the x and y shift, 128 for none. */
  pixels: Uint8ClampedArray<ArrayBuffer>
  /** feDisplacementMap scale: a channel at 255 shifts by half of it. */
  scale: number
}

export function refractionMap(pane: GlassPane): RefractionMap {
  const width = Math.max(1, Math.round(pane.width))
  const height = Math.max(1, Math.round(pane.height))
  const radius = Math.min(pane.radius, width / 2, height / 2)
  const steepness = pane.thickness / pane.bevel
  const shifts = new Float32Array(width * height * 2)
  let most = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = inward(
        x + 0.5 - width / 2,
        y + 0.5 - height / 2,
        width / 2,
        height / 2,
        radius
      )
      const shift = bend(at.depth / pane.bevel, steepness) * pane.thickness
      const i = (y * width + x) * 2
      shifts[i] = at.dx * shift
      shifts[i + 1] = at.dy * shift
      most = Math.max(most, shift)
    }
  }
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = 128 + (most ? (shifts[i * 2] / most) * 127 : 0)
    pixels[i * 4 + 1] = 128 + (most ? (shifts[i * 2 + 1] / most) * 127 : 0)
    pixels[i * 4 + 2] = 128
    pixels[i * 4 + 3] = 255
  }
  return { width, height, pixels, scale: most * 2 }
}
