import { defineModel } from '@nanokajs/core'
import { describe, expect, it } from 'vitest'
import { userFields, userTableName } from '../src/models/user'
import fixture from './fixtures/user.openapi.json'

describe('User OpenAPI component fixture', () => {
  const User = defineModel(userTableName, userFields)

  it('matches the checked-in fixture', () => {
    expect(User.toOpenAPIComponent()).toEqual(fixture)
  })

  it('matches snapshot', () => {
    expect(User.toOpenAPIComponent()).toMatchSnapshot()
  })
})
