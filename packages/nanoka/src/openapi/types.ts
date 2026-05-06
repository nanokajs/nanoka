export type OpenAPISchemaObject = Record<string, unknown>

export type WithOpenAPIOption = Readonly<Record<string, true>>

export interface OpenAPIModelComponent {
  create: OpenAPISchemaObject
  update: OpenAPISchemaObject
  output: OpenAPISchemaObject
}

export type OpenAPIUsage = 'create' | 'update' | 'output'

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

export interface OpenAPIRequestBodySpec {
  readonly description?: string
  readonly required?: boolean
  readonly content: {
    readonly 'application/json': { readonly schema: OpenAPISchemaObject }
  }
}

export interface OpenAPIResponseSpec {
  readonly description: string
  readonly content?: {
    readonly 'application/json': { readonly schema: OpenAPISchemaObject }
  }
}

export interface OpenAPIParamSpec {
  readonly name: string
  readonly in: 'path' | 'query' | 'header'
  readonly required?: boolean
  readonly schema: OpenAPISchemaObject
  readonly description?: string
}

export interface OpenAPIRouteMetadata {
  readonly path: string
  readonly method: HttpMethod
  readonly operationId?: string
  readonly summary?: string
  readonly description?: string
  readonly tags?: readonly string[]
  readonly requestBody?: OpenAPIRequestBodySpec
  readonly params?: OpenAPIParamSpec[]
  readonly responses: Record<string, OpenAPIResponseSpec>
}

export type RouteOpenAPIMetadata = Omit<OpenAPIRouteMetadata, 'path' | 'method'>

export interface OpenAPISpecOptions {
  readonly info: {
    readonly title: string
    readonly version: string
    readonly description?: string
  }
  readonly servers?: ReadonlyArray<{ readonly url: string; readonly description?: string }>
}

export interface OpenAPIDocument {
  readonly openapi: '3.1.0'
  readonly info: OpenAPISpecOptions['info']
  readonly servers?: OpenAPISpecOptions['servers']
  readonly paths: Record<string, Record<string, unknown>>
}
