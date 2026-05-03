import type { OpenAPIDocument, OpenAPIRouteMetadata, OpenAPISpecOptions } from './types'

function honoPathToOpenAPI(path: string): string {
  return path.replace(/:([^/]+)/g, '{$1}')
}

export function buildOpenAPIDocument(
  routes: readonly OpenAPIRouteMetadata[],
  options: OpenAPISpecOptions,
): OpenAPIDocument {
  const paths: Record<string, Record<string, unknown>> = {}

  for (const route of routes) {
    const openAPIPath = honoPathToOpenAPI(route.path)
    if (!paths[openAPIPath]) {
      paths[openAPIPath] = {}
    }

    const operation: Record<string, unknown> = {}
    if (route.operationId) operation.operationId = route.operationId
    if (route.summary) operation.summary = route.summary
    if (route.description) operation.description = route.description
    if (route.tags) operation.tags = route.tags

    const parameters: unknown[] = []
    const pathParams = [...route.path.matchAll(/:([^/]+)/g)].map((m) => m[1])
    for (const param of pathParams) {
      const alreadyDefined = route.params?.some((p) => p.name === param && p.in === 'path')
      if (!alreadyDefined) {
        parameters.push({ name: param, in: 'path', required: true, schema: { type: 'string' } })
      }
    }
    if (route.params) {
      parameters.push(...route.params)
    }
    if (parameters.length > 0) operation.parameters = parameters

    if (route.requestBody) operation.requestBody = route.requestBody
    operation.responses = route.responses

    paths[openAPIPath][route.method] = operation
  }

  const doc: OpenAPIDocument = {
    openapi: '3.1.0',
    info: options.info,
    ...(options.servers ? { servers: options.servers } : {}),
    paths,
  }

  return doc
}
