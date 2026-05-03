export type OpenAPISchemaObject = Record<string, unknown>

export interface OpenAPIModelComponent {
  create: OpenAPISchemaObject
  update: OpenAPISchemaObject
  output: OpenAPISchemaObject
}

export type OpenAPIUsage = 'create' | 'update' | 'output'
