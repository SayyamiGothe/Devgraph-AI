import { useMemo, useState, type CSSProperties } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useReveal } from '../../hooks/useReveal'
import './KnowledgeGraph.scss'

export type NodeKind = 'core' | 'document' | 'entity' | 'topic' | 'person'

export interface GraphNode {
  id: string
  label: string
  kind: NodeKind
  x: number
  y: number
  r: number
  detail: string
  confidence?: number
}

const W = 760
const H = 520

// Hand-placed rather than force-simulated: a stable, legible layout beats a
// slightly more organic one that reshuffles on every mount.
export const NODES: GraphNode[] = [
  { id: 'core', label: 'acme-platform', kind: 'core', x: 380, y: 262, r: 34, detail: 'Project root · 1,284 documents · 18,902 entities' },

  { id: 'msa', label: 'MSA 2026', kind: 'document', x: 176, y: 128, r: 22, detail: 'Contract · 312 pages · parsed in 4.2s', confidence: 0.98 },
  { id: 'spec', label: 'billing-spec', kind: 'document', x: 606, y: 132, r: 21, detail: 'Spec · 48 pages · 12 linked ADRs', confidence: 0.94 },
  { id: 'adr', label: 'ADR-0031', kind: 'document', x: 640, y: 344, r: 18, detail: 'Decision record · supersedes ADR-0018', confidence: 0.91 },
  { id: 'inc', label: 'INC-4412', kind: 'document', x: 152, y: 386, r: 18, detail: 'Incident report · 3 contradictions found', confidence: 0.88 },

  { id: 'residency', label: 'Data residency', kind: 'topic', x: 296, y: 62, r: 16, detail: 'Topic · appears in 41 documents' },
  { id: 'renewal', label: 'Renewal terms', kind: 'topic', x: 82, y: 246, r: 15, detail: 'Topic · 18 obligations extracted' },
  { id: 'sla', label: 'SLA 99.95%', kind: 'entity', x: 512, y: 60, r: 15, detail: 'Threshold · referenced by 7 specs', confidence: 0.99 },
  { id: 'eur', label: 'EUR 240k', kind: 'entity', x: 686, y: 236, r: 14, detail: 'Amount · annual commitment', confidence: 0.96 },
  { id: 'q4', label: 'Q4 2026', kind: 'entity', x: 300, y: 452, r: 14, detail: 'Date · renewal window opens 01 Oct', confidence: 0.97 },

  { id: 'legal', label: 'R. Mehta', kind: 'person', x: 470, y: 452, r: 15, detail: 'Approver · signed 4 exceptions' },
  { id: 'eng', label: 'S. Gothe', kind: 'person', x: 560, y: 392, r: 14, detail: 'Owner · billing service' },
]

export const EDGES: Array<[string, string]> = [
  ['core', 'msa'],
  ['core', 'spec'],
  ['core', 'adr'],
  ['core', 'inc'],
  ['msa', 'residency'],
  ['msa', 'renewal'],
  ['msa', 'eur'],
  ['msa', 'q4'],
  ['spec', 'sla'],
  ['spec', 'residency'],
  ['spec', 'adr'],
  ['adr', 'eng'],
  ['adr', 'eur'],
  ['inc', 'q4'],
  ['inc', 'legal'],
  ['legal', 'msa'],
  ['eng', 'spec'],
  ['residency', 'sla'],
]

export const KIND_LABEL: Record<NodeKind, string> = {
  core: 'Project',
  document: 'Document',
  entity: 'Entity',
  topic: 'Topic',
  person: 'Person',
}

const KIND_TONE: Record<NodeKind, string> = {
  core: 'violet',
  document: 'cyan',
  entity: 'mint',
  topic: 'amber',
  person: 'rose',
}

const LEGEND: NodeKind[] = ['document', 'entity', 'topic', 'person']

/**
 * Interactive knowledge graph: hover traces a node's neighbourhood, click pins
 * it in the inspector. Shared by the marketing page and the console.
 */
