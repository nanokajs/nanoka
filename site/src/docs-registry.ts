import { contentEn as conceptsEn, contentJa as conceptsJa } from './content/concepts'
import {
  contentEn as gettingStartedEn,
  contentJa as gettingStartedJa,
} from './content/getting-started'
import { contentEn as indexEn, contentJa as indexJa } from './content/index'
import { renderMarkdown } from './markdown'

type DocSection = 'top' | 'api' | 'guides' | 'cli'

interface DocPage {
  path: string
  title: string
  section: DocSection
  description?: string
  content: string
  contentJa?: string
}

interface NavGroup {
  label: string
  section: DocSection
  pages: DocPage[]
}

const PLACEHOLDER = '<p>This page is under construction.</p>'

const indexHtml = renderMarkdown(indexEn)
const indexHtmlJa = renderMarkdown(indexJa)
const gettingStartedHtml = renderMarkdown(gettingStartedEn)
const gettingStartedHtmlJa = renderMarkdown(gettingStartedJa)
const conceptsHtml = renderMarkdown(conceptsEn)
const conceptsHtmlJa = renderMarkdown(conceptsJa)

// 15 pages total
export const docPages: readonly DocPage[] = [
  {
    path: '/',
    title: 'Introduction',
    section: 'top',
    description: 'Nanoka — Thin wrapper over Hono + Drizzle + Zod for Cloudflare Workers + D1.',
    content: indexHtml,
    contentJa: indexHtmlJa,
  },
  {
    path: '/getting-started',
    title: 'Getting Started',
    section: 'top',
    description:
      'Get started with Nanoka in minutes. Install, define a model, generate migrations, and run your first API.',
    content: gettingStartedHtml,
    contentJa: gettingStartedHtmlJa,
  },
  {
    path: '/concepts',
    title: 'Core Concepts',
    section: 'top',
    description:
      'Core concepts behind Nanoka: 80% automatic, 20% explicit, field policies, and the model-centric design.',
    content: conceptsHtml,
    contentJa: conceptsHtmlJa,
  },
  {
    path: '/api/field-types',
    title: 'Field Types',
    section: 'api',
    content: PLACEHOLDER,
  },
  {
    path: '/api/field-policies',
    title: 'Field Policies',
    section: 'api',
    content: PLACEHOLDER,
  },
  {
    path: '/api/schema-validator',
    title: 'Schema & Validator',
    section: 'api',
    content: PLACEHOLDER,
  },
  {
    path: '/api/crud',
    title: 'CRUD Methods',
    section: 'api',
    content: PLACEHOLDER,
  },
  {
    path: '/api/response-shaping',
    title: 'Response Shaping',
    section: 'api',
    content: PLACEHOLDER,
  },
  {
    path: '/api/openapi',
    title: 'OpenAPI',
    section: 'api',
    content: PLACEHOLDER,
  },
  {
    path: '/api/escape-hatch',
    title: 'Escape Hatch',
    section: 'api',
    content: PLACEHOLDER,
  },
  {
    path: '/api/adapters',
    title: 'Adapters',
    section: 'api',
    content: PLACEHOLDER,
  },
  {
    path: '/guides/migration',
    title: 'Migration Workflow',
    section: 'guides',
    content: PLACEHOLDER,
  },
  {
    path: '/guides/error-handling',
    title: 'Error Handling',
    section: 'guides',
    content: PLACEHOLDER,
  },
  {
    path: '/guides/turso',
    title: 'Using with Turso',
    section: 'guides',
    content: PLACEHOLDER,
  },
  {
    path: '/cli',
    title: 'CLI Reference',
    section: 'cli',
    content: PLACEHOLDER,
  },
] satisfies readonly DocPage[]

export const navStructure: NavGroup[] = [
  { label: '', section: 'top', pages: docPages.filter((p) => p.section === 'top') },
  { label: 'API Reference', section: 'api', pages: docPages.filter((p) => p.section === 'api') },
  { label: 'Guides', section: 'guides', pages: docPages.filter((p) => p.section === 'guides') },
  { label: '', section: 'cli', pages: docPages.filter((p) => p.section === 'cli') },
]

export const docsByPath = new Map(docPages.map((p) => [p.path, p]))
