import type { CSSProperties } from 'react'
import { ConsoleShell } from '../../components/console/ConsoleShell'
import { KnowledgeGraph } from '../../components/graph/KnowledgeGraph'
import { Badge } from '../../components/ui/Badge'

const FACETS = [
  { label: 'Documents', value: 1284, tone: 'cyan' as const },
  { label: 'Entities', value: 18902, tone: 'mint' as const },
  { label: 'Topics', value: 412, tone: 'amber' as const },
  { label: 'People', value: 96, tone: 'rose' as const },
]

export function GraphView() {
  return (
    <ConsoleShell title="Graph" subtitle="Traverse the knowledge graph for acme-platform.">
      <div className="console__facets animate-in">
        {FACETS.map((facet, i) => (
          <div
            className="facet animate-in"
            key={facet.label}
            style={{ '--delay': `${i * 80}ms` } as CSSProperties}
          >
            <Badge tone={facet.tone}>{facet.label}</Badge>
            <strong className="text-mono">{facet.value.toLocaleString()}</strong>
          </div>
        ))}
      </div>

      <div className="animate-in" style={{ '--delay': '160ms' } as CSSProperties}>
        <KnowledgeGraph initial="core" />
      </div>

      <p className="console__note">
        The graph is rendered from a fixed sample layout in{' '}
        <code>src/components/graph/KnowledgeGraph.tsx</code>. Point <code>NODES</code> and{' '}
        <code>EDGES</code> at a real endpoint to make it live.
      </p>
    </ConsoleShell>
  )
}
