// Copied from the console (new-api web/src/lib/liquid-glass.ts) so both
// bars bend the page alike; change them together. Only the Dock's rim: the
// console's other one is for a frosted panel, and the docs have none.
/**
 * Refraction for liquid glass: how far in from the edge each pixel of a pane
 * shows the page, on the curve measured on the real macOS Dock. The result
 * feeds an SVG feDisplacementMap.
 */

/** How far, in px, a pane shows the page further in, `depth` px from its edge. */
export type Rim = (depth: number) => number

/** The Dock, measured at 75px high: 20px at the edge, gone 12px in. */
const DOCK = { height: 75, band: 12, most: 20, power: 1.9 }

/** The Dock's rim on a pane `height` px high: the middle does not move at all. */
export function dockRim(height: number): Rim {
  const size = height / DOCK.height
  const band = DOCK.band * size
  const most = DOCK.most * size
  return (depth) =>
    depth <= 0 || depth >= band
      ? 0
      : most * Math.pow(1 - depth / band, DOCK.power)
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
  rim: Rim
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
      const shift = pane.rim(at.depth)
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
