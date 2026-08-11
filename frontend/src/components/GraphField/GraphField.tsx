import { useEffect, useRef } from 'react'
import { prefersReducedMotion, seeded } from '../../lib/motion'
import './GraphField.scss'

interface GraphFieldProps {
  /** Nodes per million square pixels — density scales with the viewport. */
  density?: number
  /** Follow the pointer: nearby nodes drift away and their links brighten. */
  interactive?: boolean
  className?: string
}

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  tint: number
}

const TINTS = [
  [124, 92, 255], // violet
  [34, 211, 238], // cyan
  [244, 114, 182], // pink
  [52, 211, 153], // mint
]

const LINK_DISTANCE = 148

/**
 * The ambient "knowledge graph" backdrop: nodes drifting in a field, linked
 * whenever they come close enough, with packets travelling along the links.
 *
 * Everything is drawn to one canvas — a few hundred DOM nodes with individual
 * animations would cost far more than a single rAF loop.
 */
export function GraphField({ density = 42, interactive = true, className = '' }: GraphFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const parent = canvas.parentElement
    const random = seeded(20260807)
    const reduced = prefersReducedMotion()

    let width = 0
    let height = 0
    let nodes: Node[] = []
    let frame = 0
    let t = 0
    const pointer = { x: -9999, y: -9999, active: false }

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = (parent ?? canvas).getBoundingClientRect()
      width = Math.max(rect.width, 1)
      height = Math.max(rect.height, 1)

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.round((width * height) / 1_000_000 * density) + 12
      nodes = Array.from({ length: count }, (_, i) => ({
        x: random() * width,
        y: random() * height,
        vx: (random() - 0.5) * 0.24,
        vy: (random() - 0.5) * 0.24,
        r: 1.1 + random() * 2.3,
        tint: i % TINTS.length,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      t += 1

      // Links first, so nodes sit on top of them.
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i]

        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist > LINK_DISTANCE) continue

          const closeness = 1 - dist / LINK_DISTANCE

          // Links near the pointer get a boost, which reads as the graph
          // "waking up" under the cursor.
          let emphasis = 0
          if (interactive && pointer.active) {
            const mx = (a.x + b.x) / 2 - pointer.x
            const my = (a.y + b.y) / 2 - pointer.y
            const mdist = Math.hypot(mx, my)
            if (mdist < 220) emphasis = (1 - mdist / 220) * 0.55
          }

          const [r, g, bl] = TINTS[a.tint]
          ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, ${(closeness * 0.16 + emphasis).toFixed(3)})`
          ctx.lineWidth = 0.7 + emphasis * 1.4
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()

          // A packet slides along the longer links every so often.
          if (!reduced && closeness > 0.55 && (i + j) % 7 === 0) {
            const phase = ((t / 90 + (i * 0.13 + j * 0.07)) % 1)
            const px = a.x + (b.x - a.x) * phase
            const py = a.y + (b.y - a.y) * phase
            ctx.fillStyle = `rgba(255, 255, 255, ${(0.5 * closeness).toFixed(3)})`
            ctx.beginPath()
            ctx.arc(px, py, 1.5, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      for (const node of nodes) {
        const [r, g, bl] = TINTS[node.tint]

        // Halo
        const halo = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r * 6)
        halo.addColorStop(0, `rgba(${r}, ${g}, ${bl}, 0.32)`)
        halo.addColorStop(1, `rgba(${r}, ${g}, ${bl}, 0)`)
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.r * 6, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = `rgba(${r}, ${g}, ${bl}, 0.9)`
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const step = () => {
      for (const node of nodes) {
        node.x += node.vx
        node.y += node.vy

        // Soft repulsion from the pointer.
        if (interactive && pointer.active) {
          const dx = node.x - pointer.x
          const dy = node.y - pointer.y
          const dist = Math.hypot(dx, dy)
          if (dist < 130 && dist > 0.01) {
            const push = (1 - dist / 130) * 0.5
            node.x += (dx / dist) * push
            node.y += (dy / dist) * push
          }
        }

        // Wrap instead of bouncing — no visible walls.
        if (node.x < -20) node.x = width + 20
        if (node.x > width + 20) node.x = -20
        if (node.y < -20) node.y = height + 20
        if (node.y > height + 20) node.y = -20
      }

      draw()
      frame = requestAnimationFrame(step)
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = event.clientX - rect.left
      pointer.y = event.clientY - rect.top
      pointer.active = true
    }

    const onPointerLeave = () => {
      pointer.active = false
      pointer.x = -9999
      pointer.y = -9999
    }

    build()

    if (reduced) {
      draw()
    } else {
      frame = requestAnimationFrame(step)
    }

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            build()
            if (reduced) draw()
          })
    if (observer && parent) observer.observe(parent)

    if (interactive) {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      window.addEventListener('pointerleave', onPointerLeave)
    }

    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [density, interactive])

  return <canvas ref={canvasRef} className={`graph-field ${className}`.trim()} aria-hidden="true" />
}
