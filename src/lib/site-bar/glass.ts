// The console's LiquidGlass (new-api web/src/components/liquid-glass.tsx)
// without React: a pane that bends the page at its rim. A long pane (the
// assembled pill) bends alike all along its middle, so it gets one map of
// its two ends plus one stretched column, and changing width only moves
// those parts. Other browsers than Chromium keep the CSS frost.

import { refractionMap, type RefractionMap } from './refraction'

/** Rim width and glass thickness in px, as in the console. */
const BEVEL = 14
const THICKNESS = 22
const SVG = 'http://www.w3.org/2000/svg'

function refracts() {
  return /Chrome\/\d/.test(navigator.userAgent) && !matchMedia('(prefers-reduced-transparency: reduce)').matches
}

function dataUrl(map: RefractionMap, column?: number) {
  const canvas = document.createElement('canvas')
  canvas.width = column === undefined ? map.width : 1
  canvas.height = map.height
  canvas.getContext('2d')?.putImageData(new ImageData(map.pixels, map.width, map.height), column === undefined ? 0 : -column, 0)
  return canvas.toDataURL()
}

function node(name: string, attrs: Record<string, string | number>) {
  const el = document.createElementNS(SVG, name)
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value))
  return el
}

/** Makes `pane` refract; returns a function that undoes it. */
export function mountGlass(pane: HTMLElement): () => void {
  if (!refracts()) return () => {}
  const id = `xx-glass-${Math.random().toString(36).slice(2)}`
  const svg = node('svg', { 'aria-hidden': 'true', width: 0, height: 0 })
  svg.style.cssText = 'position:absolute;pointer-events:none'
  const filter = node('filter', { id, x: 0, y: 0, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' })
  svg.append(filter)
  pane.append(svg)

  let key = ''
  let end = 0
  let middle: SVGElement | null = null
  let right: SVGElement | null = null

  const place = (width: number) => {
    filter.setAttribute('width', String(width))
    if (!middle || !right) return
    middle.setAttribute('width', String(width - 2 * end))
    right.setAttribute('x', String(width - end))
  }

  const draw = () => {
    const width = pane.offsetWidth
    const height = pane.offsetHeight
    if (!width) return
    const radius = Number.parseFloat(getComputedStyle(pane).borderTopLeftRadius) || 0
    const ends = Math.ceil(height / 2) + 1
    const stretch = width >= 2 * ends + 2
    const next = stretch ? `stretch ${height} ${radius}` : `whole ${width}x${height} ${radius}`
    if (next === key) return place(width)
    key = next
    const pane_ = { height, radius, bevel: BEVEL, thickness: THICKNESS }
    filter.replaceChildren()
    filter.setAttribute('height', String(height))
    const image = (href: string, x: number, w: number, fit: string, result: string) =>
      node('feImage', { href, x, y: 0, width: w, height, preserveAspectRatio: fit, result })
    let scale: number
    if (stretch) {
      const map = refractionMap({ ...pane_, width: 2 * ends + 1 })
      const endsUrl = dataUrl(map)
      end = ends
      middle = image(dataUrl(map, ends), ends, width - 2 * ends, 'none', 'middle')
      right = image(endsUrl, width - ends, ends, 'xMaxYMid slice', 'end')
      const merge = node('feMerge', { result: 'lens' })
      for (const part of ['start', 'middle', 'end']) merge.append(node('feMergeNode', { in: part }))
      filter.append(image(endsUrl, 0, ends, 'xMinYMid slice', 'start'), middle, right, merge)
      scale = map.scale
    } else {
      const map = refractionMap({ ...pane_, width })
      middle = right = null
      filter.append(image(dataUrl(map), 0, width, 'none', 'lens'))
      scale = map.scale
    }
    filter.append(node('feDisplacementMap', { in: 'SourceGraphic', in2: 'lens', scale, xChannelSelector: 'R', yChannelSelector: 'G' }))
    place(width)
    const backdrop = `url(#${id}) blur(3px) saturate(1.7)`
    pane.style.setProperty('backdrop-filter', backdrop)
    pane.style.setProperty('-webkit-backdrop-filter', backdrop)
    pane.dataset.refracts = ''
  }

  const observer = new ResizeObserver(draw)
  observer.observe(pane)
  return () => {
    observer.disconnect()
    svg.remove()
  }
}
