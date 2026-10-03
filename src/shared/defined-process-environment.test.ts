import { expect, it } from 'vitest'
import { definedProcessEnvironment } from './defined-process-environment'

it('omits unset variables while preserving intentionally empty values and the input', () => {
  const env = { PATH: '/bin', EMPTY: '', UNSET: undefined }
  expect(definedProcessEnvironment(env)).toEqual({ PATH: '/bin', EMPTY: '' })
  expect(env).toHaveProperty('UNSET', undefined)
})
