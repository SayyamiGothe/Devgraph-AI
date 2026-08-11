/**
 * Demo data for the console.
 *
 * The backend currently exposes auth only (`/auth/register`, `/auth/login`,
 * `/auth/me`, `DELETE /auth/users/{id}`), so everything below is local sample
 * data shaped like the SQLAlchemy models in `backend/app/models`. Swap each
 * export for a fetch as the corresponding endpoints land.
 */

export interface MockProject {
  id: number
  name: string
  description: string
  documents: number
  entities: number
  /** 0–1, share of documents fully indexed. */
  indexed: number
  updated: string
}

export interface MockWorkspace {
  id: number
  name: string
  organisation_id: number
  projects: MockProject[]
}

export const WORKSPACES: MockWorkspace[] = [
  {
    id: 1,
    name: 'Platform',
    organisation_id: 1,
    projects: [
      {
        id: 11,
        name: 'acme-platform',
        description: 'Core service specs, ADRs and incident reports.',
        documents: 1284,
        entities: 18902,
        indexed: 1,
        updated: '4 minutes ago',
      },
      {
        id: 12,
        name: 'billing-migration',
        description: 'Vendor contracts and migration runbooks for the billing cutover.',
        documents: 312,
        entities: 4471,
        indexed: 0.82,
        updated: '26 minutes ago',
      },
    ],
  },
  {
    id: 2,
    name: 'Legal',
    organisation_id: 1,
    projects: [
      {
        id: 21,
        name: 'msa-2026',
        description: 'Master service agreements and renewal schedules.',
        documents: 486,
        entities: 9120,
        indexed: 1,
        updated: '2 hours ago',
      },
      {
        id: 22,
        name: 'dpa-review',
        description: 'Data processing addenda across 41 sub-processors.',
        documents: 147,
        entities: 2308,
        indexed: 0.46,
        updated: '18 minutes ago',
      },
    ],
  },
  {
    id: 3,
    name: 'Research',
    organisation_id: 1,
    projects: [
      {
        id: 31,
        name: 'eval-harness',
        description: 'Benchmark corpora and grading rubrics for retrieval evals.',
        documents: 92,
        entities: 1043,
        indexed: 1,
        updated: 'yesterday',
      },
    ],
  },
]

export interface MockStat {
  label: string
  value: number
  decimals?: number
  suffix?: string
  delta: number
  /** Sparkline series, arbitrary units. */
  series: number[]
  tone: 'violet' | 'cyan' | 'mint' | 'amber'
}

export const STATS: MockStat[] = [
  {
    label: 'Documents indexed',
    value: 2321,
    delta: 12.4,
    series: [18, 22, 19, 28, 34, 31, 44, 48, 46, 58, 64, 72],
    tone: 'violet',
  },
  {
    label: 'Entities extracted',
    value: 35844,
    delta: 8.1,
    series: [30, 34, 33, 41, 38, 47, 52, 51, 60, 63, 69, 74],
    tone: 'cyan',
  },
  {
    label: 'Graph edges',
    value: 128713,
    delta: 21.7,
    series: [12, 18, 26, 24, 33, 42, 49, 56, 61, 70, 78, 92],
    tone: 'mint',
  },
  {
    label: 'Avg. query latency',
    value: 418,
    suffix: 'ms',
    delta: -6.3,
    series: [72, 68, 70, 61, 58, 60, 54, 49, 47, 44, 42, 39],
    tone: 'amber',
  },
]

export type IngestStatus = 'parsing' | 'extracting' | 'linking' | 'done' | 'failed'

export interface MockIngest {
  id: string
  name: string
  pages: number
  status: IngestStatus
  progress: number
  project: string
}

export const INGEST_QUEUE: MockIngest[] = [
  { id: 'q1', name: 'MSA-2026-014.pdf', pages: 312, status: 'linking', progress: 0.86, project: 'msa-2026' },
  { id: 'q2', name: 'dpa-northwind.docx', pages: 48, status: 'extracting', progress: 0.54, project: 'dpa-review' },
  { id: 'q3', name: 'billing-runbook.md', pages: 12, status: 'parsing', progress: 0.22, project: 'billing-migration' },
  { id: 'q4', name: 'INC-4412-postmortem.md', pages: 9, status: 'done', progress: 1, project: 'acme-platform' },
  { id: 'q5', name: 'vendor-scan-q3.pdf', pages: 640, status: 'failed', progress: 0.38, project: 'dpa-review' },
]

export interface MockActivity {
  id: string
  actor: string
  action: string
  target: string
  at: string
  tone: 'violet' | 'cyan' | 'mint' | 'amber' | 'rose'
}

export const ACTIVITY: MockActivity[] = [
  { id: 'a1', actor: 'Pipeline', action: 'linked 1,204 new edges in', target: 'msa-2026', at: '4m', tone: 'violet' },
  { id: 'a2', actor: 'R. Mehta', action: 'approved an exception on', target: 'ADR-0031', at: '22m', tone: 'mint' },
  { id: 'a3', actor: 'Pipeline', action: 'flagged 3 contradictions in', target: 'INC-4412', at: '1h', tone: 'amber' },
  { id: 'a4', actor: 'S. Gothe', action: 'created project', target: 'eval-harness', at: '3h', tone: 'cyan' },
  { id: 'a5', actor: 'Pipeline', action: 'failed to parse', target: 'vendor-scan-q3.pdf', at: '5h', tone: 'rose' },
]

export const RECENT_QUERIES = [
  'Which contracts renew before Q4 and mention data residency?',
  'Show every spec that depends on the billing service.',
  'Who approved the SOC 2 exception, and where is it recorded?',
  'List obligations with a deadline inside the next 30 days.',
]
