import { Hono } from 'hono'
import { describe, it } from 'vitest'
import type { z } from 'zod'
import { t } from '../../field'
import { defineModel } from '../define'
import type { CreateInput, PolicyOmitKeys } from '../types'

describe('Model: schema() type inference', () => {
  const User = defineModel('users', {
    id: t.uuid().primary(),
    name: t.string(),
    email: t.string().email(),
    passwordHash: t.string(),
  })

  describe('schema() without options', () => {
    it('infers all fields as required', () => {
      const schema = User.schema()
      type Output = z.infer<typeof schema>

      // Verify it has all required fields
      const _: Output = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
        email: 'john@example.com',
        passwordHash: 'hash',
      }
    })
  })

  describe('schema({ omit })', () => {
    it('excludes omitted fields from output type', () => {
      const schema = User.schema({ omit: ['passwordHash'] })
      type Output = z.infer<typeof schema>

      const _: Output = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
        email: 'john@example.com',
      }
    })

    it('excludes multiple fields', () => {
      const schema = User.schema({ omit: ['passwordHash', 'email'] })
      type Output = z.infer<typeof schema>

      const _: Output = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
      }
    })
  })

  describe('schema({ pick })', () => {
    it('includes only picked fields', () => {
      const schema = User.schema({ pick: ['name', 'email'] })
      type Output = z.infer<typeof schema>

      const _: Output = {
        name: 'John',
        email: 'john@example.com',
      }
    })

    it('works with single field', () => {
      const schema = User.schema({ pick: ['id'] })
      type Output = z.infer<typeof schema>

      const _: Output = {
        id: '550e8400-e29b-41d4-a716-446655440000',
      }
    })
  })

  describe('schema({ partial: true })', () => {
    it('makes all fields optional', () => {
      const schema = User.schema({ partial: true })
      type Output = z.infer<typeof schema>

      const _: Output = {}
      const __: Output = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
        email: 'john@example.com',
        passwordHash: 'hash',
      }
    })
  })

  describe('schema({ partial: true, pick })', () => {
    it('makes picked fields optional', () => {
      const schema = User.schema({ partial: true, pick: ['name', 'email'] })
      type Output = z.infer<typeof schema>

      const _: Output = {}
      const __: Output = {
        name: 'John',
      }
      const ___: Output = {
        name: 'John',
        email: 'john@example.com',
      }
    })
  })

  describe('schema({ partial: true, omit })', () => {
    it('makes remaining fields optional after omit', () => {
      const schema = User.schema({ partial: true, omit: ['passwordHash'] })
      type Output = z.infer<typeof schema>

      const _: Output = {}
      const __: Output = {
        id: '550e8400-e29b-41d4-a716-446655440000',
      }
    })
  })

  describe('schema({ pick, omit })', () => {
    it('applies pick before omit', () => {
      const schema = User.schema({ pick: ['id', 'name', 'email'], omit: ['email'] })
      type Output = z.infer<typeof schema>

      const _: Output = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'John',
      }
    })
  })

  describe('schema() type validation', () => {
    it('rejects typo in omit', () => {
      // @ts-expect-error - 'passwordHashh' is not a valid field name
      User.schema({ omit: ['passwordHashh'] })
    })

    it('rejects typo in pick', () => {
      // @ts-expect-error - 'emial' is not a valid field name
      User.schema({ pick: ['emial'] })
    })

    it('rejects typo in validator omit', () => {
      // @ts-expect-error - 'passwordHashh' is not a valid field name
      User.validator('json', { omit: ['passwordHashh'] })
    })

    it('omitted fields are absent from output type', () => {
      const s = User.schema({ omit: ['passwordHash'] })
      type Out = z.infer<typeof s>
      // @ts-expect-error - passwordHash should be absent
      const _check: Out = { id: '', name: '', email: '', passwordHash: '' }
      void _check
    })

    it('picked-out fields are absent from output type', () => {
      const s = User.schema({ pick: ['name', 'email'] })
      type Out = z.infer<typeof s>
      // @ts-expect-error - id should be absent
      const _check: Out = { id: '', name: '', email: '' }
      void _check
    })
  })

  describe('FieldsToZodShape concrete types', () => {
    it('preserves concrete Zod input/output types per field', () => {
      const schema = User.schema()
      type In = z.input<typeof schema>
      type Out = z.output<typeof schema>
      const _in: In = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: '',
        email: '',
        passwordHash: '',
      }
      const _out: Out = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: '',
        email: '',
        passwordHash: '',
      }
      void _in
      void _out
    })

    it('email field validation enforces string type', () => {
      const schema = User.schema()
      type In = z.input<typeof schema>
      // Valid email
      const valid: In = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: '',
        email: 'test@example.com',
        passwordHash: '',
      }
      void valid
    })
  })
})

