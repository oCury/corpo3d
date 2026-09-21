// Portado do Olho3D (mesmo autor), 2026-09-21 — `src/lib/textures.ts`.
// Única mudança de fundo: lá os 177 sorteios usavam o gerador global do navegador e o olho saía
// diferente a cada carregamento; aqui cada função recebe uma `semente` e sorteia com `criarPrng`,
// então o desenho é reprodutível (dois olhos com a mesma semente são idênticos e a captura de
// tela do E2E não oscila). Só rodam no navegador: usam `document.createElement('canvas')`.
import { CanvasTexture, Color, MathUtils, RepeatWrapping, SRGBColorSpace } from 'three';
import { criarPrng } from './prng';

/**
 * Iris zone radii as fractions of the painted radius R (canvas half-size).
 * The geometry's inner edge is the pupil, so no hole is painted and the
 * fibers run all the way to the center.
 */
const COLLARETTE = 0.34
const LIMBUS_START = 0.88

/** Wavy radial stroke used for iris stroma fibers (color and bump). */
function strokeIrisFiber(
  rnd: () => number,
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  theta0: number,
  rStart: number,
  rEnd: number,
  width: number,
  style: string,
  alpha: number
) {
  const steps = 16
  const waviness = 0.04 + rnd() * 0.07
  const freq = 0.5 + rnd() * 0.7
  const phase = rnd() * Math.PI * 2

  ctx.beginPath()
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const r = rStart + (rEnd - rStart) * t
    const theta = theta0 + waviness * Math.sin(phase + s * freq) * (0.3 + t)
    const x = cx + Math.cos(theta) * r
    const y = cy + Math.sin(theta) * r
    if (s === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = style
  ctx.lineWidth = width
  ctx.globalAlpha = alpha
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.globalAlpha = 1
}

/** Wavy ring (collarette, contraction furrows) as a polar polyline. */
function strokeWavyRing(
  rnd: () => number,
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  style: string,
  width: number,
  alpha: number,
  arcStart = 0,
  arcSpan = Math.PI * 2
) {
  const steps = 140
  const a1 = 0.03 + rnd() * 0.025
  const a2 = 0.012 + rnd() * 0.012
  const p1 = rnd() * Math.PI * 2
  const p2 = rnd() * Math.PI * 2

  ctx.beginPath()
  for (let s = 0; s <= steps; s++) {
    const theta = arcStart + (s / steps) * arcSpan
    const r =
      radius * (1 + a1 * Math.sin(9 * theta + p1) + a2 * Math.sin(23 * theta + p2))
    const x = cx + Math.cos(theta) * r
    const y = cy + Math.sin(theta) * r
    if (s === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = style
  ctx.lineWidth = width
  ctx.globalAlpha = alpha
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.globalAlpha = 1
}

/**
 * Generate a procedural iris texture painted like a frontal photograph:
 * three depth layers of wavy stroma fibers, an irregular collarette,
 * contraction furrows in the ciliary zone, radially elongated crypts,
 * pigment freckles and a dark limbal ring.
 */
export function texturaIris(cor: string, semente: number, size = 1024): CanvasTexture {
  const rnd = criarPrng(semente);
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.5

  const base = new Color(cor)
  const hsl = { h: 0, s: 0, l: 0 }
  base.getHSL(hsl)
  const shade = (dl: number, ds = 0, dh = 0) =>
    `#${new Color()
      .setHSL(
        (hsl.h + dh + 1) % 1,
        MathUtils.clamp(hsl.s + ds, 0, 1),
        MathUtils.clamp(hsl.l + dl, 0.04, 0.92)
      )
      .getHexString()}`

  // ── Base radial ramp: lighter pupillary zone → darker periphery ──
  const ramp = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
  ramp.addColorStop(0, shade(0.13))
  ramp.addColorStop(0.3, shade(0.07))
  ramp.addColorStop(0.55, shade(0.01))
  ramp.addColorStop(0.8, shade(-0.07))
  ramp.addColorStop(0.9, shade(-0.14, -0.08))
  ramp.addColorStop(1, '#181009')
  ctx.fillStyle = ramp
  ctx.fillRect(0, 0, size, size)

  // Warm melanin ring around the pupillary zone
  const warm = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 0.36)
  warm.addColorStop(0, 'rgba(150,105,45,0.1)')
  warm.addColorStop(1, 'rgba(150,105,45,0)')
  ctx.fillStyle = warm
  ctx.fillRect(0, 0, size, size)

  // ── Deep stroma fibers: wide, dark, soft ──
  // Staggered starts keep the pupillary zone from accumulating darkness.
  for (let i = 0; i < 90; i++) {
    strokeIrisFiber(
      rnd, ctx, cx, cy,
      rnd() * Math.PI * 2,
      R * (0.03 + rnd() * 0.12),
      R * (0.78 + rnd() * 0.18),
      4 + rnd() * 4,
      shade(-0.16, -0.08),
      0.12 + rnd() * 0.08
    )
  }

  // ── Mid fibers: hue/lightness variation carries the iris color ──
  for (let i = 0; i < 240; i++) {
    strokeIrisFiber(
      rnd, ctx, cx, cy,
      rnd() * Math.PI * 2,
      R * (0.06 + rnd() * 0.2),
      R * (0.6 + rnd() * 0.37),
      1.6 + rnd() * 1.8,
      shade(
        (rnd() - 0.5) * 0.26,
        (rnd() - 0.4) * 0.25,
        (rnd() - 0.5) * 0.05
      ),
      0.22 + rnd() * 0.18
    )
  }

  // ── Fine bright filaments: catch-light strands ──
  for (let i = 0; i < 320; i++) {
    const r0 = R * (0.08 + rnd() * 0.3)
    strokeIrisFiber(
      rnd, ctx, cx, cy,
      rnd() * Math.PI * 2,
      r0,
      r0 + R * (0.18 + rnd() * 0.45),
      0.6 + rnd() * 0.9,
      shade(0.14 + rnd() * 0.16),
      0.22 + rnd() * 0.2
    )
  }

  // ── Collarette: irregular wavy boundary, slightly raised tone ──
  strokeWavyRing(rnd, ctx, cx, cy, R * (COLLARETTE - 0.015), shade(-0.12), 4, 0.3)
  strokeWavyRing(rnd, ctx, cx, cy, R * COLLARETTE, shade(0.13, 0.05), 2.6, 0.5)
  strokeWavyRing(rnd, ctx, cx, cy, R * (COLLARETTE + 0.02), shade(0.08), 1.6, 0.35)

  // ── Contraction furrows: concentric arcs in the ciliary zone ──
  for (const fr of [0.58, 0.68, 0.78]) {
    const arcs = 1 + Math.floor(rnd() * 2)
    for (let a = 0; a < arcs; a++) {
      strokeWavyRing(
        rnd, ctx, cx, cy,
        R * (fr + (rnd() - 0.5) * 0.02),
        shade(-0.2, -0.05),
        2 + rnd() * 2.5,
        0.22 + rnd() * 0.12,
        rnd() * Math.PI * 2,
        1 + rnd() * 2.5
      )
    }
  }

  // ── Crypts: radially elongated dark openings near the collarette ──
  for (let i = 0; i < 26; i++) {
    const theta = rnd() * Math.PI * 2
    const near = rnd() < 0.7
    const dist = R * (near ? 0.3 + rnd() * 0.18 : 0.55 + rnd() * 0.2)
    const rx = (3 + rnd() * 5) * (size / 1024)
    const ry = (10 + rnd() * 16) * (size / 1024)
    ctx.beginPath()
    ctx.ellipse(
      cx + Math.cos(theta) * dist,
      cy + Math.sin(theta) * dist,
      ry, rx,
      theta,
      0, Math.PI * 2
    )
    ctx.fillStyle = `rgba(12,8,6,${0.2 + rnd() * 0.18})`
    ctx.fill()
  }

  // ── Pigment freckles ──
  for (let i = 0; i < 10; i++) {
    const theta = rnd() * Math.PI * 2
    const dist = R * (0.45 + rnd() * 0.35)
    const fx = cx + Math.cos(theta) * dist
    const fy = cy + Math.sin(theta) * dist
    for (let b = 0; b < 3; b++) {
      ctx.beginPath()
      ctx.arc(
        fx + (rnd() - 0.5) * 8,
        fy + (rnd() - 0.5) * 8,
        (2 + rnd() * 5) * (size / 1024),
        0, Math.PI * 2
      )
      ctx.fillStyle = `rgba(58,34,16,${0.16 + rnd() * 0.14})`
      ctx.fill()
    }
  }

  // ── Limbal ring: melanin falloff into the sclera junction ──
  const limbus = ctx.createRadialGradient(cx, cy, R * LIMBUS_START, cx, cy, R)
  limbus.addColorStop(0, 'rgba(20,13,8,0)')
  limbus.addColorStop(0.55, 'rgba(20,13,8,0.45)')
  limbus.addColorStop(1, 'rgba(10,7,5,0.92)')
  ctx.fillStyle = limbus
  ctx.fillRect(0, 0, size, size)

  // ── Sphincter shading toward the pupil margin ──
  const sphincter = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.08)
  sphincter.addColorStop(0, 'rgba(18,11,7,0.2)')
  sphincter.addColorStop(1, 'rgba(18,11,7,0)')
  ctx.fillStyle = sphincter
  ctx.fillRect(0, 0, size, size)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/**
 * Bump map matching the iris layout: fiber ridges and grooves, raised
 * collarette, recessed contraction furrows and crypt pits. The limbal
 * band flattens back to neutral so the rim stays smooth.
 */
export function bumpIris(semente: number, size = 1024): CanvasTexture {
  const rnd = criarPrng(semente);
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.5

  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, size, size)

  const gray = (v: number) => `rgb(${v},${v},${v})`

  // Deep grooves between fiber bundles
  for (let i = 0; i < 100; i++) {
    strokeIrisFiber(
      rnd, ctx, cx, cy,
      rnd() * Math.PI * 2,
      R * 0.02,
      R * (0.72 + rnd() * 0.2),
      3 + rnd() * 4,
      gray(70 + Math.floor(rnd() * 30)),
      0.3 + rnd() * 0.15
    )
  }

  // Raised fiber ridges
  for (let i = 0; i < 260; i++) {
    strokeIrisFiber(
      rnd, ctx, cx, cy,
      rnd() * Math.PI * 2,
      R * (0.03 + rnd() * 0.08),
      R * (0.6 + rnd() * 0.34),
      1 + rnd() * 2,
      gray(150 + Math.floor(rnd() * 65)),
      0.35 + rnd() * 0.2
    )
  }

  // Collarette ridge
  strokeWavyRing(rnd, ctx, cx, cy, R * COLLARETTE, gray(205), 3, 0.55)

  // Contraction furrow grooves
  for (const fr of [0.58, 0.68, 0.78]) {
    strokeWavyRing(
      rnd, ctx, cx, cy,
      R * (fr + (rnd() - 0.5) * 0.015),
      gray(58),
      4 + rnd() * 2,
      0.4,
      rnd() * Math.PI * 2,
      1.5 + rnd() * 3
    )
  }

  // Crypt pits
  for (let i = 0; i < 24; i++) {
    const theta = rnd() * Math.PI * 2
    const dist = R * (0.3 + rnd() * 0.4)
    ctx.beginPath()
    ctx.ellipse(
      cx + Math.cos(theta) * dist,
      cy + Math.sin(theta) * dist,
      (9 + rnd() * 14) * (size / 1024),
      (3 + rnd() * 4) * (size / 1024),
      theta,
      0, Math.PI * 2
    )
    ctx.globalAlpha = 0.45
    ctx.fillStyle = gray(55)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // Flatten the limbal band back to neutral height
  const flat = ctx.createRadialGradient(cx, cy, R * 0.84, cx, cy, R * 0.97)
  flat.addColorStop(0, 'rgba(128,128,128,0)')
  flat.addColorStop(1, 'rgba(128,128,128,1)')
  ctx.fillStyle = flat
  ctx.fillRect(0, 0, size, size)

  const texture = new CanvasTexture(canvas)
  return texture
}

/**
 * Generate a realistic sclera texture with:
 * - Warm cream base with subtle color variation
 * - Dense vascular network (episcleral veins) with recursive branching
 * - Surface microtexture (organic noise stipple)
 */
export function texturaEsclera(semente: number, size = 1024): CanvasTexture {
  const rnd = criarPrng(semente);
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  // ── Base: pearly warm white ──
  ctx.fillStyle = '#f4efe8'
  ctx.fillRect(0, 0, size, size)

  // Regional color variation — large soft blobs
  for (let i = 0; i < 50; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const r = 60 + rnd() * 280
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    const kind = rnd()
    if (kind < 0.3) {
      grad.addColorStop(0, `rgba(248,238,215,${0.15 + rnd() * 0.12})`)
    } else if (kind < 0.55) {
      grad.addColorStop(0, `rgba(252,224,214,${0.12 + rnd() * 0.1})`)
    } else if (kind < 0.75) {
      grad.addColorStop(0, `rgba(225,230,242,${0.06 + rnd() * 0.06})`)
    } else {
      grad.addColorStop(0, `rgba(255,245,235,${0.08 + rnd() * 0.08})`)
    }
    grad.addColorStop(1, 'rgba(244,239,232,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // ── Fibrous texture: collagen fiber bundles (nervuras) ──
  // Horizontal-ish fibers that wrap around the globe
  for (let i = 0; i < 400; i++) {
    const y0 = rnd() * size
    const x0 = rnd() * size * 0.1
    const len = size * (0.3 + rnd() * 0.7)
    const steps = 30 + Math.floor(rnd() * 20)
    const stepLen = len / steps

    ctx.beginPath()
    let x = x0, y = y0
    ctx.moveTo(x, y)
    const drift = (rnd() - 0.5) * 0.15
    for (let s = 0; s < steps; s++) {
      x += stepLen
      y += drift * stepLen + (rnd() - 0.5) * 3
      ctx.lineTo(x, y)
    }
    const bright = 220 + Math.floor(rnd() * 30)
    ctx.strokeStyle = `rgba(${bright},${bright - 5},${bright - 12},${0.06 + rnd() * 0.08})`
    ctx.lineWidth = 0.5 + rnd() * 2.5
    ctx.stroke()
  }

  // Diagonal cross-fibers for interwoven look
  for (let i = 0; i < 200; i++) {
    const angle = (rnd() - 0.5) * Math.PI * 0.4
    const x0 = rnd() * size
    const y0 = rnd() * size
    const len = 60 + rnd() * 200
    const steps = 15 + Math.floor(rnd() * 10)
    const stepLen = len / steps
    const cosA = Math.cos(angle)
    const sinA = Math.sin(angle)

    ctx.beginPath()
    let x = x0, y = y0
    ctx.moveTo(x, y)
    for (let s = 0; s < steps; s++) {
      x += cosA * stepLen + (rnd() - 0.5) * 2
      y += sinA * stepLen + (rnd() - 0.5) * 2
      ctx.lineTo(x, y)
    }
    const bright = 215 + Math.floor(rnd() * 35)
    ctx.strokeStyle = `rgba(${bright},${bright - 3},${bright - 10},${0.04 + rnd() * 0.06})`
    ctx.lineWidth = 0.3 + rnd() * 1.5
    ctx.stroke()
  }

  // ── Microtexture: fine stipple for organic surface feel ──
  for (let i = 0; i < 5000; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const r = 0.3 + rnd() * 1.8
    const b = 210 + Math.floor(rnd() * 40)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${b},${b - 8},${b - 18},${0.04 + rnd() * 0.06})`
    ctx.fill()
  }

  // ── Vascular network: organic episcleral veins ──
  // Veins radiate from 6-8 origin clusters (muscle insertion zones)
  const originClusters: [number, number][] = []
  for (let c = 0; c < 7; c++) {
    const edge = Math.floor(rnd() * 4)
    let ox: number, oy: number
    switch (edge) {
      case 0: ox = rnd() * size * 0.1; oy = rnd() * size; break
      case 1: ox = size - rnd() * size * 0.1; oy = rnd() * size; break
      case 2: ox = rnd() * size; oy = rnd() * size * 0.1; break
      default: ox = rnd() * size; oy = size - rnd() * size * 0.1; break
    }
    originClusters.push([ox, oy])
  }

  // Major vessels from clusters
  for (const [ox, oy] of originClusters) {
    const count = 3 + Math.floor(rnd() * 4)
    for (let v = 0; v < count; v++) {
      organicVein(rnd, ctx, size, ox, oy, 2.5 + rnd() * 3, 0)
    }
  }
  // Medium veins — some clustered, some random
  for (let v = 0; v < 30; v++) {
    const cluster = originClusters[Math.floor(rnd() * originClusters.length)]
    const spread = 60 + rnd() * 100
    organicVein(rnd, ctx, size,
      cluster[0] + (rnd() - 0.5) * spread,
      cluster[1] + (rnd() - 0.5) * spread,
      1.0 + rnd() * 1.5, 0)
  }
  // Fine capillaries — scattered
  for (let v = 0; v < 50; v++) {
    const x0 = rnd() * size
    const y0 = rnd() * size
    organicVein(rnd, ctx, size, x0, y0, 0.3 + rnd() * 0.7, 0)
  }

  // ── Highlight gloss streaks: pearlescent sheen patches ──
  for (let i = 0; i < 30; i++) {
    const x0 = rnd() * size
    const y0 = rnd() * size
    const len = 100 + rnd() * 300
    const angle = rnd() * Math.PI * 2
    const x1 = x0 + Math.cos(angle) * len
    const y1 = y0 + Math.sin(angle) * len
    const grad = ctx.createLinearGradient(x0, y0, x1, y1)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.4, `rgba(255,253,248,${0.06 + rnd() * 0.08})`)
    grad.addColorStop(0.6, `rgba(255,253,248,${0.06 + rnd() * 0.08})`)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(
      (x0 + x1) / 2, (y0 + y1) / 2,
      len / 2, 8 + rnd() * 20,
      angle, 0, Math.PI * 2
    )
    ctx.fill()
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  return texture
}

/**
 * Generate a bump map for the sclera surface.
 * Creates visible ridges from collagen fiber bundles and raised veins.
 */
export function bumpEsclera(semente: number, size = 1024): CanvasTexture {
  const rnd = criarPrng(semente);
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  // Mid-gray base (128 = flat surface)
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, size, size)

  // ── Collagen fiber ridges: horizontal wavy bands ──
  for (let i = 0; i < 500; i++) {
    const y0 = rnd() * size
    const x0 = rnd() * size * 0.05
    const len = size * (0.4 + rnd() * 0.6)
    const steps = 35 + Math.floor(rnd() * 20)
    const stepLen = len / steps
    const drift = (rnd() - 0.5) * 0.1

    ctx.beginPath()
    let x = x0, y = y0
    ctx.moveTo(x, y)
    for (let s = 0; s < steps; s++) {
      x += stepLen
      y += drift * stepLen + (rnd() - 0.5) * 2.5
      ctx.lineTo(x, y)
    }
    // Lighter = raised, darker = indented
    const raised = 128 + Math.floor(rnd() * 30)
    ctx.strokeStyle = `rgba(${raised},${raised},${raised},${0.15 + rnd() * 0.2})`
    ctx.lineWidth = 0.8 + rnd() * 3
    ctx.stroke()
  }

  // ── Cross fibers ──
  for (let i = 0; i < 250; i++) {
    const angle = (rnd() - 0.5) * Math.PI * 0.5
    const x0 = rnd() * size
    const y0 = rnd() * size
    const len = 40 + rnd() * 160
    const steps = 10 + Math.floor(rnd() * 10)
    const stepLen = len / steps

    ctx.beginPath()
    let x = x0, y = y0
    ctx.moveTo(x, y)
    for (let s = 0; s < steps; s++) {
      x += Math.cos(angle) * stepLen + (rnd() - 0.5) * 2
      y += Math.sin(angle) * stepLen + (rnd() - 0.5) * 2
      ctx.lineTo(x, y)
    }
    const raised = 125 + Math.floor(rnd() * 25)
    ctx.strokeStyle = `rgba(${raised},${raised},${raised},${0.1 + rnd() * 0.15})`
    ctx.lineWidth = 0.5 + rnd() * 2
    ctx.stroke()
  }

  // ── Vein ridges (raised on surface) ──
  for (let v = 0; v < 20; v++) {
    organicVeinBump(rnd, ctx, size, rnd() * size, rnd() * size, 2 + rnd() * 3, 0)
  }
  for (let v = 0; v < 35; v++) {
    organicVeinBump(rnd, ctx, size, rnd() * size, rnd() * size, 0.8 + rnd() * 1.5, 0)
  }

  // ── Fine noise grain ──
  for (let i = 0; i < 8000; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const r = 0.3 + rnd() * 1.5
    const v = 118 + Math.floor(rnd() * 20)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${v},${v},${v},${0.08 + rnd() * 0.1})`
    ctx.fill()
  }

  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  return texture
}

/**
 * Organic vein with sinusoidal tortuosity, variable thickness per segment,
 * and natural quadratic-curve branching.
 * Each vein segment is drawn individually so thickness varies along the path.
 */
function organicVein(
  rnd: () => number,
  ctx: CanvasRenderingContext2D,
  size: number,
  startX: number,
  startY: number,
  maxThickness: number,
  depth: number
) {
  if (maxThickness < 0.2 || depth > 5) return

  // Direction toward center-ish with randomness
  const cx = size / 2 + (rnd() - 0.5) * size * 0.4
  const cy = size / 2 + (rnd() - 0.5) * size * 0.4
  let dx = cx - startX
  let dy = cy - startY
  const d0 = Math.sqrt(dx * dx + dy * dy) || 1
  dx /= d0; dy /= d0

  // Tortuosity parameters — unique per vein
  const tortuosity = 0.4 + rnd() * 1.2  // how wavy
  const waveFreq = 0.08 + rnd() * 0.15  // wave frequency
  const wavePhase = rnd() * Math.PI * 2

  const totalLen = size * (0.15 + rnd() * 0.45)
  const segments = 25 + Math.floor(rnd() * 35)
  const segLen = totalLen / segments

  // Color for this vein (consistent along its length)
  const red = 140 + Math.floor(rnd() * 65)
  const green = 25 + Math.floor(rnd() * 45)
  const blue = 15 + Math.floor(rnd() * 35)

  let x = startX
  let y = startY

  // Build path points first for quadratic curves
  const points: [number, number][] = [[x, y]]

  for (let i = 0; i < segments; i++) {
    const t = i / segments

    // Sinusoidal wandering perpendicular to direction
    const perpX = -dy
    const perpY = dx
    const wave = Math.sin(wavePhase + i * waveFreq * Math.PI * 2) * tortuosity * segLen

    // Random jitter on top of wave
    const jitterX = (rnd() - 0.5) * segLen * 0.6
    const jitterY = (rnd() - 0.5) * segLen * 0.6

    // Drift direction slowly
    dx += (rnd() - 0.5) * 0.4
    dy += (rnd() - 0.5) * 0.4
    const mag = Math.sqrt(dx * dx + dy * dy)
    dx /= mag; dy /= mag

    x += dx * segLen + perpX * wave + jitterX
    y += dy * segLen + perpY * wave + jitterY
    points.push([x, y])

    // Branching — more likely for thick veins, further along
    const currentThickness = maxThickness * (1 - t * 0.7) * (0.7 + rnd() * 0.3)
    if (i > 3 && rnd() < 0.18 && currentThickness > 0.3) {
      organicVein(rnd, ctx, size, x, y, currentThickness * (0.4 + rnd() * 0.25), depth + 1)
    }
  }

  // Draw with per-segment thickness variation using quadratic curves
  for (let i = 0; i < points.length - 1; i++) {
    const t = i / (points.length - 1)

    // Thickness: tapers + has lumpy variation
    const taper = 1 - t * 0.7
    const lump = 0.7 + Math.sin(i * 1.7) * 0.2 + rnd() * 0.2
    const thickness = Math.max(0.15, maxThickness * taper * lump)

    // Opacity: thicker = more opaque, fades at tips
    const alpha = Math.min(0.9, (0.1 + maxThickness * 0.12) * taper)

    ctx.beginPath()
    ctx.moveTo(points[i][0], points[i][1])

    if (i < points.length - 2) {
      // Quadratic curve through midpoint for smoothness
      const midX = (points[i + 1][0] + points[i + 2][0]) / 2
      const midY = (points[i + 1][1] + points[i + 2][1]) / 2
      ctx.quadraticCurveTo(points[i + 1][0], points[i + 1][1], midX, midY)
    } else {
      ctx.lineTo(points[i + 1][0], points[i + 1][1])
    }

    ctx.strokeStyle = `rgba(${red},${green},${blue},${alpha})`
    ctx.lineWidth = thickness
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
}

/** Organic vein ridge for bump map (grayscale raised) */
function organicVeinBump(
  rnd: () => number,
  ctx: CanvasRenderingContext2D,
  size: number,
  startX: number,
  startY: number,
  maxThickness: number,
  depth: number
) {
  if (maxThickness < 0.4 || depth > 4) return

  const cx = size / 2 + (rnd() - 0.5) * size * 0.5
  const cy = size / 2 + (rnd() - 0.5) * size * 0.5
  let dx = cx - startX
  let dy = cy - startY
  const d0 = Math.sqrt(dx * dx + dy * dy) || 1
  dx /= d0; dy /= d0

  const tortuosity = 0.3 + rnd() * 1.0
  const waveFreq = 0.08 + rnd() * 0.12
  const wavePhase = rnd() * Math.PI * 2

  const totalLen = size * (0.2 + rnd() * 0.4)
  const segments = 20 + Math.floor(rnd() * 25)
  const segLen = totalLen / segments

  const points: [number, number][] = [[startX, startY]]
  let x = startX, y = startY

  for (let i = 0; i < segments; i++) {
    const perpX = -dy, perpY = dx
    const wave = Math.sin(wavePhase + i * waveFreq * Math.PI * 2) * tortuosity * segLen
    dx += (rnd() - 0.5) * 0.35
    dy += (rnd() - 0.5) * 0.35
    const mag = Math.sqrt(dx * dx + dy * dy)
    dx /= mag; dy /= mag
    x += dx * segLen + perpX * wave + (rnd() - 0.5) * segLen * 0.4
    y += dy * segLen + perpY * wave + (rnd() - 0.5) * segLen * 0.4
    points.push([x, y])

    const t = i / segments
    const ct = maxThickness * (1 - t * 0.6)
    if (i > 3 && rnd() < 0.12 && ct > 0.5) {
      organicVeinBump(rnd, ctx, size, x, y, ct * 0.5, depth + 1)
    }
  }

  for (let i = 0; i < points.length - 1; i++) {
    const t = i / (points.length - 1)
    const thickness = Math.max(0.3, maxThickness * (1 - t * 0.6) * (0.75 + rnd() * 0.25))

    ctx.beginPath()
    ctx.moveTo(points[i][0], points[i][1])
    if (i < points.length - 2) {
      const midX = (points[i + 1][0] + points[i + 2][0]) / 2
      const midY = (points[i + 1][1] + points[i + 2][1]) / 2
      ctx.quadraticCurveTo(points[i + 1][0], points[i + 1][1], midX, midY)
    } else {
      ctx.lineTo(points[i + 1][0], points[i + 1][1])
    }

    const v = 150 + Math.floor(rnd() * 25)
    ctx.strokeStyle = `rgba(${v},${v},${v},${0.25 + rnd() * 0.25})`
    ctx.lineWidth = thickness
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}

