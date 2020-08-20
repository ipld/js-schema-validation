/* global it */
import main from '@ipld/schema-validation'
import parse from './parse.js'
import { create } from 'multiformats'

const { fromString } = create().bytes

const test = it

test('read bytes', async () => {
  const schema = `
  type TestBytes bytes
  `
  const validate = main(parse(schema))
  validate(fromString('asdf'), 'TestBytes')
})