export function KnowledgeGraph({ initial = 'msa' }: { initial?: string }) {
  const [active, setActive] = useState(initial)
  const [hovered, setHovered] = useState<string | null>(null)
  const reduced = useReducedMotion()
  const stage = useReveal<HTMLDivElement>({ threshold: 0.2 })

  const byId = useMemo(() => new Map(NODES.map((node) => [node.id, node])), [])

  // Highlight follows the pointer while hovering, and the selection otherwise.
  const focus = hovered ?? active

  const neighbours = useMemo(() => {
    const set = new Set<string>([focus])
    EDGES.forEach(([a, b]) => {
      if (a === focus) set.add(b)
      if (b === focus) set.add(a)
    })
    return set
  }, [focus])

  const selected = byId.get(active) ?? NODES[0]

  return (
    <div className="knowledge-graph__layout">
      <div className="knowledge-graph__stage-wrap">
        <div
          className={`knowledge-graph__stage ${stage.visible ? 'is-visible' : ''}`}
          ref={stage.ref}
          onPointerLeave={() => setHovered(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="knowledge-graph__svg" role="img" aria-label="Knowledge graph">
            <defs>
              <linearGradient id="edge-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#7c5cff" />
                <stop offset="1" stopColor="#22d3ee" />
              </linearGradient>
              <filter id="node-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g className="knowledge-graph__edges">
              {EDGES.map(([a, b], i) => {
                const from = byId.get(a)
                const to = byId.get(b)
                if (!from || !to) return null

                return (
                  <line
                    key={`${a}-${b}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className={`knowledge-graph__edge ${neighbours.has(a) && neighbours.has(b) ? 'is-lit' : ''}`}
                    style={{ '--delay': `${i * 45}ms` } as CSSProperties}
                  />
                )
              })}
            </g>

            {/* Packets travelling along the lit edges. SMIL can't be disabled
                from CSS, so it is simply not rendered under reduced motion. */}
            {!reduced && (
              <g className="knowledge-graph__packets">
                {EDGES.filter(([a, b]) => neighbours.has(a) && neighbours.has(b)).map(([a, b], i) => {
                  const from = byId.get(a)
                  const to = byId.get(b)
                  if (!from || !to) return null

                  return (
                    <circle key={`p-${a}-${b}`} r="3" className="knowledge-graph__packet">
                      <animateMotion
                        dur={`${2.2 + (i % 4) * 0.45}s`}
                        repeatCount="indefinite"
                        path={`M${from.x},${from.y} L${to.x},${to.y}`}
                      />
                    </circle>
                  )
                })}
              </g>
            )}

            <g className="knowledge-graph__nodes">
              {NODES.map((node, i) => (
                // The outer group owns placement, the inner one owns the scale
                // animation. Keeping them apart matters: a CSS `transform`
                // overrides the SVG `transform` attribute, so animating scale on
                // this element would drop the translate and stack every node at
                // the origin.
                <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
                  <g
                    className={[
                      'knowledge-graph__node',
                      `is-${node.kind}`,
                      neighbours.has(node.id) ? '' : 'is-dim',
                      node.id === active ? 'is-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ '--delay': `${300 + i * 60}ms` } as CSSProperties}
                    onPointerEnter={() => setHovered(node.id)}
                    onClick={() => setActive(node.id)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${KIND_LABEL[node.kind]}: ${node.label}`}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setActive(node.id)
                      }
                    }}
                  >
                    <circle className="knowledge-graph__halo" r={node.r * 1.9} />
                    <circle className="knowledge-graph__ring" r={node.r} />
                    <circle className="knowledge-graph__core" r={node.r * 0.46} filter="url(#node-glow)" />
                    <text className="knowledge-graph__label" y={node.r + 17} textAnchor="middle">
                      {node.label}
                    </text>
                  </g>
                </g>
              ))}
            </g>
          </svg>

          <div className="knowledge-graph__hint text-mono">click a node</div>
        </div>
      </div>

      <div className="knowledge-graph__side">
        {/* Keyed on the selection so the panel replays its entrance each pick. */}
        <div className="knowledge-graph__inspector" key={selected.id}>
          <span className={`badge badge--${KIND_TONE[selected.kind]}`}>
            {KIND_LABEL[selected.kind]}
          </span>

          <h3>{selected.label}</h3>
          <p>{selected.detail}</p>

          {selected.confidence !== undefined && (
            <div className="knowledge-graph__confidence">
              <div className="flex-between">
                <span>Extraction confidence</span>
                <strong className="text-mono">{(selected.confidence * 100).toFixed(0)}%</strong>
              </div>
              <span className="knowledge-graph__meter">
                <span
                  className="knowledge-graph__meter-fill"
                  style={{ '--fill': `${selected.confidence * 100}%` } as CSSProperties}
                />
              </span>
            </div>
          )}

          <div className="knowledge-graph__links">
            <span className="knowledge-graph__links-title">Connected</span>
            <ul>
              {[...neighbours]
                .filter((id) => id !== focus)
                .slice(0, 5)
                .map((id) => {
                  const node = byId.get(id)
                  if (!node) return null

                  return (
                    <li key={id}>
                      <button onClick={() => setActive(id)}>
                        <span className={`knowledge-graph__swatch is-${node.kind}`} aria-hidden="true" />
                        {node.label}
                        <em>{KIND_LABEL[node.kind]}</em>
                      </button>
                    </li>
                  )
                })}
            </ul>
          </div>
        </div>

        <div className="knowledge-graph__legend">
          {LEGEND.map((kind) => (
            <span className="knowledge-graph__legend-item" key={kind}>
              <span className={`knowledge-graph__swatch is-${kind}`} aria-hidden="true" />
              {KIND_LABEL[kind]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
