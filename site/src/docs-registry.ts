import { contentEn as adaptersEn, contentJa as adaptersJa } from './content/api/adapters'
import { contentEn as crudEn, contentJa as crudJa } from './content/api/crud'
import { contentEn as escapeHatchEn, contentJa as escapeHatchJa } from './content/api/escape-hatch'
import {
  contentEn as fieldPoliciesEn,
  contentJa as fieldPoliciesJa,
} from './content/api/field-policies'
import { contentEn as fieldTypesEn, contentJa as fieldTypesJa } from './content/api/field-types'
import { contentEn as openapiEn, contentJa as openapiJa } from './content/api/openapi'
import {
  contentEn as responseShapingEn,
  contentJa as responseShapingJa,
} from './content/api/response-shaping'
import {
  contentEn as schemaValidatorEn,
  contentJa as schemaValidatorJa,
} from './content/api/schema-validator'
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

const fieldTypesHtml = renderMarkdown(fieldTypesEn)
const fieldTypesHtmlJa = renderMarkdown(fieldTypesJa)
const fieldPoliciesHtml = renderMarkdown(fieldPoliciesEn)
const fieldPoliciesHtmlJa = renderMarkdown(fieldPoliciesJa)
const schemaValidatorHtml = renderMarkdown(schemaValidatorEn)
const schemaValidatorHtmlJa = renderMarkdown(schemaValidatorJa)
const crudHtml = renderMarkdown(crudEn)
const crudHtmlJa = renderMarkdown(crudJa)
const responseShapingHtml = renderMarkdown(responseShapingEn)
const responseShapingHtmlJa = renderMarkdown(responseShapingJa)
const openapiHtml = renderMarkdown(openapiEn)
const openapiHtmlJa = renderMarkdown(openapiJa)
const escapeHatchHtml = renderMarkdown(escapeHatchEn)
const escapeHatchHtmlJa = renderMarkdown(escapeHatchJa)
const adaptersHtml = renderMarkdown(adaptersEn)
const adaptersHtmlJa = renderMarkdown(adaptersJa)

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
    description: 'All field types and modifiers available in Nanoka model definitions.',
    content: fieldTypesHtml,
    contentJa: fieldTypesHtmlJa,
  },
  {
    path: '/api/field-policies',
    title: 'Field Policies',
    section: 'api',
    description:
      'How readOnly, writeOnly, and serverOnly policies control API input and output shapes.',
    content: fieldPoliciesHtml,
    contentJa: fieldPoliciesHtmlJa,
  },
  {
    path: '/api/schema-validator',
    title: 'Schema & Validator',
    section: 'api',
    description:
      'schema(), validator(), inputSchema(), and outputSchema() — standalone Zod schemas and Hono middleware derived from your model.',
    content: schemaValidatorHtml,
    contentJa: schemaValidatorHtmlJa,
  },
  {
    path: '/api/crud',
    title: 'CRUD Methods',
    section: 'api',
    description:
      'findMany, findAll, findOne, create, update, and delete — adapter-bound CRUD methods on Nanoka models.',
    content: crudHtml,
    contentJa: crudHtmlJa,
  },
  {
    path: '/api/response-shaping',
    title: 'Response Shaping',
    section: 'api',
    description:
      'toResponse() and toResponseMany() — strip serverOnly and writeOnly fields before returning data to clients.',
    content: responseShapingHtml,
    contentJa: responseShapingHtmlJa,
  },
  {
    path: '/api/openapi',
    title: 'OpenAPI',
    section: 'api',
    description: 'Generate OpenAPI 3.1 specs and serve Swagger UI from your Nanoka application.',
    content: openapiHtml,
    contentJa: openapiHtmlJa,
  },
  {
    path: '/api/escape-hatch',
    title: 'Escape Hatch',
    section: 'api',
    description:
      'app.db and app.batch() — direct Drizzle access for joins, aggregations, and advanced queries.',
    content: escapeHatchHtml,
    contentJa: escapeHatchHtmlJa,
  },
  {
    path: '/api/adapters',
    title: 'Adapters',
    section: 'api',
    description: 'd1Adapter for Cloudflare D1 and tursoAdapter for Turso/libSQL.',
    content: adaptersHtml,
    contentJa: adaptersHtmlJa,
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