describe('schema({ pick: f => [...] }) accessor form', () => {
  const User = defineModel('users', {
    id: t.uuid().primary(),
    name: t.string(),
    email: t.string().email(),
    passwordHash: t.string().serverOnly(),
  })

  it('accepts accessor pick', () => {
    const s = User.schema({ pick: (f) => [f.name, f.email] })
    type Out = z.infer<typeof s>
    const _: Out = { name: '', email: '' }
    void _
  })

  it('rejects accessor with typo', () => {
    // @ts-expect-error - 'emial' does not exist on accessor
    User.schema({ pick: (f) => [f.emial] })
  })

  it('rejects accessor with typo in omit', () => {
    // @ts-expect-error - 'passwordHashh' does not exist on accessor
    User.schema({ omit: (f) => [f.passwordHashh] })
  })

  it('validator accepts accessor form', () => {
    User.validator('json', { pick: (f) => [f.name] })
    // @ts-expect-error - 'emial' does not exist on accessor
    User.validator('json', { pick: (f) => [f.emial] })
  })
})

describe('back-compat: string array form still works', () => {
  const User = defineModel('users', {
    id: t.uuid().primary(),
    name: t.string(),
    email: t.string().email(),
    passwordHash: t.string(),
  })

  it('pick: [...] still works', () => {
    const s = User.schema({ pick: ['name', 'email'] })
    type Out = z.infer<typeof s>
    const _: Out = { name: '', email: '' }
    void _
  })
})

describe('validator preset: c.req.valid() is not unknown (Zod 4 compat)', () => {
  const PolicyUser = defineModel('users', {
    id: t.uuid().primary().readOnly(),
    name: t.string(),
    email: t.string().email(),
    passwordHash: t.string().serverOnly(),
    password: t.string().writeOnly(),
  })

  it('validator("json", "create") yields a non-unknown type for c.req.valid("json")', () => {
    const app = new Hono()
    app.post('/users', PolicyUser.validator('json', 'create'), (c) => {
      const body = c.req.valid('json')
      // name and email are present (not serverOnly, not readOnly)
      const _name: string = body.name
      const _email: string = body.email
      // password (writeOnly) is present in create input
      const _password: string = body.password
      void _name
      void _email
      void _password
      // id is excluded (readOnly) — accessing it would be a type error
      // @ts-expect-error - id is readOnly, excluded from create input
      const _id = body.id
      void _id
      // passwordHash is excluded (serverOnly) — accessing it would be a type error
      // @ts-expect-error - passwordHash is serverOnly, excluded from create input
      const _hash = body.passwordHash
      void _hash
      return c.json({ ok: true })
    })
  })

  it('validator("json", "update") yields a Partial non-unknown type for c.req.valid("json")', () => {
    const app = new Hono()
    app.patch('/users/:id', PolicyUser.validator('json', 'update'), (c) => {
      const body = c.req.valid('json')
      // name and email are present as optional (update is partial)
      const _name: string | undefined = body.name
      const _email: string | undefined = body.email
      void _name
      void _email
      // id is excluded (readOnly) — accessing it would be a type error
      // @ts-expect-error - id is readOnly, excluded from update input
      const _id = body.id
      void _id
      return c.json({ ok: true })
    })
  })
})

describe('inputSchema/outputSchema return types are precise', () => {
  const User = defineModel('users', {
    id: t.uuid().primary(),
    name: t.string(),
    email: t.string().email(),
    passwordHash: t.string().serverOnly(),
    createdAt: t.timestamp().readOnly(),
    password: t.string().writeOnly(),
  })

  it('outputSchema excludes serverOnly and writeOnly fields', () => {
    const s = User.outputSchema()
    type Out = z.infer<typeof s>
    // passwordHash (serverOnly) must not exist in output
    // @ts-expect-error - passwordHash is serverOnly
    const _bad1: Out = { passwordHash: '' }
    void _bad1
    // password (writeOnly) must not exist in output
    // @ts-expect-error - password is writeOnly
    const _bad2: Out = { password: '' }
    void _bad2
  })

  it('inputSchema("create") excludes serverOnly and readOnly fields', () => {
    const s = User.inputSchema('create')
    type In = z.infer<typeof s>
    // passwordHash (serverOnly) must not exist in create input
    // @ts-expect-error - passwordHash is serverOnly
    const _bad: In = { passwordHash: '' }
    void _bad
    // createdAt (readOnly) must not exist in create input
    // @ts-expect-error - createdAt is readOnly
    const _bad2: In = { createdAt: new Date() }
    void _bad2
  })

  it('CreateInput requires non-default fields, makes default optional', () => {
    const Post = defineModel('posts', {
      id: t
        .uuid()
        .primary()
        .default(() => crypto.randomUUID()),
      title: t.string(),
      published: t.boolean().default(false),
    })
    type C = CreateInput<typeof Post.fields>
    const _: C = { title: 'x' }
    void _
    const __: C = { title: 'x', id: '...', published: true }
    void __
  })
})
